import re
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)

class SRTToTextChunker:
    """
    将SRT文件转换为按句号分块的纯文本文件。
    解决YouTube SRT中一个完整句子被分割成多个时间戳条目的问题。
    """

    @staticmethod
    def extract_text_from_srt(srt_file_path: str) -> str:
        """
        从SRT文件中提取所有文本，去掉时间戳和序号。
        合并被分割的句子片段。
        
        Args:
            srt_file_path (str): SRT文件路径
            
        Returns:
            str: 合并后的纯文本
        """
        srt_path = Path(srt_file_path)
        if not srt_path.exists():
            raise FileNotFoundError(f"SRT file not found: {srt_file_path}")

        logger.info(f"Extracting text from SRT: {srt_path}")

        with open(srt_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # 正则表达式匹配时间戳行
        timestamp_pattern = re.compile(r'\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}')
        
        text_parts = []
        
        for line in lines:
            line = line.strip()
            
            # 跳过空行
            if not line:
                continue
                
            # 跳过序号行（纯数字）
            if line.isdigit():
                continue
                
            # 跳过时间戳行
            if timestamp_pattern.match(line):
                continue
            
            # 移除HTML标签
            line = re.sub(r'<[^>]+>', '', line)
            
            if line:
                text_parts.append(line)

        # 合并所有文本片段，用空格连接
        # 这样可以将被分割的句子重新组合
        merged_text = " ".join(text_parts)
        
        # 清理多余的空格
        merged_text = re.sub(r'\s+', ' ', merged_text)
        
        return merged_text.strip()

    @staticmethod
    def split_by_sentences(text: str, max_chunk_size: int = 2000) -> List[str]:
        """
        按照句号（.）分割文本，同时考虑分块大小限制。
        
        Args:
            text (str): 输入文本
            max_chunk_size (int): 每个分块的最大字符数（默认2000，适合LLM处理）
            
        Returns:
            List[str]: 分块后的文本列表
        """
        # 先按句号分割
        sentences = re.split(r'\.\s+', text)
        
        chunks = []
        current_chunk = []
        current_size = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # 确保句子以句号结尾（除了最后一个）
            if not sentence.endswith('.'):
                sentence += '.'
            
            sentence_size = len(sentence)
            
            # 如果当前分块加上新句子会超过限制，保存当前分块
            if current_chunk and current_size + sentence_size + 1 > max_chunk_size:
                chunk_text = ' '.join(current_chunk)
                chunks.append(chunk_text)
                current_chunk = [sentence]
                current_size = sentence_size
            else:
                current_chunk.append(sentence)
                current_size += sentence_size + 1  # +1 for space
        
        # 添加最后一个分块
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append(chunk_text)
        
        return chunks

    @staticmethod
    def srt_to_text_chunks(srt_file_path: str, output_dir: str = None, max_chunk_size: int = 2000) -> List[str]:
        """
        将SRT文件转换为按句号分块的文本文件。
        
        Args:
            srt_file_path (str): 输入SRT文件路径
            output_dir (str): 输出目录（默认与SRT文件同目录）
            max_chunk_size (int): 每个分块的最大字符数
            
        Returns:
            List[str]: 生成的文本文件路径列表
        """
        srt_path = Path(srt_file_path)
        
        # 提取文本
        text = SRTToTextChunker.extract_text_from_srt(srt_file_path)
        logger.info(f"Extracted {len(text)} characters from SRT")
        
        # 按句号分块
        chunks = SRTToTextChunker.split_by_sentences(text, max_chunk_size)
        logger.info(f"Split into {len(chunks)} text chunks")
        
        # 确定输出目录
        if output_dir:
            output_path = Path(output_dir)
        else:
            output_path = srt_path.parent
        
        output_path.mkdir(parents=True, exist_ok=True)
        
        # 保存每个分块
        chunk_files = []
        for idx, chunk in enumerate(chunks, 1):
            chunk_filename = f"{srt_path.stem}_chunk{idx:02d}.txt"
            chunk_file_path = output_path / chunk_filename
            
            with open(chunk_file_path, 'w', encoding='utf-8') as f:
                f.write(chunk)
            
            chunk_files.append(str(chunk_file_path))
            logger.info(f"Saved chunk {idx}: {chunk_filename} ({len(chunk)} chars)")
        
        return chunk_files

