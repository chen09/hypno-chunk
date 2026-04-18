import os
import sys
import logging
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Add project root to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.downloader import YouTubeDownloader
from src.transcriber import AudioTranscriber
from src.cleaner import SubtitleCleaner
from src.splitter import FileSplitter

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an expert linguist and English teacher.
Your task is to extract ALL useful English "Semantic Modules" from the provided text.
I need a COMPREHENSIVE extraction. Do not just extract 1 or 2 examples per category. Extract EVERYTHING valuable.

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

def main():
    load_dotenv()
    
    if len(sys.argv) < 2:
        print("Usage: python step1_prepare.py <YOUTUBE_URL>")
        sys.exit(1)

    video_url = sys.argv[1]
    
    # Setup directories - use project root data directory
    # Get project root (parent of pipeline directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    raw_dir = project_root / "data" / "0_raw_videos"
    raw_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # 1. Download Audio
        logger.info("=== Step 1.1: Downloading Audio ===")
        downloader = YouTubeDownloader(output_dir=str(raw_dir))
        # Note: YouTubeDownloader now has download_audio method
        audio_path = downloader.download_audio(video_url)
        logger.info(f"Audio downloaded: {audio_path}")

        # 2. Transcribe to SRT
        logger.info("=== Step 1.2: Transcribing to SRT (Whisper) ===")
        transcriber = AudioTranscriber(model_size="large") # Use 'large' for best quality
        srt_path = transcriber.transcribe_audio(audio_path)
        logger.info(f"SRT generated: {srt_path}")

        # 3. Clean to TXT (Optional now, since user prefers SRT)
        logger.info("=== Step 1.3: Cleaning Text (Reference) ===")
        txt_path = SubtitleCleaner.clean_srt_to_text(srt_path)
        logger.info(f"Clean text generated: {txt_path}")

        # 4. Split SRT
        logger.info("=== Step 1.4: Splitting SRT ===")
        split_files = FileSplitter.split_srt(srt_path, lines_per_chunk=500, overlap_lines=50)
        logger.info(f"Split SRT into {len(split_files)} parts.")

        print("\n" + "="*50)
        print("✅ STEP 1 COMPLETE")
        print("="*50)
        print("Files Ready for Extraction:")
        for idx, fpath in enumerate(split_files):
            print(f"  [{idx+1}] {fpath}")
        
        print("-" * 30)
        print("👉 NEXT ACTION (STEP 2):")
        print("Copy the content of EACH .srt part above ONE BY ONE, and send it to your AI (Cursor/Gemini) with the following Prompt:")
        print("IMPORTANT: Send the Prompt first, then paste the SRT content.")
        print("-" * 30)
        print(SYSTEM_PROMPT)
        print("-" * 30)

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

