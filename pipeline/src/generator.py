import asyncio
import json
import logging
import random
import hashlib
import re
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
NEWS_READING_MAX_EN_CHARS = 98
NEWS_READING_MAX_CN_CHARS = 52
NEWS_READING_SEGMENT_PAUSE_MS = 180


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


def split_text_for_sentence_subtitles(text: str, is_chinese: bool = False) -> list[str]:
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    if not normalized:
        return []

    if is_chinese:
        parts = _split_chinese_sentences(normalized)
    else:
        parts = _split_english_sentences(normalized)

    segments = [p.strip() for p in parts if p and p.strip()]
    return segments or [normalized]


def split_news_reading_pairs(en_text: str, cn_text: str) -> list[dict]:
    """
    Split long-form news reading into mobile-sized bilingual display units.

    Full News Pass audio still speaks English only. These pairs keep the
    written Chinese explanation close to the current English cue, so phone
    readers do not see a long English block with the translation below the fold.
    """
    en_sentences = split_text_for_sentence_subtitles(en_text, is_chinese=False)
    cn_sentences = split_text_for_sentence_subtitles(cn_text, is_chinese=True) if cn_text else []
    aligned_cn_sentences = align_translation_segments(en_sentences, cn_sentences)
    pairs: list[dict] = []

    for en_sentence, cn_sentence in zip(en_sentences, aligned_cn_sentences):
        en_parts = _split_long_english_for_reading(en_sentence)
        cn_parts = _split_long_chinese_for_reading(cn_sentence, min_segments=len(en_parts)) if cn_sentence else []
        aligned_cn_parts = align_translation_segments(en_parts, cn_parts)

        for en_part, cn_part in zip(en_parts, aligned_cn_parts):
            pairs.append({"en": en_part, "cn": cn_part})

    return pairs


def align_translation_segments(en_segments: list[str], cn_segments: list[str]) -> list[str]:
    """
    Align written Chinese translations to spoken English subtitle segments.

    The audio timeline follows English only for Full News Pass content. Chinese is
    metadata for display, so mismatched segmentation should never introduce spoken
    CN timing drift. If Chinese has extra sentences, attach the overflow to the
    last English segment; if it has fewer, leave the remaining translations empty.
    """
    if not en_segments:
        return []
    if not cn_segments:
        return [""] * len(en_segments)
    if len(en_segments) == len(cn_segments):
        return cn_segments

    aligned = cn_segments[: len(en_segments)]
    if len(cn_segments) > len(en_segments):
        overflow_start = max(len(en_segments) - 1, 0)
        aligned = cn_segments[:overflow_start]
        aligned.append(" ".join(cn_segments[overflow_start:]).strip())

    while len(aligned) < len(en_segments):
        aligned.append("")

    return aligned


ABBREVIATION_DOT = "∯"
COMMON_ENGLISH_ABBREVIATIONS = (
    "U.S.",
    "U.K.",
    "U.N.",
    "E.U.",
    "Adm.",
    "Capt.",
    "Col.",
    "Dr.",
    "Gen.",
    "Gov.",
    "Jr.",
    "Ltd.",
    "Mr.",
    "Mrs.",
    "Ms.",
    "No.",
    "Prof.",
    "Rep.",
    "Rev.",
    "Sen.",
    "Sr.",
    "St.",
    "vs.",
    "etc.",
    "e.g.",
    "i.e.",
    "a.m.",
    "p.m.",
)


def _split_english_sentences(text: str) -> list[str]:
    protected = _protect_english_abbreviations(text)
    parts: list[str] = []
    start = 0

    # Include closing quotes in the boundary match, e.g. `sea.” The action...`.
    for match in re.finditer(r"[.!?][\"'”’]?\s+(?=(?:[\"'“‘(\[]?[A-Z]))", protected):
        end = match.end()
        part = protected[start:end].strip()
        if part:
            parts.append(_restore_english_abbreviations(part))
        start = end

    tail = protected[start:].strip()
    if tail:
        parts.append(_restore_english_abbreviations(tail))

    return parts or [text]


def _split_chinese_sentences(text: str) -> list[str]:
    parts: list[str] = []
    start = 0

    for match in re.finditer(r"[。！？；][\"'”’」』）)]?\s*", text):
        end = match.end()
        part = text[start:end].strip()
        if part:
            parts.append(part)
        start = end

    tail = text[start:].strip()
    if tail:
        parts.append(tail)

    return parts or [text]


def _split_long_english_for_reading(text: str, max_chars: int = NEWS_READING_MAX_EN_CHARS) -> list[str]:
    sentences = _split_english_sentences(text)
    segments: list[str] = []

    for sentence in sentences:
        if len(sentence) <= max_chars:
            segments.append(sentence)
            continue

        clause_parts = _split_by_regex(sentence, r"(?<=[,;:])\s+|(?<=—)\s+")
        clause_segments = _pack_segments(clause_parts, max_chars=max_chars, separator=" ")

        for segment in clause_segments:
            if len(segment) <= max_chars:
                segments.append(segment)
                continue

            soft_parts = _split_by_regex(
                segment,
                r"\s+(?=(?:while|and|but|because|since|after|before|when|as|including|unless|entering|leaving)\b)",
                flags=re.IGNORECASE,
            )
            soft_segments = _pack_segments(soft_parts, max_chars=max_chars, separator=" ")

            for soft_segment in soft_segments:
                if len(soft_segment) <= max_chars:
                    segments.append(soft_segment)
                else:
                    segments.extend(_split_words_by_limit(soft_segment, max_chars=max_chars))

    return [segment for segment in segments if segment]


def _split_long_chinese_for_reading(
    text: str,
    max_chars: int = NEWS_READING_MAX_CN_CHARS,
    min_segments: int = 1,
) -> list[str]:
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    if not normalized:
        return []

    sentence_parts = [part for part in _split_chinese_sentences(normalized) if part.strip()]
    segments: list[str] = []

    for sentence in sentence_parts:
        sentence = sentence.strip()
        if len(sentence) <= max_chars:
            segments.append(sentence)
            continue

        clause_parts = _split_by_regex(sentence, r"(?<=[，、：；])\s*")
        clause_segments = _pack_segments(clause_parts, max_chars=max_chars, separator="")
        for segment in clause_segments:
            if len(segment) <= max_chars:
                segments.append(segment)
            else:
                segments.extend(_split_cjk_by_limit(segment, max_chars=max_chars))

    if min_segments > 1 and 0 < len(segments) < min_segments and len(normalized) >= min_segments * 8:
        segments = _split_cjk_by_target_count(normalized, min_segments)

    return [segment for segment in segments if segment]


def _split_by_regex(text: str, pattern: str, flags: int = 0) -> list[str]:
    return [part.strip() for part in re.split(pattern, text) if part and part.strip()]


def _pack_segments(parts: list[str], max_chars: int, separator: str) -> list[str]:
    packed: list[str] = []
    current = ""

    for part in parts:
        if not current:
            current = part
            continue

        candidate = f"{current}{separator}{part}" if separator else f"{current}{part}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            packed.append(current)
            current = part

    if current:
        packed.append(current)

    return packed


def _split_words_by_limit(text: str, max_chars: int) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []

    for word in text.split():
        candidate = " ".join(current + [word])
        if current and len(candidate) > max_chars:
            chunks.append(" ".join(current))
            current = [word]
        else:
            current.append(word)

    if current:
        chunks.append(" ".join(current))

    return chunks or [text]


def _split_cjk_by_limit(text: str, max_chars: int) -> list[str]:
    return [text[i : i + max_chars].strip() for i in range(0, len(text), max_chars) if text[i : i + max_chars].strip()]


def _split_cjk_by_target_count(text: str, target_count: int) -> list[str]:
    chunks: list[str] = []
    remaining = text.strip()

    for index in range(target_count - 1):
        if not remaining:
            break
        target_len = max(1, round(len(remaining) / (target_count - index)))
        window = remaining[: min(len(remaining), target_len + 12)]
        break_positions = [window.rfind(mark) for mark in ("。", "！", "？", "；", "，", "、", "：")]
        split_at = max(break_positions)
        if split_at < max(6, int(target_len * 0.45)):
            split_at = min(target_len, len(remaining) - 1)

        chunk = remaining[: split_at + 1].strip()
        if chunk:
            chunks.append(chunk)
        remaining = remaining[split_at + 1 :].strip()

    if remaining:
        chunks.append(remaining)

    return chunks


def _protect_english_abbreviations(text: str) -> str:
    protected = text

    for abbreviation in COMMON_ENGLISH_ABBREVIATIONS:
        pattern = re.compile(re.escape(abbreviation), re.IGNORECASE)
        protected = pattern.sub(lambda match: match.group(0).replace(".", ABBREVIATION_DOT), protected)

    protected = re.sub(
        r"\b(?:[A-Z]\.){2,}",
        lambda match: match.group(0).replace(".", ABBREVIATION_DOT),
        protected,
    )
    return protected


def _restore_english_abbreviations(text: str) -> str:
    return text.replace(ABBREVIATION_DOT, ".")


def _is_retryable_tts_error(error: Exception) -> bool:
    message = str(error)
    retryable_markers = (
        "429",
        "500",
        "502",
        "503",
        "504",
        "Too Many Requests",
        "Invalid response status",
        "Cannot connect to host",
        "nodename nor servname provided",
        "Server disconnected",
        "TimeoutError",
        "WSServerHandshakeError",
    )
    return any(marker in message for marker in retryable_markers)

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

    async def _tts_to_pydub_segment(self, text: str, voice: str = None, rate: str = "+0%", retries: int = 5) -> AudioSegment:
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
                if _is_retryable_tts_error(e):
                    if attempt < retries:
                        wait_time = (2 ** attempt) + random.uniform(0, 1)
                        logger.warning(f"Retryable TTS error for text '{text[:20]}...'. Retrying in {wait_time:.2f}s... Error: {e}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Failed to convert text to audio after {retries} retries: {text}. Error: {e}")
                        return AudioSegment.silent(duration=500)
                else:
                    # For non-rate-limit errors, log and return silent
                    logger.error(f"Failed to convert text to audio: {text}. Error: {e}")
                    return AudioSegment.silent(duration=500)
        
        return AudioSegment.silent(duration=500)

    async def _tts_to_pydub_with_words(
        self, text: str, voice: str = None, rate: str = "+0%", retries: int = 5
    ) -> tuple:
        """
        Like _tts_to_pydub_segment but also captures WordBoundary events from the TTS stream.

        Returns (AudioSegment, list[dict]) where each dict has:
          {"text": str, "start_offset_ms": float, "end_offset_ms": float}
        The offsets are relative to the start of this TTS call (0-based milliseconds).
        """
        if not voice:
            voice = self.voice

        for attempt in range(retries + 1):
            try:
                communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
                mp3_data = BytesIO()
                word_boundaries: list = []

                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        mp3_data.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        # edge-tts offset/duration are in 100-nanosecond ticks
                        start_ms = chunk["offset"] / 10_000
                        end_ms = (chunk["offset"] + chunk["duration"]) / 10_000
                        word_boundaries.append({
                            "text": chunk.get("text", ""),
                            "start_offset_ms": start_ms,
                            "end_offset_ms": end_ms,
                        })

                mp3_data.seek(0)
                segment = AudioSegment.from_file(mp3_data, format="mp3")
                return segment, word_boundaries

            except Exception as e:
                if _is_retryable_tts_error(e):
                    if attempt < retries:
                        wait_time = (2 ** attempt) + random.uniform(0, 1)
                        logger.warning(f"Retryable TTS error for '{text[:20]}...'. Retrying in {wait_time:.2f}s... Error: {e}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Failed after {retries} retries: {text}. Error: {e}")
                        return AudioSegment.silent(duration=500), []
                else:
                    logger.error(f"Failed to convert text to audio: {text}. Error: {e}")
                    return AudioSegment.silent(duration=500), []

        return AudioSegment.silent(duration=500), []

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
        bilingual_entries = []
        words_entries: list = []
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
                module_bilingual_entries = []
                module_word_entries: list = []
                module_offset_ms = 0

                async def add_module_segment(text, v, r, is_p=False, p_dur=0):
                    nonlocal current_module_audio, module_offset_ms
                    seg = None
                    subtitle_entry = None
                    if is_p:
                        seg = AudioSegment.silent(duration=p_dur)
                    else:
                        is_english = bool(v) and v != self.chinese_voice
                        if is_english:
                            seg, word_bounds = await self._tts_to_pydub_with_words(text, v, rate=r)
                            for wb in word_bounds:
                                module_word_entries.append({
                                    "start_offset": module_offset_ms + wb["start_offset_ms"],
                                    "end_offset": module_offset_ms + wb["end_offset_ms"],
                                    "text": wb["text"],
                                })
                        else:
                            seg = await self._tts_to_pydub_segment(text, v, rate=r)
                        if text: # Only add subtitle if there is text
                            subtitle_entry = {
                                "start_offset": module_offset_ms,
                                "end_offset": module_offset_ms + len(seg),
                                "text": text
                            }
                            module_srt_entries.append(subtitle_entry)
                    
                    current_module_audio += seg
                    module_offset_ms += len(seg)
                    return subtitle_entry

                async def add_module_sentence_synced(text: str, voice_name: str, speed_rate: str):
                    is_cn_voice = voice_name == self.chinese_voice
                    segments = split_text_for_sentence_subtitles(text, is_chinese=is_cn_voice)
                    if len(segments) <= 1:
                        await add_module_segment(text, voice_name, speed_rate)
                        return
                    for seg_idx, seg_text in enumerate(segments):
                        await add_module_segment(seg_text, voice_name, speed_rate)
                        if seg_idx < len(segments) - 1:
                            # Keep paragraph feel in audio while enabling sentence-level subtitle sync.
                            await add_module_segment("", "", "", is_p=True, p_dur=120)

                async def add_news_sentence_pairs(en_text: str, cn_text: str):
                    """
                    Full-news reading mode.
                    Speak English only. Keep Chinese as display metadata aligned to
                    the English subtitle timing, so reading pages can show bilingual
                    subtitles without changing the audio timeline.
                    """
                    reading_pairs = split_news_reading_pairs(en_text, cn_text)

                    for pair in reading_pairs:
                        en_seg = pair["en"]
                        cn_seg = pair["cn"]
                        subtitle_entry = await add_module_segment(en_seg, self.voice, "+0%")
                        if subtitle_entry:
                            module_bilingual_entries.append({
                                "start_offset": subtitle_entry["start_offset"],
                                "end_offset": subtitle_entry["end_offset"],
                                "en": en_seg,
                                "cn": cn_seg,
                            })
                        await add_module_segment("", "", "", is_p=True, p_dur=NEWS_READING_SEGMENT_PAUSE_MS)

                # 1. Module Name (EN) - only if exists
                should_read_module_heading = not is_full_news_pass

                if phrase and should_read_module_heading:
                    await add_module_segment(phrase, self.voice, "+0%")
                    await add_module_segment("", "", "", is_p=True, p_dur=500) # Short pause

                # 2. Chinese Meaning (CN) - only if exists
                if meaning and should_read_module_heading:
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
                        # Full article/news mode: speak English once, display bilingual reading cues.
                        await add_news_sentence_pairs(en_text, cn_text)
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
                if phrase and should_read_module_heading:
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
                module['srt_offsets'] = module_srt_entries
                module['word_offsets'] = module_word_entries

            else:
                # SKIP PROCESSING, TRY TO LOAD EXISTING
                module_word_entries = []
                module_bilingual_entries = []
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

                for entry in module_word_entries:
                    words_entries.append({
                        "start": start_time_base + entry["start_offset"],
                        "end": start_time_base + entry["end_offset"],
                        "text": entry["text"],
                    })

                for entry in module_bilingual_entries:
                    bilingual_entries.append({
                        "start": start_time_base + entry["start_offset"],
                        "end": start_time_base + entry["end_offset"],
                        "en": entry["en"],
                        "cn": entry["cn"],
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

            if words_entries:
                words_path = output_path.with_suffix(".words.json")
                with open(words_path, "w", encoding="utf-8") as f:
                    json.dump(words_entries, f, ensure_ascii=False)
                logger.info(f"Words JSON export successful: {words_path} ({len(words_entries)} entries)")

            if bilingual_entries:
                bilingual_path = output_path.with_suffix(".bilingual.json")
                bilingual_payload = [
                    {
                        "id": i,
                        "startTime": entry["start"] / 1000.0,
                        "endTime": entry["end"] / 1000.0,
                        "en": entry["en"],
                        "cn": entry["cn"],
                    }
                    for i, entry in enumerate(bilingual_entries, 1)
                ]
                with open(bilingual_path, "w", encoding="utf-8") as f:
                    json.dump(bilingual_payload, f, ensure_ascii=False, indent=2)
                logger.info(
                    f"Bilingual subtitle JSON export successful: {bilingual_path} "
                    f"({len(bilingual_payload)} entries)"
                )

            logger.info("Audio export successful.")
            return str(output_path.resolve())
        except Exception as e:
            logger.error(f"Failed to export audio file: {e}")
            raise
