import os
import sys
import json
import glob
import logging
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Add project root to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.generator import AudioGenerator
from src.translator import JSONTranslator

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def merge_json_parts(input_arg: str, format_type: str = None) -> str:
    """
    Smartly detect if the input is a video ID or a file path.
    If parts (_part1.json, etc.) or chunks (_chunk01.json, etc.) exist, merge them into a single file.
    Returns the path to the file that should be used for generation.
    
    Args:
        input_arg: Video ID or path to JSON file
        format_type: Optional format type - 'part' or 'chunk'. If None, auto-detect both formats.
    """
    # Get project root (parent of pipeline directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    input_path = Path(input_arg)
    json_dir = project_root / "data" / "1_extracted_json"
    
    # Determine Base Name (Video ID)
    if input_path.exists() and input_path.is_file():
        # If user provided a file, try to deduce ID from filename (e.g., id_part1.json -> id, id_chunk01.json -> id)
        base_name = input_path.name.split('_part')[0].split('_chunk')[0].split('_extracted')[0]
        # If the input file itself is not a part/chunk file, just use it
        if "_part" not in input_path.name and "_chunk" not in input_path.name:
            logger.info(f"Using provided file directly: {input_path}")
            return str(input_path)
    else:
        # Assume input_arg is the ID itself
        base_name = input_arg

    # Look for parts/chunks based on format_type parameter
    part_files = []
    if format_type is None:
        # Auto-detect: try both formats
        pattern_part = str(json_dir / f"{base_name}_part*.json")
        pattern_chunk = str(json_dir / f"{base_name}_chunk*.json")
        part_files = sorted(glob.glob(pattern_part) + glob.glob(pattern_chunk))
        if part_files:
            # Determine which format was found
            if any('_part' in f for f in part_files):
                logger.info(f"Auto-detected format: part")
            elif any('_chunk' in f for f in part_files):
                logger.info(f"Auto-detected format: chunk")
    elif format_type.lower() == 'part':
        pattern = str(json_dir / f"{base_name}_part*.json")
        part_files = sorted(glob.glob(pattern))
        logger.info(f"Using format: part")
    elif format_type.lower() == 'chunk':
        pattern = str(json_dir / f"{base_name}_chunk*.json")
        part_files = sorted(glob.glob(pattern))
        logger.info(f"Using format: chunk")
    else:
        logger.error(f"Invalid format_type: {format_type}. Must be 'part' or 'chunk'.")
        sys.exit(1)
    
    if not part_files:
        # No parts found. If input was a file, we returned already. 
        # If input was ID, maybe the merged file exists?
        merged_file = json_dir / f"{base_name}_merged.json"
        if merged_file.exists():
            logger.info(f"Found existing merged file: {merged_file}")
            return str(merged_file)
            
        # Maybe standard extracted file?
        extracted_file = json_dir / f"{base_name}_extracted.json"
        if extracted_file.exists():
            return str(extracted_file)

        logger.error(f"No JSON files found for ID: {base_name}")
        sys.exit(1)

    logger.info(f"Found {len(part_files)} partial JSON files. Merging...")
    
    merged_modules = []
    seen_modules = set()
    seen_examples = set()  # For deduplication when module name is missing
    
    for part_file in part_files:
        try:
            with open(part_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                modules = data.get("modules", [])
                
                for m in modules:
                    # Simple deduplication by module name (case-insensitive)
                    module_name = m.get("module", "").strip().lower()
                    
                    if module_name:
                        # Has module name: deduplicate by module name
                        if module_name not in seen_modules:
                            seen_modules.add(module_name)
                            merged_modules.append(m)
                    else:
                        # No module name: deduplicate by first example's English text
                        examples = m.get("examples", [])
                        if examples and len(examples) > 0:
                            first_example_en = examples[0].get("en", "").strip().lower()
                            if first_example_en and first_example_en not in seen_examples:
                                seen_examples.add(first_example_en)
                                merged_modules.append(m)
                        else:
                            # No examples either, just add it
                            merged_modules.append(m)
                        
        except Exception as e:
            logger.error(f"Error reading {part_file}: {e}")
            continue

    # Save Merged File
    output_merged_path = json_dir / f"{base_name}_merged.json"
    with open(output_merged_path, 'w', encoding='utf-8') as f:
        json.dump({"modules": merged_modules}, f, indent=4, ensure_ascii=False)
    
    logger.info(f"✅ Successfully merged {len(merged_modules)} modules into {output_merged_path}")
    return str(output_merged_path)

import argparse

# ... (existing imports) ...

async def process_generation(input_arg: str, rate_cn: str = None, rate_en_slow: str = None, rate_en_fast: str = None, target_indices: list[int] = None, format_type: str = None):
    # 0. Merge Parts (if any)
    json_path = merge_json_parts(input_arg, format_type=format_type)

    # 1. Translate Examples (Safety Check)
    logger.info("=== Step 3.1: Checking/Translating Examples ===")
    
    # Initialize Translator
    api_key = os.getenv('OPENAI_API_KEY')
    base_url = os.getenv('OPENAI_BASE_URL')
    
    if api_key and base_url:
        translator = JSONTranslator(api_key, base_url)
        # This will return a new path if translated, or original if no need
        processed_json_path = await translator.translate_examples(json_path)
    else:
        logger.warning("Skipping translation check: OPENAI_API_KEY or BASE_URL not set.")
        processed_json_path = json_path

    # 2. Generate Audio
    logger.info(f"=== Step 3.2: Generating Audio from {processed_json_path} ===")
    
    # Get project root (parent of pipeline directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_dir = project_root / "data" / "2_audio_output"
    generator = AudioGenerator(output_dir=output_dir)
    
    # Set Rates if provided
    generator.set_rates(cn=rate_cn, en_slow=rate_en_slow, en_fast=rate_en_fast)
    
    output_filename = f"{Path(processed_json_path).stem}_final.mp3"
    
    final_path = await generator.generate_audio_file(processed_json_path, output_filename, target_indices=target_indices)
    
    print("\n" + "="*50)
    print("✅ STEP 3 COMPLETE")
    print("="*50)
    print(f"📂 Output Directory: {os.path.abspath(output_dir)}")
    print(f"🎵 Full Audio: {final_path}")
    print(f"🧩 Split Modules: {os.path.abspath(output_dir)}/{Path(processed_json_path).stem}_modules/")
    print("="*50)

def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Generate sleep learning audio from JSON.")
    parser.add_argument("input", help="Video ID or path to JSON file")
    parser.add_argument("--format", "-f", choices=['part', 'chunk'], default=None, 
                        help="JSON file format: part or chunk. Auto-detect if not specified")
    parser.add_argument("--cn-speed", default=None, help="Speed for Chinese audio (e.g. +10%%)")
    parser.add_argument("--en-slow", default=None, help="Speed for Slow English audio (e.g. -25%%)")
    parser.add_argument("--en-fast", default=None, help="Speed for Fast English audio (e.g. +5%%)")
    parser.add_argument("--indices", default=None, help="Comma-separated list of module indices to regenerate (e.g. 1,2,5)")
    parser.add_argument("--timeout", type=int, default=None, help="Timeout in seconds (default: no timeout)")
    
    args = parser.parse_args()

    target_indices = None
    if args.indices:
        try:
            target_indices = [int(i.strip()) for i in args.indices.split(',')]
        except ValueError:
            print("Error: --indices must be a comma-separated list of integers.")
            sys.exit(1)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        if args.timeout:
            logger.info(f"Setting timeout: {args.timeout} seconds")
            loop.run_until_complete(asyncio.wait_for(
                process_generation(args.input, args.cn_speed, args.en_slow, args.en_fast, target_indices, format_type=args.format),
                timeout=args.timeout
            ))
        else:
            loop.run_until_complete(process_generation(args.input, args.cn_speed, args.en_slow, args.en_fast, target_indices, format_type=args.format))
    except asyncio.TimeoutError:
        logger.error(f"❌ Generation timed out after {args.timeout} seconds")
        print(f"\n❌ ERROR: Generation timed out after {args.timeout} seconds")
        print("   The process may still be running in the background.")
        print("   Check the output directory for partial files.")
        sys.exit(1)

if __name__ == "__main__":
    main()

