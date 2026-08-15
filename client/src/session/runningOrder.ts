export interface BeatTask {
  text: string;
  done: boolean;
}

export interface BeatLink {
  target: string;
  display: string;
}

export interface Beat {
  heading: string;
  level: number;
  /** First paragraph under the heading, truncated to ~120 chars. */
  summary: string;
  /** Checkbox items found under this heading. */
  tasks: BeatTask[];
  /** Monster or spell wiki-links mentioned in this beat. */
  links: BeatLink[];
}

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const TASK_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

export function deriveBeats(markdown: string): Beat[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split(/\r?\n/);
  const beats: Beat[] = [];
  let currentBeat: Beat | null = null;
  let summaryFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(HEADING_RE);

    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      if (currentBeat) {
        beats.push(currentBeat);
      }
      currentBeat = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        summary: '',
        tasks: [],
        links: [],
      };
      summaryFound = false;
      continue;
    }

    if (!currentBeat) {
      // Content before the first heading can be ignored or treated as preamble
      continue;
    }

    // Check for wiki links in the line
    let linkMatch: RegExpExecArray | null;
    const lineLinkRe = new RegExp(WIKI_LINK_RE.source, 'g');
    while ((linkMatch = lineLinkRe.exec(line)) !== null) {
      const target = (linkMatch[1] ?? '').trim();
      const display = (linkMatch[2] ?? target).trim();
      if (target) {
        currentBeat.links.push({ target, display });
      }
    }

    // Check for task checkbox
    const taskMatch = trimmed.match(TASK_RE);
    if (taskMatch && taskMatch[1] && taskMatch[2]) {
      const done = taskMatch[1].toLowerCase() === 'x';
      const text = taskMatch[2].trim();
      currentBeat.tasks.push({ text, done });
      continue;
    }

    // Summary paragraph candidate: first non-empty line that isn't a task or horizontal rule
    if (!summaryFound && trimmed.length > 0 && !trimmed.startsWith('---') && !trimmed.startsWith('***')) {
      // Strip markdown links/formatting for a clean summary
      const clean = trimmed
        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2')
        .replace(/[*_`#]/g, '')
        .trim();
      if (clean) {
        currentBeat.summary = clean.length > 120 ? clean.slice(0, 117) + '…' : clean;
        summaryFound = true;
      }
    }
  }

  if (currentBeat) {
    beats.push(currentBeat);
  }

  return beats;
}

export function toggleTaskInMarkdown(markdown: string, taskText: string, nextDone: boolean): string {
  const lines = markdown.split(/\r?\n/);
  const updated = lines.map((line) => {
    const match = line.trim().match(TASK_RE);
    if (match && match[2] && match[2].trim() === taskText) {
      const indent = line.slice(0, line.indexOf(match[0]));
      const prefix = match[0].startsWith('*') ? '*' : '-';
      return `${indent}${prefix} [${nextDone ? 'x' : ' '}] ${match[2]}`;
    }
    return line;
  });
  return updated.join('\n');
}
