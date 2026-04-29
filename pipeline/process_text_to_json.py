#!/usr/bin/env python3
"""
使用 LLM 处理文本文件，生成包含中文翻译的 JSON（Type 2 Prompt）
"""
import os
import sys
import json
import asyncio
import logging
import re
from pathlib import Path
from typing import List
from openai import AsyncOpenAI
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

COMMON_SYSTEM_PROMPT = """You are an expert linguist and English teacher.
Your task is to extract ALL useful English expressions and sentences from the provided text.
I need a COMPREHENSIVE extraction. Extract EVERYTHING valuable.
Scan the text chunk by chunk if necessary to ensure nothing is missed.

IMPORTANT:
- EXTRACT AS MANY USEFUL EXPRESSIONS AS POSSIBLE.
- Focus on practical, commonly used expressions and sentences.
- For each expression, provide the English sentence and its Chinese translation.
- If the text has multiple similar expressions, include them all.
- Translate each sentence accurately into Chinese.
- Deduplicate identical English lines: keep just one occurrence even if it appears multiple times.
- When consecutive lines clearly form a dialogue pair (e.g., question → answer), keep them together inside the same `examples` array (don't split them into separate objects).
- Do not repeat the English text in `cn`; provide a proper Chinese translation instead of copying the English sentence.
- For simple dialogues or single sentences that do not represent a semantic learning chunk, omit `module`, `type`, and `chinese_meaning`; just emit the `examples` list.

Output purely VALID JSON with this structure (Do not add markdown explanations outside the JSON block):
{
    "modules": [
        {
            "examples": [
                {"en": "English sentence 1", "cn": "Chinese translation 1"},
                {"en": "English sentence 2", "cn": "Chinese translation 2"}
            ]
        }
    ]
}
If no expressions are found, return {"modules": []}.

Note: For this type of content, you do NOT need to provide "module", "type", or "chinese_meaning" fields.
Only "examples" array is required."""

NEWS_SYSTEM_PROMPT = """You are an expert English curriculum designer and bilingual ESL teacher.
Your task is to convert the provided transcript into a practical news-English learning dataset.
Return strictly valid JSON only.

Learning goals:
1) Vocabulary/Phrase layer (primary)
2) Short sentence layer (primary)
3) Common sentence pattern layer (primary)
4) News functional sentence layer (primary)
5) Long sentence split layer (secondary)

Output requirements:
- Keep only useful, high-frequency, reusable items.
- Chinese translations must be natural and concise.
- Deduplicate near-identical items.
- For long items, split by clause/meaning group and pair EN/CN step by step.
- Do NOT output multi-sentence paragraph blocks with one combined translation.

Use this JSON structure:
{
  "modules": [
    {
      "module": "item title",
      "type": "Vocabulary | Short Sentence | Common Sentence Pattern | News Functional Sentence | Long Sentence Split",
      "chinese_meaning": "concise Chinese meaning or learning focus",
      "examples": [
        {"en": "English segment or sentence", "cn": "Chinese translation"},
        {"en": "English segment or sentence", "cn": "Chinese translation"}
      ]
    }
  ]
}

Type-specific hints:
- Vocabulary: include term-level meaning and short contextual examples.
- Short Sentence: prefer 6-14 word independently repeatable lines.
- Common Sentence Pattern: include reusable template with one practical variation.
- News Functional Sentence: include items for cause/effect, contrast, transition, data, passive voice.
- Long Sentence Split: split one long sentence into EN/CN clause pairs.

If no useful items are found, return {"modules": []}."""


def _extract_verbatim_lines(source_path: Path, text_content: str) -> List[str]:
    if source_path.suffix.lower() == ".srt":
        timestamp_pattern = re.compile(r"\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}")
        lines: List[str] = []
        for raw in text_content.splitlines():
            line = raw.strip()
            if not line or line.isdigit() or timestamp_pattern.match(line):
                continue
            line = re.sub(r"<[^>]+>", "", line).strip()
            if not line:
                continue
            if lines and lines[-1] == line:
                continue
            lines.append(line)
        return lines

    compact = re.sub(r"\s+", " ", text_content).strip()
    if not compact:
        return []
    return [compact]


def _build_news_paragraphs(lines: List[str], target_chars: int, max_chars: int) -> List[str]:
    if not lines:
        return []

    paragraphs: List[str] = []
    buffer: List[str] = []
    buf_len = 0
    end_pattern = re.compile(r"[.!?;:。！？；：]$")

    def flush() -> None:
        nonlocal buffer, buf_len
        if not buffer:
            return
        paragraphs.append(" ".join(buffer).strip())
        buffer = []
        buf_len = 0

    for line in lines:
        line_len = len(line)
        buffer.append(line)
        buf_len += line_len + 1

        should_flush = False
        if buf_len >= max_chars:
            should_flush = True
        elif buf_len >= target_chars and end_pattern.search(line):
            should_flush = True

        if should_flush:
            flush()

    flush()
    return [p for p in paragraphs if p]


def _build_full_news_module(paragraphs: List[str]) -> dict:
    return {
        "module": "Full News Pass • Verbatim Paragraph Flow",
        "type": "Full News Pass",
        "chinese_meaning": "新闻原文整段朗读（EN normal -> CN -> EN slow）",
        # Keep EN verbatim and let step3 translator fill CN.
        "examples": [{"en": text} for text in paragraphs],
    }


async def process_text_file_to_json(
    text_file_path: str,
    output_json_path: str,
    profile: str = "common",
    news_paragraph_chars: int = 420,
):
    """使用 LLM 处理文本文件，生成 JSON"""
    load_dotenv()
    
    api_key = os.getenv('OPENAI_API_KEY')
    base_url = os.getenv('OPENAI_BASE_URL')
    
    if not api_key or not base_url:
        logger.error("Missing OPENAI_API_KEY or OPENAI_BASE_URL in .env")
        sys.exit(1)
    
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    
    # 读取文本文件
    with open(text_file_path, 'r', encoding='utf-8') as f:
        text_content = f.read()
    
    logger.info(f"Processing text file: {text_file_path} ({len(text_content)} chars)")
    
    source_path = Path(text_file_path)
    if profile == "news":
        system_prompt = NEWS_SYSTEM_PROMPT
    else:
        system_prompt = COMMON_SYSTEM_PROMPT
    
    user_content = text_content
    
    try:
        # 检查环境变量或使用默认模型
        model_name = os.getenv('OPENAI_MODEL')
        if not model_name:
            # 根据 base_url 推断模型
            if 'deepseek' in base_url.lower():
                model_name = 'deepseek-chat'
            elif 'moonshot' in base_url.lower():
                model_name = 'moonshot-v1-8k'
            else:
                model_name = 'gpt-4'  # 默认
        logger.info(f"Calling LLM with model: {model_name}")
        
        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # 尝试提取 JSON（可能包含 markdown 代码块）
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()
        
        # 保存原始响应用于调试（如果JSON解析失败）
        debug_file = output_json_path.replace('.json', '_raw_response.txt')
        
        # 修复常见的JSON问题
        # 1. 修复无效的转义序列 \' -> '
        result_text = result_text.replace("\\'", "'")
        # 2. 移除控制字符（除了标准的转义序列）
        import re
        # 移除无效的控制字符（0x00-0x1F，除了 \n, \r, \t）
        result_text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', result_text)
        # 3. 确保JSON正确闭合（如果缺少闭合括号）
        if not result_text.rstrip().endswith('}'):
            # 检查是否有未闭合的结构
            open_braces = result_text.count('{')
            close_braces = result_text.count('}')
            open_brackets = result_text.count('[')
            close_brackets = result_text.count(']')
            if open_braces > close_braces:
                result_text += '\n' + '}' * (open_braces - close_braces)
            if open_brackets > close_brackets:
                result_text = result_text.rstrip() + '\n' + ']' * (open_brackets - close_brackets)
                if open_braces > close_braces:
                    result_text += '\n}'
        
        # 解析 JSON
        try:
            data = json.loads(result_text)
        except json.JSONDecodeError as e:
            # 保存原始响应以便调试
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(result_text)
            logger.error(f"JSON parsing error. Raw response saved to: {debug_file}")
            logger.error(f"Error at line {e.lineno}, column {e.colno}: {e.msg}")
            # 尝试修复：移除可能导致问题的字符
            # 但这里我们直接抛出错误，让用户知道需要手动修复
            raise
        
        # 保存 JSON 文件
        if not isinstance(data.get("modules"), list):
            data["modules"] = []

        if profile == "news":
            verbatim_lines = _extract_verbatim_lines(source_path, text_content)
            paragraph_max_chars = max(news_paragraph_chars + 180, news_paragraph_chars + 1)
            news_paragraphs = _build_news_paragraphs(
                verbatim_lines,
                target_chars=max(220, news_paragraph_chars),
                max_chars=paragraph_max_chars,
            )
            if news_paragraphs:
                logger.info(
                    "Built Full News Pass with %d verbatim paragraphs (target_chars=%d).",
                    len(news_paragraphs),
                    max(220, news_paragraph_chars),
                )
                data["modules"] = [_build_full_news_module(news_paragraphs), *data["modules"]]
            else:
                logger.warning("News profile enabled but no verbatim paragraphs were produced.")

        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        logger.info(f"✅ Successfully generated JSON: {output_json_path}")
        logger.info(f"   Total examples: {sum(len(m.get('examples', [])) for m in data.get('modules', []))}")
        
        return output_json_path
        
    except Exception as e:
        logger.error(f"❌ Error processing {text_file_path}: {e}", exc_info=True)
        raise

async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Process text/SRT into learning JSON via LLM.")
    parser.add_argument("text_file", help="Input text or SRT file path")
    parser.add_argument("output_json_file", nargs="?", default=None, help="Output JSON path")
    parser.add_argument(
        "--profile",
        choices=["common", "news"],
        default="common",
        help="Extraction profile: common expressions or news learning",
    )
    parser.add_argument(
        "--news-paragraph-chars",
        type=int,
        default=420,
        help="Target paragraph size for verbatim Full News Pass (news profile only).",
    )
    args = parser.parse_args()

    text_file = args.text_file
    if not Path(text_file).exists():
        logger.error(f"Text file not found: {text_file}")
        sys.exit(1)
    
    # 如果没有指定输出文件，自动生成
    if args.output_json_file:
        output_json = args.output_json_file
    else:
        text_path = Path(text_file)
        # 从文件名提取信息，生成对应的 JSON 文件名
        # 例如: fvHcbIkWGrQ_chunk03_part1_sub1.txt -> fvHcbIkWGrQ_chunk03_part1_sub1.json
        output_json = str(Path("data/1_extracted_json") / f"{text_path.stem}.json")

    await process_text_file_to_json(
        text_file,
        output_json,
        profile=args.profile,
        news_paragraph_chars=args.news_paragraph_chars,
    )

if __name__ == "__main__":
    asyncio.run(main())

