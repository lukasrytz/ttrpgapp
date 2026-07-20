const WIKI_LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Titles referenced by [[wiki-links]] in a markdown document, deduped in order. */
export function extractLinks(content: string): string[] {
  const links: string[] = [];
  for (const m of content.matchAll(WIKI_LINK)) {
    const target = m[1]!.trim();
    if (target && !links.includes(target)) links.push(target);
  }
  return links;
}
