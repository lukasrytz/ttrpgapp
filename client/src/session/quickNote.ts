import { backend } from '../backend';

export async function appendQuickNote(
  text: string,
  heading = 'In-session Notes',
): Promise<{ path: string }> {
  // 1. Flush any in-flight unsaved keystrokes in NotesPage
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ttrpg-flush-notes'));
  }
  // Brief delay to allow pending flush async handlers to land
  await new Promise((resolve) => setTimeout(resolve, 60));

  // 2. Find the most recently active session note, or create one
  const notes = await backend().listNotes();
  const sessionNotes = notes
    .filter((n) => n.isSession || n.path.startsWith('sessions/'))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  let targetPath = sessionNotes[0]?.path;
  let content = '';

  if (!targetPath) {
    const today = new Date().toISOString().slice(0, 10);
    const { path } = await backend().createSession(`Session ${today}`);
    targetPath = path;
    const note = await backend().readNote(targetPath);
    content = note.content;
  } else {
    const note = await backend().readNote(targetPath);
    content = note.content;
  }

  // 3. Format entry with time
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const entryLine = `- **${time}**: ${text.trim()}`;

  // 4. Insert under the target heading or create it
  const headingTarget = heading.replace(/^#+\s*/, '').trim();
  const headingRegex = new RegExp(
    `^(#{1,6})\\s+${headingTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'im',
  );
  const match = content.match(headingRegex);

  let updatedContent = '';
  if (match && match.index !== undefined) {
    const insertPos = match.index + match[0].length;
    updatedContent = `${content.slice(0, insertPos)}\n\n${entryLine}${content.slice(insertPos)}`;
  } else {
    updatedContent = `${content.trimEnd()}\n\n## ${headingTarget}\n\n${entryLine}\n`;
  }

  await backend().writeNote(targetPath, updatedContent);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ttrpg-local-changed'));
    window.dispatchEvent(new CustomEvent('ttrpg-sync-updated'));
  }

  return { path: targetPath };
}
