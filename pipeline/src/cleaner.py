import os
import re
import logging
from pathlib import Path

# Configure Logger
logger = logging.getLogger(__name__)

class SubtitleCleaner:
    """
    Utilities for cleaning and preprocessing subtitle files (SRT) into plain text.
    """

    @staticmethod
    def clean_srt_to_text(srt_file_path: str) -> str:
        """
        Reads an SRT file, removes timestamps and indices, deduplicates consecutive lines,
        and saves the clean text to a new file with the suffix '_cleaned.txt'.

        Args:
            srt_file_path (str): Path to the input .srt file.

        Returns:
            str: Path to the generated clean text file.
        """
        srt_path = Path(srt_file_path)
        if not srt_path.exists():
            raise FileNotFoundError(f"SRT file not found: {srt_file_path}")

        logger.info(f"Cleaning SRT file: {srt_path}")

        try:
            with open(srt_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            logger.error(f"Failed to read file {srt_path}: {e}")
            raise

        cleaned_lines = []
        
        # Regex to identify timestamp lines (e.g., "00:00:00,080 --> 00:00:03,560")
        timestamp_pattern = re.compile(r'\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}')
        
        last_line = ""

        for line in lines:
            line = line.strip()
            
            # 1. Skip empty lines
            if not line:
                continue
                
            # 2. Skip numeric-only lines (SRT indices like 306, 307)
            if line.isdigit():
                continue
                
            # 3. Skip timestamp lines
            if timestamp_pattern.match(line):
                continue
            
            # 4. Simple cleaning of HTML tags sometimes present in SRT (e.g. <i>...</i>)
            line = re.sub(r'<[^>]+>', '', line)

            # 5. Deduplication: Skip if identical to the last added line
            if line == last_line:
                continue
            
            cleaned_lines.append(line)
            last_line = line

        # Generate output filename
        output_path = srt_path.with_suffix('.txt')
        # Optional: add a suffix like '_cleaned.txt' to distinguish, or just use .txt
        # output_path = srt_path.parent / f"{srt_path.stem}_cleaned.txt"
        
        # Join into a text block (one sentence per line for readability in the txt file)
        clean_content = "\n".join(cleaned_lines)
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(clean_content)
            logger.info(f"Cleaned text saved to: {output_path}")
            return str(output_path.resolve())
        except Exception as e:
            logger.error(f"Failed to save cleaned text: {e}")
            raise

