#!/usr/bin/env python3
"""
使用 LLM 处理文本文件，生成包含中文翻译的 JSON（Type 2 Prompt）
"""
import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from openai import AsyncOpenAI
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def process_text_file_to_json(text_file_path: str, output_json_path: str):
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
    
    # Type 2 Prompt
    system_prompt = """You are an expert linguist and English teacher.
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
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        logger.info(f"✅ Successfully generated JSON: {output_json_path}")
        logger.info(f"   Total examples: {sum(len(m.get('examples', [])) for m in data.get('modules', []))}")
        
        return output_json_path
        
    except Exception as e:
        logger.error(f"❌ Error processing {text_file_path}: {e}", exc_info=True)
        raise

async def main():
    if len(sys.argv) < 2:
        print("Usage: python process_text_to_json.py <TEXT_FILE> [OUTPUT_JSON_FILE]")
        print("Example: python process_text_to_json.py data/0_raw_videos/new_module/fvHcbIkWGrQ_chunk03_part1_sub1.txt")
        sys.exit(1)
    
    text_file = sys.argv[1]
    if not Path(text_file).exists():
        logger.error(f"Text file not found: {text_file}")
        sys.exit(1)
    
    # 如果没有指定输出文件，自动生成
    if len(sys.argv) >= 3:
        output_json = sys.argv[2]
    else:
        text_path = Path(text_file)
        # 从文件名提取信息，生成对应的 JSON 文件名
        # 例如: fvHcbIkWGrQ_chunk03_part1_sub1.txt -> fvHcbIkWGrQ_chunk03_part1_sub1.json
        output_json = str(Path("data/1_extracted_json") / f"{text_path.stem}.json")
    
    await process_text_file_to_json(text_file, output_json)

if __name__ == "__main__":
    asyncio.run(main())

