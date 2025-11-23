
# 🌟 完美提取 Prompt (God Mode Prompt)

下次您想要达到同样的“神级”提取效果（60+ 个模块），请**完全复制**以下 Prompt，不要删减任何强调词。

关键点在于：
1.  **强调数量**: "EXTRACT AS MANY... POSSIBLE"
2.  **强调全面**: "COMPREHENSIVE", "EVERYTHING valuable"
3.  **拒绝偷懒**: "Do not just extract 1 or 2 examples"

---

### 📋 复制以下内容 (Copy This):

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

### 💡 额外技巧 (Pro Tip)

如果文本特别长（比如超过 500 行），即使是这个 Prompt 也可能因为 Token 限制而漏掉后面的内容。
这时，请使用 **“分段发送法”**：

**第 1 次对话：**
> "Use the prompt rules above. Here is **Part 1** of the text:"
> [粘贴前一半]

**第 2 次对话：**
> "Continue using the same rules. Here is **Part 2**:"
> [粘贴后一半]

这样能 100% 保证提取质量！

