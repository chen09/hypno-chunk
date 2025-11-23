import os
import glob
import yt_dlp
import logging

# Configure Logger
logger = logging.getLogger(__name__)

class YouTubeDownloader:
    """
    Wrapper for yt-dlp to download subtitles and audio from YouTube videos.
    """

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def download_subtitles(self, video_url: str) -> str:
        """
        Download subtitles. Prioritizes manual subs, falls back to auto-generated.
        Forces any English variant (en, en-US, en-orig) and converts to .srt.
        """
        # Options for yt-dlp
        ydl_opts = {
            'skip_download': True,      # Only download subtitles, skip video
            'writesubtitles': True,     # Try manual subtitles
            'writeautomaticsub': True,  # Try auto-generated subtitles
            'subtitleslangs': ['en.*'], # Key fix: match all English variants (en-US, en-orig...)
            'subtitlesformat': 'srt',   # Prefer SRT
            'convert_subs': 'srt',      # Force convert to SRT
            'outtmpl': os.path.join(self.output_dir, '%(id)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
        }

        video_id = None
        
        try:
            logger.info(f"Starting subtitle download for: {video_url}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 1. Get video info (no download) to retrieve ID
                info = ydl.extract_info(video_url, download=False)
                video_id = info.get('id')
                
                if not video_id:
                    raise ValueError("Could not retrieve video ID.")

                # 2. Execute download
                ydl.download([video_url])

            # 3. Find the downloaded .srt file
            # yt-dlp generates files like [id].en.srt or [id].en-orig.srt
            search_pattern = os.path.join(self.output_dir, f"{video_id}*.srt")
            found_files = glob.glob(search_pattern)

            if not found_files:
                # Debug: If not found, list directory contents to help troubleshooting
                files_in_dir = os.listdir(self.output_dir)
                logger.error(f"Download finished but file not found. Files in dir: {files_in_dir}")
                raise FileNotFoundError(f"Subtitle file not found for video ID: {video_id}")

            final_path = os.path.abspath(found_files[0])
            logger.info(f"Subtitle downloaded successfully: {final_path}")
            return final_path

        except Exception as e:
            logger.error(f"Subtitle download failed: {str(e)}")
            raise RuntimeError(f"Failed to download subtitles: {str(e)}")

    def download_audio(self, video_url: str) -> str:
        """
        Download audio from YouTube video and convert to MP3.
        """
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(self.output_dir, '%(id)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
        }

        try:
            logger.info(f"Starting audio download for: {video_url}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                video_id = info.get('id')
                
                if not video_id:
                    raise ValueError("Could not retrieve video ID.")
                
                ydl.download([video_url])
            
            # Find the downloaded mp3 file
            search_pattern = os.path.join(self.output_dir, f"{video_id}.mp3")
            found_files = glob.glob(search_pattern)

            if not found_files:
                raise FileNotFoundError(f"Audio file not found for video ID: {video_id}")

            final_path = os.path.abspath(found_files[0])
            logger.info(f"Audio downloaded successfully: {final_path}")
            return final_path

        except Exception as e:
            logger.error(f"Audio download failed: {str(e)}")
            raise RuntimeError(f"Failed to download audio: {str(e)}")
