import asyncio
import json
import logging
import random
import hashlib
from pathlib import Path
from io import BytesIO

import edge_tts
from pydub import AudioSegment

# Configure Logger
logger = logging.getLogger(__name__)

FULL_NEWS_PASS_KEYS = (
    "full news pass",
    "full news",
    "news full pass",
    "news intro pass",
)
SCENE_DIALOGUE_KEYS = (
    "scene dialogue block",
    "scene context",
    "drama scene",
    "tv scene",
)


def build_safe_module_filename(module_idx: int, phrase: str, max_phrase_len: int = 96) -> str:
    base_phrase = (phrase or "module").strip()
    safe_phrase = "".join(c for c in base_phrase if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    safe_phrase = safe_phrase or "module"
    if len(safe_phrase) > max_phrase_len:
        digest = hashlib.sha1(safe_phrase.encode("utf-8")).hexdigest()[:10]
        safe_phrase = f"{safe_phrase[:max_phrase_len]}_{digest}"
    return f"{module_idx:03d}-{safe_phrase}"

def build_full_news_pass_chunks(examples: list) -> list[dict]:
    """
    Merge sentence-level examples into coherent paragraph/dialogue chunks.
    This improves continuity for news and scene-based learning content.
    """
    chunks: list[dict] = []
    en_buffer: list[str] = []
    cn_buffer: list[str] = []
    buffer_char_len = 0

    def flush_chunk():
        nonlocal en_buffer, cn_buffer, buffer_char_len
        if not en_buffer:
            return
        chunks.append({
            "en": " ".join(en_buffer).strip(),
            "cn": " ".join(cn_buffer).strip(),
        })
        en_buffer = []
        cn_buffer = []
        buffer_char_len = 0

    for item in examples:
        en_text = ""
        cn_text = ""
        if isinstance(item, str):
            en_text = item.strip()
        elif isinstance(item, dict):
            en_text = str(item.get("en", "")).strip()
            cn_text = str(item.get("cn", "")).strip()

        if not en_text:
            continue

        en_buffer.append(en_text)
        if cn_text:
            cn_buffer.append(cn_text)
        buffer_char_len += len(en_text)

        ends_sentence = en_text.endswith((".", "!", "?", "。", "！", "？", ":", "："))
        should_flush = (
            len(en_buffer) >= 3
            or buffer_char_len >= 220
            or (len(en_buffer) >= 2 and ends_sentence)
        )
        if should_flush:
            flush_chunk()

    flush_chunk()
    return chunks

def build_scene_dialogue_chunks(examples: list) -> list[dict]:
    """
    Merge scene dialogue lines into coherent mini-dialogues.
    Prefer shorter chunks than news so the conversational rhythm is preserved.
    """
    chunks: list[dict] = []
    en_buffer: list[str] = []
    cn_buffer: list[str] = []
    buffer_char_len = 0

    def flush_chunk():
        nonlocal en_buffer, cn_buffer, buffer_char_len
        if not en_buffer:
            return
        chunks.append({
            "en": " ".join(en_buffer).strip(),
            "cn": " ".join(cn_buffer).strip(),
        })
        en_buffer = []
        cn_buffer = []
        buffer_char_len = 0

    for item in examples:
        en_text = ""
        cn_text = ""
        if isinstance(item, str):
            en_text = item.strip()
        elif isinstance(item, dict):
            en_text = str(item.get("en", "")).strip()
            cn_text = str(item.get("cn", "")).strip()

        if not en_text:
            continue

        en_buffer.append(en_text)
        if cn_text:
            cn_buffer.append(cn_text)
        buffer_char_len += len(en_text)

        should_flush = (
            len(en_buffer) >= 4
            or buffer_char_len >= 170
            or (len(en_buffer) >= 2 and en_text.endswith(("?", "!", "？", "！")))
        )
        if should_flush:
            flush_chunk()

    flush_chunk()
    return chunks

class AudioGenerator:
    """
    Wrapper for edge-tts and pydub to generate sleep learning audio files.
    """

    def __init__(self, output_dir: str, voice: str = "en-US-JennyNeural", chinese_voice: str = "zh-CN-XiaoxiaoNeural"):
        """
        Initialize the generator.

        Args:
            output_dir (str): Path to save the generated audio files.
            voice (str): The edge-tts voice for English content.
            chinese_voice (str): The edge-tts voice for Chinese content.
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.voice = voice
        self.chinese_voice = chinese_voice

        # Define Pauses
        self.short_pause = AudioSegment.silent(duration=500)   # 500ms
        self.long_pause = AudioSegment.silent(duration=2000)   # 2000ms
        self.extra_long_pause = AudioSegment.silent(duration=4000) # 4000ms

        # Default Rates
        self.rate_cn = "+10%"
        self.rate_en_slow = "-25%"
        self.rate_en_fast = "+5%"

    def set_rates(self, cn: str = None, en_slow: str = None, en_fast: str = None):
        """
        Set custom speech rates.
        Format should be like "+10%", "-20%", "+0%".
        """
        if cn: self.rate_cn = cn
        if en_slow: self.rate_en_slow = en_slow
        if en_fast: self.rate_en_fast = en_fast
        
        logger.info(f"Speeds set to -> CN: {self.rate_cn}, EN Slow: {self.rate_en_slow}, EN Fast: {self.rate_en_fast}")

    async def _tts_to_pydub_segment(self, text: str, voice: str = None, rate: str = "+0%", retries: int = 3) -> AudioSegment:
        """
        Helper: Convert text to an AudioSegment using edge-tts.
        Includes exponential backoff retry logic for 429 errors.
        """
        if not voice:
            voice = self.voice
        
        for attempt in range(retries + 1):
            try:
                communicate = edge_tts.Communicate(text, voice, rate=rate)
                
                # Capture audio stream in memory
                mp3_data = BytesIO()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        mp3_data.write(chunk["data"])
                
                mp3_data.seek(0)
                
                # Load into pydub
                segment = AudioSegment.from_file(mp3_data, format="mp3")
                return segment
            
            except Exception as e:
                if "429" in str(e) or "Too Many Requests" in str(e) or "WSServerHandshakeError" in str(e):
                    if attempt < retries:
                        wait_time = (2 ** attempt) + random.uniform(0, 1)
                        logger.warning(f"Rate limit hit for text '{text[:20]}...'. Retrying in {wait_time:.2f}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Failed to convert text to audio after {retries} retries: {text}. Error: {e}")
                        return AudioSegment.silent(duration=500)
                else:
                    # For non-rate-limit errors, log and return silent
                    logger.error(f"Failed to convert text to audio: {text}. Error: {e}")
                    return AudioSegment.silent(duration=500)
        
        return AudioSegment.silent(duration=500)

    def _timedelta_to_srt_timestamp(self, seconds: float) -> str:
        """
        Convert seconds (float) to SRT timestamp format (HH:MM:SS,mmm).
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

    async def generate_audio_file(self, json_file_path: str, output_filename: str, target_indices: list[int] = None) -> str:
        """
        Generate a complete MP3 audio file from the extracted JSON modules.
        Also generates individual JSON and MP3 files for each module in a subdirectory.
        Generates a corresponding SRT file with accurate timestamps.
        
        Args:
            target_indices (list[int], optional): List of 1-based indices to process. 
                                                  If provided, ONLY these modules are processed/re-generated.
                                                  The final combined audio will still attempt to include ALL modules 
                                                  (using existing files for non-targeted ones if available).
        """
        json_path = Path(json_file_path)
        if not json_path.exists():
            raise FileNotFoundError(f"JSON file not found: {json_file_path}")

        # Create subdirectory for individual modules
        modules_dir = self.output_dir / f"{json_path.stem}_modules"
        modules_dir.mkdir(parents=True, exist_ok=True)

        # Load JSON Data
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                modules = data.get("modules", [])
        except Exception as e:
            logger.error(f"Failed to read JSON file: {e}")
            raise

        logger.info(f"Starting audio generation for {len(modules)} modules...")
        if target_indices:
            logger.info(f"Targeting specific modules: {target_indices}")
        else:
            logger.info(f"Processing all {len(modules)} modules")
        
        combined_audio = AudioSegment.empty()
        srt_entries = []
        current_time_ms = 0
        
        # We need to collect all module audios to combine them at the end
        # If a module is skipped (not in target_indices), we try to load its existing file.
        
        processed_count = 0
        start_time = asyncio.get_event_loop().time()

        for index, module in enumerate(modules):
            module_idx = index + 1
            phrase = module.get("module", "")
            module_type = str(module.get("type", "") or "")
            module_type_normalized = module_type.strip().lower()
            is_full_news_pass = any(key in module_type_normalized for key in FULL_NEWS_PASS_KEYS)
            is_scene_dialogue = any(key in module_type_normalized for key in SCENE_DIALOGUE_KEYS)
            module_filename_base = build_safe_module_filename(module_idx, phrase)
            module_audio_path = modules_dir / f"{module_filename_base}.mp3"
            module_json_path = modules_dir / f"{module_filename_base}.json"

            # CHECK: Should we process this module?
            should_process = True
            if target_indices is not None:
                if module_idx not in target_indices:
                    should_process = False
            
            module_audio = None

            if should_process:
                processed_count += 1
                meaning = module.get("chinese_meaning", "")
                examples = module.get("examples", [])
                logger.info(f"Processing module {module_idx}/{len(modules)}: {phrase or '(no module name)'} ({len(examples)} examples)")
                
                # --- GENERATE AUDIO ---

                # --- 1. Generate Audio Segments for this Module ---
                current_module_audio = AudioSegment.empty()

                # Helper to append audio and SRT
                async def add_segment(segment_text: str, voice_name: str, speed_rate: str, is_pause: bool = False, pause_duration: int = 0):
                    nonlocal current_module_audio, current_time_ms
                    
                    seg_audio = None
                    if is_pause:
                        seg_audio = AudioSegment.silent(duration=pause_duration)
                        # No SRT entry for silence
                    else:
                        seg_audio = await self._tts_to_pydub_segment(segment_text, voice_name, rate=speed_rate)
                        
                        # Add SRT entry
                        start_time = current_time_ms
                        duration = len(seg_audio)
                        end_time = start_time + duration
                        
                        srt_entries.append({
                            "start": start_time,
                            "end": end_time,
                            "text": segment_text
                        })
                    
                    current_module_audio += seg_audio
                    # current_time_ms is tracked globally for the combined file, 
                    # BUT we are building module audio locally first.
                    # Actually, we need to track 'local' time for the module if we were exporting module SRTs,
                    # but here we are building the main SRT.
                    # Wait, the main loop appends `current_module_audio` to `combined_audio` at the END.
                    # So we shouldn't increment `current_time_ms` here yet?
                    # NO. If we want correct timestamps for the FINAL file, we need to know the start time of this module in the final file.
                    # But we haven't processed previous modules if they were skipped!
                    #
                    # REFACTOR STRATEGY:
                    # We build `current_module_audio` completely first.
                    # THEN we measure its length.
                    # BUT we want internal timestamps.
                    #
                    # Solution: Track internal offsets relative to the start of the module.
                    # When combining, adjust all offsets by the module's start time in the final file.
                    return seg_audio

                # Temporary list to store relative SRT entries for this module
                module_srt_entries = []
                module_offset_ms = 0

                async def add_module_segment(text, v, r, is_p=False, p_dur=0):
                    nonlocal current_module_audio, module_offset_ms
                    seg = None
                    if is_p:
                        seg = AudioSegment.silent(duration=p_dur)
                    else:
                        seg = await self._tts_to_pydub_segment(text, v, rate=r)
                        if text: # Only add subtitle if there is text
                            module_srt_entries.append({
                                "start_offset": module_offset_ms,
                                "end_offset": module_offset_ms + len(seg),
                                "text": text
                            })
                    
                    current_module_audio += seg
                    module_offset_ms += len(seg)
                    return seg

                # 1. Module Name (EN) - only if exists
                if phrase:
                    await add_module_segment(phrase, self.voice, "+0%")
                    await add_module_segment("", "", "", is_p=True, p_dur=500) # Short pause

                # 2. Chinese Meaning (CN) - only if exists
                if meaning:
                    await add_module_segment(meaning, self.chinese_voice, "+0%")
                    await add_module_segment("", "", "", is_p=True, p_dur=2000) # Long pause

                # 3-5. Examples:
                # Default: EN Slow -> CN Translation -> EN Fast
                # Full News Pass: EN Normal -> CN Translation -> EN Slow Review
                if is_full_news_pass:
                    learning_units = build_full_news_pass_chunks(examples)
                elif is_scene_dialogue:
                    learning_units = build_scene_dialogue_chunks(examples)
                else:
                    learning_units = examples
                total_units = len(learning_units)

                for i, unit in enumerate(learning_units):
                    en_text = ""
                    cn_text = ""

                    if isinstance(unit, str):
                        en_text = unit
                    elif isinstance(unit, dict):
                        en_text = str(unit.get("en", "")).strip()
                        cn_text = str(unit.get("cn", "")).strip()
                    else:
                        continue

                    if not en_text:
                        continue

                    if is_full_news_pass:
                        # News full pass flow requested by product:
                        # EN Normal -> CN Translation -> EN Slow Review
                        await add_module_segment(en_text, self.voice, "+0%")
                        await add_module_segment("", "", "", is_p=True, p_dur=500)
                        if cn_text:
                            await add_module_segment(cn_text, self.chinese_voice, self.rate_cn)
                            await add_module_segment("", "", "", is_p=True, p_dur=500)
                        await add_module_segment(en_text, self.voice, self.rate_en_slow)
                    elif is_scene_dialogue:
                        # Scene dialogue flow:
                        # EN normal (context) -> CN translation -> EN normal review
                        await add_module_segment(en_text, self.voice, "+0%")
                        await add_module_segment("", "", "", is_p=True, p_dur=500)
                        if cn_text:
                            await add_module_segment(cn_text, self.chinese_voice, self.rate_cn)
                            await add_module_segment("", "", "", is_p=True, p_dur=500)
                        await add_module_segment(en_text, self.voice, "+0%")
                    else:
                        # Default learning flow:
                        # EN Slow -> CN Translation -> EN Fast
                        await add_module_segment(en_text, self.voice, self.rate_en_slow)
                        await add_module_segment("", "", "", is_p=True, p_dur=500)
                        if cn_text:
                            await add_module_segment(cn_text, self.chinese_voice, self.rate_cn)
                            await add_module_segment("", "", "", is_p=True, p_dur=500)
                        await add_module_segment(en_text, self.voice, self.rate_en_fast)

                    if i < total_units - 1:
                        await add_module_segment("", "", "", is_p=True, p_dur=2000)
                    else:
                        await add_module_segment("", "", "", is_p=True, p_dur=500)

                    if (i + 1) % 10 == 0 or (i + 1) == total_units:
                        logger.info(f"  Unit progress: {i+1}/{total_units} units processed")
                
                # 6. Module Name (EN) - only if exists (重复模块名)
                if phrase:
                    await add_module_segment(phrase, self.voice, "+0%")
                    await add_module_segment("", "", "", is_p=True, p_dur=4000)

                # Save Individual Files
                module_duration_sec = len(current_module_audio) / 1000.0
                logger.info(f"  Saving module audio ({module_duration_sec:.1f}s) to {module_audio_path.name}")
                current_module_audio.export(module_audio_path, format="mp3")
                with open(module_json_path, 'w', encoding='utf-8') as f:
                    json.dump(module, f, indent=4, ensure_ascii=False)
                
                module_audio = current_module_audio
                logger.info(f"✓ Module {module_idx}/{len(modules)} completed ({module_duration_sec:.1f}s)")
                
                # Save module SRT entries for later global adjustment
                # We can also attach them to the module object if we wanted to save individual SRTs
                module['srt_offsets'] = module_srt_entries

            else:
                # SKIP PROCESSING, TRY TO LOAD EXISTING
                if module_audio_path.exists():
                    # logger.info(f"Skipping {module_idx}, loading existing audio.")
                    try:
                        module_audio = AudioSegment.from_file(module_audio_path, format="mp3")
                        # If we skip processing, we lose the fine-grained SRT for this module 
                        # unless we saved it previously or re-calculate it.
                        # For now, we will just add a generic SRT entry for the whole module duration if we can't find details.
                        module_srt_entries = [{
                            "start_offset": 0,
                            "end_offset": len(module_audio),
                            "text": f"{phrase} (Full Module)"
                        }]
                    except Exception as e:
                        logger.error(f"Failed to load existing audio for skipped module {module_idx}: {e}")
                        module_audio = AudioSegment.silent(duration=1000)
                        module_srt_entries = []
                else:
                    logger.warning(f"Skipped module {module_idx} has no existing audio file at {module_audio_path}. It will be silent in the final mix.")
                    module_audio = AudioSegment.silent(duration=1000)
                    module_srt_entries = []

            # Append to combined
            if module_audio:
                # Add adjusted SRT entries to global list
                start_time_base = len(combined_audio) # Current length is the start time for new segment
                
                for entry in module_srt_entries:
                    srt_entries.append({
                        "start": start_time_base + entry["start_offset"],
                        "end": start_time_base + entry["end_offset"],
                        "text": entry["text"]
                    })

                combined_audio += module_audio

        # Save Final Combined File
        output_path = self.output_dir / output_filename
        logger.info(f"Exporting final audio to: {output_path}")
        
        try:
            combined_audio.export(output_path, format="mp3")
            
            # Generate SRT Content
            srt_file_content = []
            for i, entry in enumerate(srt_entries, 1):
                start_str = self._timedelta_to_srt_timestamp(entry["start"] / 1000.0)
                end_str = self._timedelta_to_srt_timestamp(entry["end"] / 1000.0)
                srt_file_content.append(f"{i}")
                srt_file_content.append(f"{start_str} --> {end_str}")
                srt_file_content.append(f"{entry['text']}\n")
            
            srt_path = output_path.with_suffix(".srt")
            with open(srt_path, "w", encoding="utf-8") as f:
                f.write("\n".join(srt_file_content))
            logger.info(f"SRT export successful: {srt_path}")

            logger.info("Audio export successful.")
            return str(output_path.resolve())
        except Exception as e:
            logger.error(f"Failed to export audio file: {e}")
            raise
