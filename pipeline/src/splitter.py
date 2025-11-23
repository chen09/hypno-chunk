import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)

class FileSplitter:
    """
    Helper class to split text-based files (SRT, TXT) into smaller chunks with overlap.
    """

    @staticmethod
    def split_srt(file_path: str, lines_per_chunk: int = 500, overlap_lines: int = 50) -> List[str]:
        """
        Splits an SRT file into multiple smaller SRT files intelligently.
        It parses the file into 'subtitle blocks' to ensure no block is cut in the middle.
        
        Args:
            file_path (str): Path to the source SRT file.
            lines_per_chunk (int): Approximate target lines per chunk.
            overlap_lines (int): Approximate number of lines to overlap between chunks.
            
        Returns:
            List[str]: List of file paths for the generated chunks.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            raw_content = f.read()

        # Split by double newlines to get blocks (rough parsing)
        # Standard SRT separates blocks by a blank line.
        # Warning: Some SRTs might have multiple blank lines or irregular spacing.
        # Using regex or simple split might be better.
        # Let's stick to line-based parsing to be robust against file quirks.
        
        lines = raw_content.splitlines(keepends=True)
        blocks = []
        current_block = []
        
        for line in lines:
            current_block.append(line)
            # A block usually ends with an empty line (just newline char)
            if line.strip() == "":
                blocks.append("".join(current_block))
                current_block = []
        
        if current_block:
            blocks.append("".join(current_block))

        total_blocks = len(blocks)
        logger.info(f"Parsed {total_blocks} subtitle blocks from {file_path}")

        # Calculate approximate blocks per chunk
        # Average lines per block is roughly 3-4.
        avg_lines_per_block = len(lines) / total_blocks if total_blocks > 0 else 4
        blocks_per_chunk = int(lines_per_chunk / avg_lines_per_block)
        blocks_overlap = int(overlap_lines / avg_lines_per_block)
        
        # Ensure at least 1 block
        blocks_per_chunk = max(1, blocks_per_chunk)
        blocks_overlap = max(0, blocks_overlap)

        chunks_paths = []
        current_idx = 0
        part_num = 1

        while current_idx < total_blocks:
            end_idx = min(current_idx + blocks_per_chunk, total_blocks)
            
            chunk_blocks = blocks[current_idx:end_idx]
            chunk_content = "".join(chunk_blocks)
            
            chunk_filename = f"{path.stem}_part{part_num}{path.suffix}"
            chunk_path = path.parent / chunk_filename
            
            with open(chunk_path, 'w', encoding='utf-8') as out:
                out.write(chunk_content)
            
            chunks_paths.append(str(chunk_path))
            logger.info(f"Created chunk {part_num}: {chunk_filename} (Blocks {current_idx+1}-{end_idx})")

            if end_idx == total_blocks:
                break

            # Move start pointer, keeping overlap
            current_idx = end_idx - blocks_overlap
            part_num += 1

        return chunks_paths

