import asyncio
import sys
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from src.downloader import YouTubeDownloader
from src.extractor import SemanticExtractor
from src.generator import AudioGenerator
from src.utils import setup_logging, ensure_dir

# Load environment variables
load_dotenv()

# Configuration
RAW_VIDEOS_DIR = "data/0_raw_videos"
EXTRACTED_JSON_DIR = "data/1_extracted_json"
AUDIO_OUTPUT_DIR = "data/2_audio_output"

async def main():
    # 1. Setup Logging
    setup_logging()
    logger = logging.getLogger("HypnoChunk")
    
    # 2. Command Line Argument Check
    if len(sys.argv) < 2:
        print("\nUsage: python main.py <youtube_url>")
        print("Example: python main.py https://www.youtube.com/watch?v=ow8Zx7eiDvg\n")
        logger.error("No URL provided via command line.")
        return

    video_url = sys.argv[1]
    logger.info(f"HypnoChunk Pipeline Initialized for: {video_url}")

    # 3. Environment Check
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")

    if not api_key or not base_url:
        logger.error("Missing environment variables! Please set OPENAI_API_KEY and OPENAI_BASE_URL in .env")
        return

    # Ensure directories exist
    ensure_dir(RAW_VIDEOS_DIR)
    ensure_dir(EXTRACTED_JSON_DIR)
    ensure_dir(AUDIO_OUTPUT_DIR)

    # ---------------------------------------------------------
    # STEP 1: Download
    # ---------------------------------------------------------
    logger.info("--- Step 1: Download Subtitles ---")
    
    downloader = YouTubeDownloader(output_dir=RAW_VIDEOS_DIR)
    
    try:
        # Note: download_subtitles is synchronous
        srt_path = downloader.download_subtitles(video_url)
        logger.info(f"✅ Subtitles ready at: {srt_path}")
    except Exception as e:
        logger.error(f"❌ Download failed: {e}")
        return

    # ---------------------------------------------------------
    # STEP 2: Extract
    # ---------------------------------------------------------
    logger.info("--- Step 2: Extract Semantic Modules ---")
    
    extractor = SemanticExtractor(api_key=api_key, base_url=base_url)
    
    try:
        # Note: extract_modules is asynchronous, must use await
        json_output_path = await extractor.extract_modules(srt_path)
        logger.info(f"✅ Extraction complete. Data saved to: {json_output_path}")
    except Exception as e:
        logger.error(f"❌ Extraction failed: {e}")
        return

    # ---------------------------------------------------------
    # STEP 3: Generate
    # ---------------------------------------------------------
    logger.info("--- Step 3: Generate Audio ---")
    
    generator = AudioGenerator(output_dir=AUDIO_OUTPUT_DIR)
    
    # Create dynamic filename: [Original_Stem]_learning_audio.mp3
    # json_output_path is like: ".../VideoID.en_extracted.json"
    # We remove "_extracted" and add "_learning_audio.mp3"
    json_stem = Path(json_output_path).stem
    base_name = json_stem.replace("_extracted", "")
    output_filename = f"{base_name}_learning_audio.mp3"

    try:
        final_audio_path = await generator.generate_audio_file(json_output_path, output_filename)
        logger.info(f"🎉 Pipeline Finished! Final Audio: {final_audio_path}")
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        return

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nPipeline stopped by user.")
