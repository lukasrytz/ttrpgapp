export interface TableRollResult {
  headers: string[];
  row: string[];
  text: string;
}

export function parseMarkdownTable(markdown: string): { headers: string[]; rows: string[][] } | null {
  const lines = markdown.split(/\r?\n/);
  let tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableLines.push(trimmed);
      inTable = true;
    } else if (inTable) {
      // Table ended
      break;
    }
  }

  if (tableLines.length < 3) return null; // Need at least header, delimiter, and 1 row

  const parseRow = (line: string): string[] => {
    return line
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
  };

  const headers = parseRow(tableLines[0]!);
  // tableLines[1] is delimiter row (| --- | --- |)
  const rows: string[][] = [];

  for (let i = 2; i < tableLines.length; i++) {
    const row = parseRow(tableLines[i]!);
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) return null;

  return { headers, rows };
}

export function rollOnMarkdownTable(
  markdown: string,
  rng: () => number = Math.random,
): TableRollResult | null {
  const parsed = parseMarkdownTable(markdown);
  if (!parsed || parsed.rows.length === 0) return null;

  const rowIndex = Math.floor(rng() * parsed.rows.length);
  const row = parsed.rows[rowIndex] ?? parsed.rows[0]!;

  const text = row.join(' — ');

  return {
    headers: parsed.headers,
    row,
    text,
  };
}
