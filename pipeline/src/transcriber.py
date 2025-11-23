import os
import logging
from pathlib import Path
import whisper

# Configure Logger
logger = logging.getLogger(__name__)

class AudioTranscriber:
    """
    Uses OpenAI Whisper (local model) to transcribe audio files to SRT format.
    """

    def __init__(self, model_size: str = "base"):
        """
        Initialize the Whisper model.
        
        Args:
            model_size (str): Size of the Whisper model ('tiny', 'base', 'small', 'medium', 'large').
                              'base' is a good balance of speed and accuracy for CPU.
        """
        self.model_size = model_size
        try:
            logger.info(f"Loading Whisper model: {model_size}...")
            self.model = whisper.load_model(model_size)
            logger.info("Whisper model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise

    def _timedelta_to_srt_timestamp(self, seconds: float) -> str:
        """
        Convert seconds (float) to SRT timestamp format (HH:MM:SS,mmm).
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

    def transcribe_audio(self, audio_file_path: str) -> str:
        """
        Transcribe the given audio file and save as SRT.

        Args:
            audio_file_path (str): Path to the input audio file (mp3/wav).

        Returns:
            str: The path to the generated SRT file.
        """
        audio_path = Path(audio_file_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        logger.info(f"Starting transcription for: {audio_path.name}")
        
        try:
            # Run transcription
            result = self.model.transcribe(str(audio_path))
            segments = result.get("segments", [])
            
            # Generate SRT content
            srt_content = []
            for i, segment in enumerate(segments, start=1):
                start = self._timedelta_to_srt_timestamp(segment["start"])
                end = self._timedelta_to_srt_timestamp(segment["end"])
                text = segment["text"].strip()
                
                srt_content.append(f"{i}")
                srt_content.append(f"{start} --> {end}")
                srt_content.append(f"{text}\n")
            
            # Save to SRT file
            output_path = audio_path.with_suffix(".srt")
            # To avoid overwriting the original downloaded subtitle (if it exists), 
            # we might want to append a suffix, but for now we follow the instruction 
            # to just generate SRT.
            # If "videoID.mp3" -> "videoID.srt"
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write("\n".join(srt_content))
            
            logger.info(f"Transcription complete. Saved to: {output_path}")
            return str(output_path.resolve())

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

