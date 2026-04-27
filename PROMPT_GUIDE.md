# 🌟 提取 Prompt 指南

根据不同的学习内容类型，使用不同的 Prompt 模板。

---

## 📚 类型 1：语义模块学习（Phrasal Verbs, Collocations, Idioms 等）

适用于：学习短语动词、搭配、习语等语义模块的视频。

### 关键点：
1. **强调数量**: "EXTRACT AS MANY... POSSIBLE"
2. **强调全面**: "COMPREHENSIVE", "EVERYTHING valuable"
3. **拒绝偷懒**: "Do not just extract 1 or 2 examples"

### 📋 Prompt 模板：

```text
You are an expert linguist and English teacher.
Your task is to extract ALL useful English "Semantic Modules" from the provided text.
I need a COMPREHENSIVE extraction. Do not just extract 1 or 2 examples per category. Extract EVERYTHING valuable.
Scan the text chunk by chunk if necessary to ensure nothing is missed.

Target Modules:
1. Collocations (e.g. "heavy rain", "make a decision")
2. Phrasal Verbs (e.g. "give up", "run out of")
3. Idioms/Fixed Expressions (e.g. "break a leg", "once in a blue moon")
4. Strong Adjectives (e.g. "devastated", "hilarious")
5. High-Frequency/Key Nouns (e.g. "strategy", "policy")

IMPORTANT:
- EXTRACT AS MANY MODULES AS POSSIBLE.
- For each module, provide examples preferably FROM THE TEXT ITSELF.
- If the text has multiple sentences for the same module, include them all (up to 3-4 examples).
- If the text doesn't contain a good example, you may create a natural one.
- Translate each example sentence into Chinese.

Output purely VALID JSON with this structure (Do not add markdown explanations outside the JSON block):
{
    "modules": [
        {
            "module": "extracted phrase",
            "type": "type category",
            "chinese_meaning": "concise Chinese translation",
            "examples": [
                {"en": "English example sentence 1", "cn": "Chinese translation 1"},
                {"en": "English example sentence 2 (optional)", "cn": "Chinese translation 2 (optional)"}
            ]
        }
    ]
}
If no modules are found, return {"modules": []}.

IMPORTANT:
After generating the JSON, please automatically SAVE it to the current SRT directory (or `data/1_extracted_json/` if available).
The filename should be the same as the source file but with a `.json` extension.
```

---

## 💬 类型 2：惯用句学习（Common Expressions）

适用于：学习日常惯用句、实用表达的视频。**不需要**提取语义模块，只需要英文句子和中文翻译。

### 📋 Prompt 模板：

```text
You are an expert linguist and English teacher.
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
- When consecutive lines clearly form a dialogue pair (e.g., question → answer), keep them together inside the same `examples` array (don’t split them into separate objects).
- Do not repeat the English text in `cn`; provide a proper Chinese translation instead of copying the English sentence.
- For simple dialogues or single sentences that do not represent a semantic learning chunk, omit `module`, `type`, and `chinese_meaning`; just emit the `examples` list.
- If a subtitle line contains romanized Chinese (pinyin), treat it as the Chinese part of the dialogue. Do not output the pinyin as an English sentence. Instead, keep the actual spoken English in `en` and provide the corresponding Chinese characters or a natural Chinese translation in `cn`. If only pinyin is available, translate it into meaningful Chinese for `cn` rather than leaving the romanization unchanged.

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
Only "examples" array is required.

IMPORTANT:
After generating the JSON, please automatically SAVE it to the current SRT directory (or `data/1_extracted_json/` if available).
The filename should be the same as the source file but with a `.json` extension.
```

---

## 📰 类型 3：新闻英语模式模板（全文先行 + 词句讲解）

适用于：新闻讲解类英语视频（如“通过新闻学英语”），目标是先建立整篇理解，再进入词汇与句型讲解。

### 设计原则（必须遵守）

1. **整篇新闻导入层（最高优先级）**
   - 先给新闻全文（按语义段切片）并遵循固定顺序：
     - Pass 1: EN normal（先读一遍全文）
     - Pass 2: CN translation（再给整篇中文）
     - Pass 3: EN slow review（最后慢读一遍）
2. **词汇层（主）**
   - 抽高频新闻词汇/短语（可复用、可迁移）
   - 每词 1-2 个原句 + 中文翻译
3. **短句层（主）**
   - 选择可独立复述的短句（建议 6-14 词）
   - 保持一句英文一句中文交替，不做大段并读
4. **常用句型层（主）**
   - 提取高复用模板句型（如 `It depends on...` / `The point is that...` / `What I mean is...`）
5. **新闻功能句层（主）**
   - 覆盖新闻常见功能：因果、对比、转折、数据表达、被动句
6. **长句拆分层（辅）**
   - 仅保留信息密度高的新闻原句
   - 强制按意群/从句拆分：`英文子句A -> 中文A -> 英文子句B -> 中文B`
   - 禁止“5-6句连读后再整段翻译”

### 📋 Prompt 模板：

```text
You are an expert English curriculum designer and bilingual ESL teacher.
Your task is to convert the provided transcript into a practical news-English learning dataset.
Return strictly valid JSON only.

Learning goals:
1) Full news pass layer FIRST (EN normal -> CN translation -> EN slow)
2) Vocabulary/Phrase layer (primary)
3) Short sentence layer (primary)
4) Common sentence pattern layer (primary)
5) News functional sentence layer (primary)
6) Long sentence split layer (secondary)

Output requirements:
- Keep only useful, high-frequency, reusable items.
- Chinese translations must be natural and concise.
- Deduplicate near-identical items.
- For long items, split by clause/meaning group and pair EN/CN step by step.
- Do NOT output multi-sentence paragraph blocks with one combined translation.
- For the full news pass layer, split the article into semantic chunks and put it BEFORE all other layers.
- Full news pass chunks should use `type: "Full News Pass"` and concise module labels like:
  - `Full News • Pass 1 (EN Normal)`
  - `Full News • Pass 2 (CN Translation)`
  - `Full News • Pass 3 (EN Slow Review)`

Use this JSON structure:
{
  "modules": [
    {
      "module": "item title",
      "type": "Full News Pass | Vocabulary | Short Sentence | Common Sentence Pattern | News Functional Sentence | Long Sentence Split",
      "chinese_meaning": "concise Chinese meaning or learning focus",
      "examples": [
        {"en": "English segment or sentence", "cn": "Chinese translation"},
        {"en": "English segment or sentence", "cn": "Chinese translation"}
      ]
    }
  ]
}

Type-specific hints:
- Full News Pass: place these modules first; each chunk should preserve article coherence.
- Vocabulary: include term-level meaning and short contextual examples.
- Short Sentence: prefer 6-14 word independently repeatable lines.
- Common Sentence Pattern: include reusable template with one practical variation.
- News Functional Sentence: include items for cause/effect, contrast, transition, data, passive voice.
- Long Sentence Split: split one long sentence into EN/CN clause pairs.

If no useful items are found, return {"modules": []}.
```

---

## ✅ JSON 格式说明

### 完整格式（语义模块）：
```json
{
    "modules": [
        {
            "module": "come up with",           // 可选：模块名称
            "type": "Phrasal Verb",            // 可选：类型分类
            "chinese_meaning": "想出；提出",    // 可选：中文含义
            "examples": [
                {"en": "English sentence", "cn": "中文翻译"}
            ]
        }
    ]
}
```

### 简化格式（惯用句）：
```json
{
    "modules": [
        {
            "examples": [
                {"en": "English sentence", "cn": "中文翻译"}
            ]
        }
    ]
}
```

**重要说明**：
- `module`、`type`、`chinese_meaning` 都是**可选字段**
- 如果不存在这些字段，音频生成器会跳过模块名和中文含义的播放
- 只播放 `examples` 中的英文和中文翻译
- 音频生成流程已完全支持这两种格式

---

## 💡 额外技巧 (Pro Tip)

如果文本特别长（比如超过 500 行），即使是这个 Prompt 也可能因为 Token 限制而漏掉后面的内容。
这时，请使用 **"分段发送法"**：

**第 1 次对话：**
> "Use the prompt rules above. Here is **Part 1** of the text:"
> [粘贴前一半]

**第 2 次对话：**
> "Continue using the same rules. Here is **Part 2**:"
> [粘贴后一半]

这样能 100% 保证提取质量！
