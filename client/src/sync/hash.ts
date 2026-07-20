/** SHA-256 hex of a UTF-8 string, via Web Crypto (available in the WebView and Node). */
export async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isNote(id: string): boolean {
  return id.startsWith('notes/');
}
