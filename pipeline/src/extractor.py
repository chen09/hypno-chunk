import os
import json
import re
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any
from openai import AsyncOpenAI, APIError
from src.cleaner import SubtitleCleaner

# Configure Logger
logger = logging.getLogger(__name__)

class SemanticExtractor:
    """
    Logic to call LLM (OpenAI compatible API) for cleaning subtitle text
    and extracting semantic modules (collocations, phrasal verbs).
    Now supports chunking for long videos.
    """

    def __init__(self, api_key: str, base_url: str):
        """
        Initialize the extractor with AsyncOpenAI client.

        Args:
            api_key (str): The OpenAI API key.
            base_url (str): Custom base URL for API compatible services (e.g., DeepSeek).
        """
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        # Ensure output directory exists - use project root data directory
        # Get project root (parent of pipeline directory)
        script_dir = Path(__file__).parent.parent  # Go up from src/ to pipeline/
        project_root = script_dir.parent  # Go up from pipeline/ to project root
        self.output_dir = project_root / "data" / "1_extracted_json"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Chunking settings
        self.CHUNK_SIZE = 15000  # Characters per chunk (approx 3000-4000 words)
        self.CHUNK_OVERLAP = 500 # Overlap to avoid cutting sentences/context

    def _clean_and_deduplicate_srt(self, srt_content: str) -> str:
        """
        Pre-process SRT content:
        1. Remove timestamps and index numbers.
        2. Remove duplicate consecutive lines.
        3. Merge into a clean text block.
        """
        lines = srt_content.splitlines()
        cleaned_lines = []
        
        timestamp_pattern = re.compile(r'\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}')
        last_line = ""

        for line in lines:
            line = line.strip()
            if not line or line.isdigit() or timestamp_pattern.match(line):
                continue
            
            line = re.sub(r'<[^>]+>', '', line)

            if line == last_line:
                continue
            
            cleaned_lines.append(line)
            last_line = line

        return " ".join(cleaned_lines)

    def _chunk_text(self, text: str) -> List[str]:
        """
        Split text into overlapping chunks to respect LLM context limits.
        """
        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.CHUNK_SIZE
            if end >= text_len:
                chunks.append(text[start:])
                break
            
            # Try to find a sentence ending (.!?) to break cleanly
            lookahead_buffer = text[end:min(end+200, text_len)]
            match = re.search(r'[.!?]', lookahead_buffer)
            
            if match:
                split_point = end + match.end()
            else:
                # Fallback: just split at space if possible
                split_point = text.rfind(' ', start, end)
                if split_point == -1:
                    split_point = end

            chunks.append(text[start:split_point])
            start = split_point - self.CHUNK_OVERLAP # Overlap for next chunk
            
            # Sanity check to prevent infinite loops if overlap >= split_point - start
            if start >= split_point:
                 start = split_point

        return chunks

    async def _process_chunk(self, chunk_text: str, chunk_index: int, total_chunks: int) -> List[Dict[str, Any]]:
        """
        Process a single text chunk with the LLM.
        """
        logger.info(f"Processing Chunk {chunk_index+1}/{total_chunks} (Length: {len(chunk_text)} chars)...")
        
        system_prompt = """
        You are an expert linguist and English teacher.
        Your task is to extract useful English "Semantic Modules" from the provided text.
        
        Target Modules:
        1. Collocations
        2. Phrasal Verbs
        3. Idioms/Fixed Expressions
        4. Strong Adjectives
        5. High-Frequency/Key Nouns
        
        IMPORTANT:
        - For each module, provide examples preferably FROM THE TEXT ITSELF.
        - If the text doesn't contain a good example, you may create a natural one.
        - Translate each example sentence into Chinese.
        
        Output purely VALID JSON with this structure:
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
        """

        try:
            response = await self.client.chat.completions.create(
                model="moonshot-v1-8k",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Text Chunk:\n\n{chunk_text}"}
                ],
                response_format={"type": "json_object"},
                timeout=60 # Set timeout to avoid hanging
            )
            
            content = response.choices[0].message.content
            data = json.loads(content)
            modules = data.get("modules", [])
            logger.info(f"Chunk {chunk_index+1} yielded {len(modules)} modules.")
            return modules

        except Exception as e:
            logger.error(f"Error processing chunk {chunk_index+1}: {e}")
            return []

    def _merge_results(self, all_modules: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        Merge results from all chunks and remove duplicates based on the 'module' key.
        """
        merged = {}
        
        # Flatten list
        flat_modules = [m for sublist in all_modules for m in sublist]
        
        for item in flat_modules:
            key = item.get("module", "").lower().strip()
            if not key:
                continue
                
            if key not in merged:
                merged[key] = item
            else:
                # Optional: Merge examples if different? 
                # For MVP, we just keep the first occurrence which is simpler.
                pass
                
        unique_modules = list(merged.values())
        logger.info(f"Merged {len(flat_modules)} raw modules into {len(unique_modules)} unique modules.")
        return unique_modules

    async def extract_modules(self, source_file_path: str) -> str:
        """
        Main entry point: Read -> Clean (using SubtitleCleaner) -> Chunk -> Process (Parallel) -> Merge -> Save.
        Accepts either SRT or TXT file paths.
        """
        source_path = Path(source_file_path)
        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_file_path}")

        # 1. Read & Clean
        if source_path.suffix.lower() == '.srt':
            logger.info(f"Input is SRT. Cleaning first: {source_path}")
            # Use the separated cleaner module
            txt_path = SubtitleCleaner.clean_srt_to_text(str(source_path))
            with open(txt_path, 'r', encoding='utf-8') as f:
                clean_text = f.read()
        else:
            # Assume it's already a text file
            logger.info(f"Input is likely text. Reading directly: {source_path}")
            with open(source_path, 'r', encoding='utf-8') as f:
                clean_text = f.read()
        
        # Remove newlines for chunking processing, or keep them?
        # The cleaner puts each sentence on a new line.
        # For LLM processing, having it as a block or lines is fine.
        # Let's replace newlines with spaces to make chunks continuous text,
        # which is often better for context windows unless line breaks are meaningful structure.
        # clean_text = clean_text.replace('\n', ' ') 
        # Actually, keeping newlines might help the LLM identify sentence boundaries better.
        
        logger.info(f"Cleaned text size: {len(clean_text)} chars.")

        # 2. Chunking
        chunks = self._chunk_text(clean_text)

        logger.info(f"Split text into {len(chunks)} chunks.")

        # 3. Process Chunks (Parallel)
        # We create a list of tasks to run concurrently
        tasks = [self._process_chunk(chunk, i, len(chunks)) for i, chunk in enumerate(chunks)]
        results = await asyncio.gather(*tasks)

        # 4. Merge & Deduplicate
        final_modules = self._merge_results(results)

        # 5. Save
        output_data = {"modules": final_modules}
        output_filename = f"{source_path.stem}_extracted.json"
        output_file_path = self.output_dir / output_filename

        logger.info(f"Saving {len(final_modules)} extracted modules to: {output_file_path}")
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=4, ensure_ascii=False)

        return str(output_file_path.resolve())
