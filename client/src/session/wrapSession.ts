import { backend } from '../backend';
import { computeTotalElapsed, formatClock, getClockState, resetClock } from './clock';
import { deriveBeats } from './runningOrder';

export async function wrapSession(): Promise<{ path: string; summary: string }> {
  // 1. Flush any editor notes
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ttrpg-flush-notes'));
  }
  await new Promise((r) => setTimeout(r, 60));

  const clock = getClockState();
  const totalSeconds = computeTotalElapsed(clock);
  const durationFormatted = formatClock(totalSeconds);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const endTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 2. Read active session note
  const notes = await backend().listNotes();
  const sessionNotes = notes
    .filter((n) => n.isSession || n.path.startsWith('sessions/'))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  let targetPath = sessionNotes[0]?.path;
  let content = '';

  if (!targetPath) {
    const { path } = await backend().createSession(`Session ${todayStr}`);
    targetPath = path;
    const note = await backend().readNote(targetPath);
    content = note.content;
  } else {
    const note = await backend().readNote(targetPath);
    content = note.content;
  }

  // 3. Extract completed tasks from note
  const beats = deriveBeats(content);
  const completedTasks = beats.flatMap((b) => b.tasks).filter((t) => t.done);

  // 4. Construct summary markdown
  const summaryLines = [
    `## 🏁 Session Wrap Summary`,
    `- **Date**: ${todayStr}`,
    `- **Duration**: ${durationFormatted} (Concluded at ${endTimeStr})`,
    `- **Combat Encounters**: ${clock.combatsCount} ${clock.combatsCount === 1 ? 'encounter' : 'encounters'} (${clock.combatRounds} rounds total)`,
  ];

  if (completedTasks.length > 0) {
    summaryLines.push(`- **Completed Tasks**:`);
    for (const t of completedTasks) {
      summaryLines.push(`  - [x] ${t.text}`);
    }
  }

  const summaryMarkdown = summaryLines.join('\n') + '\n';

  // 5. Append to note
  const updatedContent = `${content.trimEnd()}\n\n${summaryMarkdown}`;
  await backend().writeNote(targetPath, updatedContent);

  // 6. Reset session clock
  resetClock();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ttrpg-local-changed'));
    window.dispatchEvent(new CustomEvent('ttrpg-sync-updated'));
  }

  return { path: targetPath, summary: summaryMarkdown };
}
