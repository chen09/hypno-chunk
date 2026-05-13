export interface SubtitleEntry {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface WordEntry {
  text: string;
  start: number;
  end: number;
}

export type SubtitleLanguage = 'en' | 'zh' | 'other';

export interface BilingualSegment {
  id: string;
  startTime: number;
  endTime: number;
  english?: SubtitleEntry;
  chinese?: SubtitleEntry;
  other?: SubtitleEntry;
}

export function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const id = parseInt(lines[0], 10);
    if (Number.isNaN(id)) continue;

    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );
    if (!timeMatch) continue;

    const startTime =
      parseInt(timeMatch[1], 10) * 3600 +
      parseInt(timeMatch[2], 10) * 60 +
      parseInt(timeMatch[3], 10) +
      parseInt(timeMatch[4], 10) / 1000;

    const endTime =
      parseInt(timeMatch[5], 10) * 3600 +
      parseInt(timeMatch[6], 10) * 60 +
      parseInt(timeMatch[7], 10) +
      parseInt(timeMatch[8], 10) / 1000;

    const text = lines.slice(2).join(' ').trim();

    if (text) {
      entries.push({ id, startTime, endTime, text });
    }
  }

  return entries;
}

export function detectSubtitleLanguage(text: string): SubtitleLanguage {
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;

  if (cjkCount >= 2 && cjkCount >= latinCount * 0.35) return 'zh';
  if (latinCount >= 2) return 'en';
  return 'other';
}

export function buildBilingualSegments(entries: SubtitleEntry[]): BilingualSegment[] {
  const segments: BilingualSegment[] = [];
  let index = 0;

  while (index < entries.length) {
    const current = entries[index];
    const next = entries[index + 1];
    const currentLanguage = detectSubtitleLanguage(current.text);
    const nextLanguage = next ? detectSubtitleLanguage(next.text) : null;
    const closeEnough = next ? next.startTime - current.endTime <= 10 : false;

    if (next && closeEnough && currentLanguage === 'en' && nextLanguage === 'zh') {
      segments.push({
        id: `${current.id}-${next.id}`,
        startTime: current.startTime,
        endTime: next.endTime,
        english: current,
        chinese: next,
      });
      index += 2;
      continue;
    }

    if (next && closeEnough && currentLanguage === 'zh' && nextLanguage === 'en') {
      segments.push({
        id: `${current.id}-${next.id}`,
        startTime: current.startTime,
        endTime: next.endTime,
        english: next,
        chinese: current,
      });
      index += 2;
      continue;
    }

    segments.push({
      id: String(current.id),
      startTime: current.startTime,
      endTime: current.endTime,
      english: currentLanguage === 'en' ? current : undefined,
      chinese: currentLanguage === 'zh' ? current : undefined,
      other: currentLanguage === 'other' ? current : undefined,
    });
    index += 1;
  }

  return segments;
}

export function segmentContainsEntry(segment: BilingualSegment, entry: SubtitleEntry): boolean {
  return (
    segment.english?.id === entry.id ||
    segment.chinese?.id === entry.id ||
    segment.other?.id === entry.id
  );
}
