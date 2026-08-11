Bugs found while using the app:
1. [FIXED] when using the editor, the cursor routinely jumps to the start of the document
   → the CodeMirror `extensions` array was rebuilt every render (fresh `markdown()`
     instance), so react-codemirror reconfigured and reset the cursor on each keystroke.
     Now memoized. (client/src/pages/NotesPage.tsx)
2. [FIXED] sometimes information that was written in session notes is then gone (maybe due to syncing issue?)
   → the 1.2s debounced save was cancelled on unmount without flushing, so edits typed
     just before switching notes / hitting back / backgrounding the app were dropped.
     Now flushed on unmount and on app background. (client/src/pages/NotesPage.tsx)
3. [OPEN] in the combat tracker, a concentrating combatant keeps its concentration when it
   takes damage — including when the damage drops it to 0 HP, where 5e ends concentration
   outright. Nothing prompts for the Constitution save that damage should trigger either.
   → `applyHp` builds the updated combatant with
     `concentration: sign < 0 && prev.concentration ? prev.concentration : prev.concentration`,
     which yields `prev.concentration` in both branches, so the expression does nothing.
     It looks like it was meant to clear concentration, or flag that a check is due, when a
     combatant takes damage. Found by reading the code, not observed at the table.
     (plugins/dnd5e/src/TrackerPage.tsx:168)
4.