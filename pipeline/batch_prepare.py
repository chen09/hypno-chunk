#!/usr/bin/env python3
"""
批量处理播放列表视频的步骤 1-2（下载和转录）
包含错误处理：下载失败时跳过并记录到 failed_urls.txt
"""
import os
import sys
import logging
import traceback
from pathlib import Path
from datetime import datetime
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

def log_failed_url(url: str, error: str, failed_log_path: Path):
    """记录失败的 URL 到日志文件"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"{url} | {error} | {timestamp}\n"
    with open(failed_log_path, 'a', encoding='utf-8') as f:
        f.write(log_entry)
    logger.error(f"Failed URL logged: {url}")

def process_video(video_url: str, raw_dir: Path, failed_log_path: Path) -> bool:
    """
    处理单个视频：下载音频和转录为 SRT
    
    Returns:
        bool: True if successful, False if failed
    """
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing: {video_url}")
        logger.info(f"{'='*60}")
        
        # 1. Download Audio
        logger.info("=== Step 1.1: Downloading Audio ===")
        downloader = YouTubeDownloader(output_dir=str(raw_dir))
        audio_path = downloader.download_audio(video_url)
        logger.info(f"✅ Audio downloaded: {audio_path}")

        # 2. Transcribe to SRT
        logger.info("=== Step 1.2: Transcribing to SRT (Whisper) ===")
        transcriber = AudioTranscriber(model_size="base")
        srt_path = transcriber.transcribe_audio(audio_path)
        logger.info(f"✅ SRT generated: {srt_path}")

        # 3. Clean to TXT (Optional)
        logger.info("=== Step 1.3: Cleaning Text (Reference) ===")
        txt_path = SubtitleCleaner.clean_srt_to_text(srt_path)
        logger.info(f"✅ Clean text generated: {txt_path}")

        # 4. Split SRT
        logger.info("=== Step 1.4: Splitting SRT ===")
        split_files = FileSplitter.split_srt(srt_path, lines_per_chunk=500, overlap_lines=50)
        logger.info(f"✅ Split SRT into {len(split_files)} parts.")

        logger.info(f"\n✅ SUCCESS: {video_url}")
        logger.info(f"Files ready for extraction:")
        for idx, fpath in enumerate(split_files, 1):
            logger.info(f"  [{idx}] {fpath}")
        
        return True

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        logger.error(f"❌ FAILED: {video_url}")
        logger.error(f"Error: {error_msg}")
        logger.debug(f"Traceback:\n{error_trace}")
        
        # Log to failed_urls.txt
        log_failed_url(video_url, error_msg, failed_log_path)
        return False

def main():
    load_dotenv()
    
    if len(sys.argv) < 2:
        print("Usage: python batch_prepare.py <URLS_FILE>")
        print("Example: python batch_prepare.py ../web/playlist_urls.txt")
        sys.exit(1)

    urls_file = Path(sys.argv[1])
    if not urls_file.exists():
        logger.error(f"URLs file not found: {urls_file}")
        sys.exit(1)

    # Read URLs
    with open(urls_file, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]

    logger.info(f"Found {len(urls)} URLs to process")

    # Setup directories - use project root data directory
    # Get project root (parent of pipeline directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    raw_dir = project_root / "data" / "0_raw_videos"
    raw_dir.mkdir(parents=True, exist_ok=True)
    failed_log_path = raw_dir / "failed_urls.txt"

    # Process each URL
    success_count = 0
    failed_count = 0

    for idx, url in enumerate(urls, 1):
        logger.info(f"\n{'#'*60}")
        logger.info(f"Processing video {idx}/{len(urls)}")
        logger.info(f"{'#'*60}")
        
        if process_video(url, raw_dir, failed_log_path):
            success_count += 1
        else:
            failed_count += 1
            logger.warning(f"Skipping to next video...")

    # Summary
    logger.info(f"\n{'='*60}")
    logger.info(f"BATCH PROCESSING COMPLETE")
    logger.info(f"{'='*60}")
    logger.info(f"✅ Success: {success_count}")
    logger.info(f"❌ Failed: {failed_count}")
    logger.info(f"📝 Failed URLs logged to: {failed_log_path}")

if __name__ == "__main__":
    main()

