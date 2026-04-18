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
