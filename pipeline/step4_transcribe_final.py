import os
import sys
import logging
import argparse
from pathlib import Path
from src.transcriber import AudioTranscriber

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Transcribe merged final audio files to SRT.")
    parser.add_argument("--force", action="store_true", help="Force re-transcription even if SRT exists and is newer.")
    args = parser.parse_args()

    # Define paths
    base_dir = Path(__file__).resolve().parent.parent
    audio_output_dir = base_dir / "data" / "2_audio_output"
    
    if not audio_output_dir.exists():
        logger.error(f"Audio output directory not found: {audio_output_dir}")
        return

    # Find all _merged_final.mp3 files
    mp3_files = list(audio_output_dir.glob("*_merged_final.mp3"))
    
    if not mp3_files:
        logger.info("No *_merged_final.mp3 files found to transcribe.")
        return

    # Check which files need transcription
    files_to_process = []
    for mp3_path in mp3_files:
        srt_path = mp3_path.with_suffix(".srt")
        
        should_transcribe = False
        if args.force:
            should_transcribe = True
        elif not srt_path.exists():
            should_transcribe = True
            logger.info(f"SRT missing for {mp3_path.name}")
        elif mp3_path.stat().st_mtime > srt_path.stat().st_mtime:
            should_transcribe = True
            logger.info(f"MP3 is newer than SRT for {mp3_path.name}")
        
        if should_transcribe:
            files_to_process.append(mp3_path)
        else:
            logger.debug(f"Skipping {mp3_path.name} (SRT up to date)")

    if not files_to_process:
        logger.info("All SRT files are up to date. Use --force to re-transcribe.")
        return

    logger.info(f"Found {len(files_to_process)} files to transcribe.")

    # Initialize Transcriber only if there are files to process
    try:
        # You can change model_size to 'small' or 'medium' for better accuracy if needed
        transcriber = AudioTranscriber(model_size="base")
    except Exception as e:
        logger.error(f"Failed to initialize transcriber: {e}")
        return

    # Process files
    for mp3_path in files_to_process:
        try:
            logger.info(f"Transcribing {mp3_path.name}...")
            transcriber.transcribe_audio(str(mp3_path))
            logger.info(f"Completed: {mp3_path.with_suffix('.srt').name}")
        except Exception as e:
            logger.error(f"Failed to transcribe {mp3_path.name}: {e}")

if __name__ == "__main__":
    main()
