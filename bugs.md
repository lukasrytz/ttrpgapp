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
   → `applyHp` adjusts hp and resets death saves, but never touches `concentration`, so
     nothing ends it. It previously carried a dead expression
     (`sign < 0 && prev.concentration ? prev.concentration : prev.concentration`, a no-op in
     both branches) that looked like a half-written attempt at this; the
     feature/android-touch-enhancements merge removed the dead line, but the missing
     behaviour is still missing. Found by reading the code, not observed at the table.
     (plugins/dnd5e/src/TrackerPage.tsx, applyHp)
4. [OPEN] sly.html sits in the repo root — a 43KB UTF-16 saved copy of an article from
   SlyFlourish.com, committed by accident on feature/android-touch-enhancements.
   → nothing references it, and it is third-party content in a public repo. Should be deleted.
5. [OPEN] `npm run build:apk` fails on Linux and macOS.
   → the root package.json script ends in `gradlew.bat`, which is Windows-only. Either use
     ./gradlew with a platform check, or document it as a Windows-only convenience script.
6.