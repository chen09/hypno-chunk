#!/usr/bin/env python3
"""
将SRT文件转换为按句号分块的文本文件。
用于处理YouTube下载的SRT文件，解决一个完整句子被分割成多个时间戳条目的问题。

用法:
    python step1_srt_to_text_chunks.py <SRT_FILE_PATH>
    python step1_srt_to_text_chunks.py data/0_raw_videos/0uUUCUguXrM.srt
"""

import os
import sys
import logging
from pathlib import Path

# Add project root to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.srt_to_text_chunks import SRTToTextChunker

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    if len(sys.argv) < 2:
        print("Usage: python step1_srt_to_text_chunks.py <SRT_FILE_PATH>")
        print("Example: python step1_srt_to_text_chunks.py data/0_raw_videos/0uUUCUguXrM.srt")
        sys.exit(1)

    srt_file_path = sys.argv[1]
    
    if not Path(srt_file_path).exists():
        logger.error(f"SRT file not found: {srt_file_path}")
        sys.exit(1)
    
    try:
        logger.info("="*60)
        logger.info("Converting SRT to Text Chunks")
        logger.info("="*60)
        
        # 转换SRT为文本分块
        chunk_files = SRTToTextChunker.srt_to_text_chunks(
            srt_file_path,
            max_chunk_size=2000  # 每个分块最多2000字符，适合LLM处理
        )
        
        print("\n" + "="*60)
        print("✅ CONVERSION COMPLETE")
        print("="*60)
        print(f"Generated {len(chunk_files)} text chunks:")
        for idx, chunk_file in enumerate(chunk_files, 1):
            print(f"  [{idx}] {chunk_file}")
        
        print("\n" + "-"*60)
        print("👉 NEXT ACTION:")
        print("For each chunk file above:")
        print("1. Open the chunk file")
        print("2. Copy its content")
        print("3. Send to LLM with Type 2 Prompt (Common Expressions)")
        print("4. Save the JSON output to data/1_extracted_json/<VIDEO_ID>_chunk<NN>.json")
        print("\nType 2 Prompt is in PROMPT_GUIDE.md")
        print("="*60)
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

