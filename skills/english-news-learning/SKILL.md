# English News Learning Skill

Use this skill when building `英语学习` outputs from news-style English videos.

## Objective

Transform transcript content into bilingual training material optimized for:

- vocabulary retention
- short-sentence reuse
- sentence pattern transfer
- news-expression comprehension
- long-sentence parsing

## Required Learning Layers

1. Vocabulary/Phrase (primary)
2. Short Sentence/Common Expression (primary)
3. Common Sentence Pattern (primary)
4. News Functional Sentence (primary)
5. Long Sentence Split (secondary)

Do not include spaced-review scheduling unless forgetting-curve logic is explicitly implemented.

## Type Definitions

- `Vocabulary`
  - High-frequency term or phrase
  - Include concise Chinese meaning
  - 1-2 contextual examples
- `Short Sentence`
  - Independently repeatable line (prefer 6-14 words)
  - Practical spoken/news usage
- `Common Sentence Pattern`
  - Reusable template pattern
  - At least one real-world variant
- `News Functional Sentence`
  - Must cover one of:
    - cause/effect
    - contrast
    - transition
    - data/statistics expression
    - passive-voice reporting
- `Long Sentence Split`
  - High-information original line
  - Split by clause/meaning group
  - Pair as `EN clause -> CN clause`

## Audio Delivery Constraints

- Default pacing:
  - `EN slow -> CN -> EN normal/fast`
- Never use long paragraph blocks with delayed whole-paragraph translation.
- Keep bilingual alternation sentence-level or clause-level.

## JSON Output Contract

```json
{
  "modules": [
    {
      "module": "item title",
      "type": "Vocabulary | Short Sentence | Common Sentence Pattern | News Functional Sentence | Long Sentence Split",
      "chinese_meaning": "concise Chinese meaning or learning focus",
      "examples": [
        {"en": "English segment or sentence", "cn": "Chinese translation"}
      ]
    }
  ]
}
```

## QA Checklist Before Generation

- Are short items dominant over long items?
- Are long items split into clause pairs (not paragraph blocks)?
- Do examples avoid duplicate English lines?
- Are translations natural and not literal word-copy artifacts?
- Are at least some modules labeled as `Common Sentence Pattern` and `News Functional Sentence`?
