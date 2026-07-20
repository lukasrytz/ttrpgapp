import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Turn [[Target]] / [[Target|label]] into markdown links with a wikilink: href. */
function preprocessWikiLinks(md: string): string {
  return md.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, target: string, label?: string) => {
    return `[${label || target}](wikilink:${encodeURIComponent(target.trim())})`;
  });
}

export default function Markdown({
  content,
  onWikiLink,
}: {
  content: string;
  onWikiLink?: (target: string) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => (url.startsWith('wikilink:') ? url : defaultUrlTransform(url))}
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith('wikilink:')) {
            const target = decodeURIComponent(href.slice('wikilink:'.length));
            return (
              <a
                className="wikilink"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onWikiLink?.(target);
                }}
              >
                {children}
              </a>
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {preprocessWikiLinks(content)}
    </ReactMarkdown>
  );
}

/** Split markdown into a preamble and h2 sections (for the collapsible play view). */
export function splitSections(md: string): { heading: string | null; body: string }[] {
  const lines = md.split('\n');
  const sections: { heading: string | null; body: string }[] = [];
  let current: { heading: string | null; body: string[] } = { heading: null, body: [] };
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push({ heading: current.heading, body: current.body.join('\n') });
      current = { heading: m[1]!, body: [] };
    } else {
      current.body.push(line);
    }
  }
  sections.push({ heading: current.heading, body: current.body.join('\n') });
  return sections.filter((s) => s.heading !== null || s.body.trim() !== '');
}
