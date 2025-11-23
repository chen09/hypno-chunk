import os
import json
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Configure Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JSONTranslator:
    def __init__(self, api_key: str, base_url: str):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def translate_examples(self, json_path: str) -> str:
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {json_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        modules = data.get("modules", [])
        if not modules:
            logger.warning("No modules found in JSON.")
            return json_path

        # Prepare batch translation tasks
        tasks = []
        for i, module in enumerate(modules):
            examples = module.get("examples", [])
            if not examples:
                continue
            
            # Check if already translated (list of dicts with 'cn')
            needs_translation = False
            if isinstance(examples[0], str):
                needs_translation = True
            elif isinstance(examples[0], dict) and "cn" not in examples[0]:
                needs_translation = True
            
            if needs_translation:
                tasks.append(self._translate_module_examples(module, i))
        
        if not tasks:
            logger.info("No examples need translation.")
            return json_path

        logger.info(f"Translating examples for {len(tasks)} modules...")
        # Process with rate limiting (Moonshot RPM is strict ~20RPM -> 1 req / 3 sec)
        # We'll use a simple loop with sleep instead of gather to be safe and simple.
        logger.info(f"Translating examples for {len(tasks)} modules sequentially to avoid rate limits...")
        
        for i, task in enumerate(tasks):
            await task
            await asyncio.sleep(3.5) # Sleep 3.5s to be safe (20 RPM = 3s/req)

        # Save new file
        output_path = path.with_name(f"{path.stem}_with_cn.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        logger.info(f"Translation complete. Saved to: {output_path}")
        return str(output_path)

    async def _translate_module_examples(self, module: Dict[str, Any], index: int):
        examples = module.get("examples", [])
        # Extract just the text to translate
        texts_to_translate = []
        for ex in examples:
            if isinstance(ex, str):
                texts_to_translate.append(ex)
            elif isinstance(ex, dict):
                texts_to_translate.append(ex.get("en", ""))
        
        if not texts_to_translate:
            return

        prompt = f"""
        Translate the following English sentences into natural, concise Chinese.
        Return ONLY a JSON array of strings matching the order of input.
        
        Input Sentences:
        {json.dumps(texts_to_translate, ensure_ascii=False)}
        """

        try:
            response = await self.client.chat.completions.create(
                model="gemini-pro", # Or deepseek-chat, using environment var model is better but let's hardcode generic or rely on env
                messages=[
                    {"role": "system", "content": "You are a professional translator."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            # Handle potential wrapping in a key like {"translations": [...]} or just raw array if model behaves
            # But prompt asked for JSON array. Let's enforce object for safety if needed, 
            # but typically standard is object.
            # Let's adjust prompt to return object.
            
            # Revised Prompt logic in next attempt if this fails, but let's try to parse whatever comes.
            # Actually, let's make the prompt safer:
            # "Return JSON object: {'translations': ['cn1', 'cn2']}"
        except Exception as e:
            logger.error(f"Translation request failed for module {index}: {e}")
            return

    async def _translate_module_examples_safe(self, module: Dict[str, Any], index: int):
        examples = module.get("examples", [])
        texts = [ex if isinstance(ex, str) else ex.get("en", "") for ex in examples]
        
        if not texts:
            return

        system_prompt = "You are a translator. Translate the provided English sentences to Chinese. Output a JSON object with a key 'translations' containing the list of Chinese strings."
        user_content = json.dumps({"sentences": texts}, ensure_ascii=False)

        try:
            # Use the model from env or default to a cheap fast one. 
            # User environment seems to have deepseek/gemini.
            model_name = "moonshot-v1-8k" # Explicitly use Moonshot as per env
            
            response = await self.client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"}
            )
            
            res_data = json.loads(response.choices[0].message.content)
            translations = res_data.get("translations", [])
            
            # Update module in place
            new_examples = []
            for i, text in enumerate(texts):
                cn = translations[i] if i < len(translations) else ""
                new_examples.append({"en": text, "cn": cn})
            
            module["examples"] = new_examples
            logger.info(f"Translated module {index}: {module['module']}")

        except Exception as e:
            logger.error(f"Failed to translate module {index}: {e}")

# Wrapper for task
    async def _translate_module_examples(self, module, index):
        await self._translate_module_examples_safe(module, index)

if __name__ == "__main__":
    load_dotenv()
    api_key = os.getenv('OPENAI_API_KEY')
    base_url = os.getenv('OPENAI_BASE_URL')
    
    translator = JSONTranslator(api_key, base_url)
    
    # Hardcoded target for this task
    target_file = "data/1_extracted_json/ow8Zx7eiDvg_extracted_gemini.json"
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(translator.translate_examples(target_file))

