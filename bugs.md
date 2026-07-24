Bugs found while using the app:
1. [FIXED] when using the editor, the cursor routinely jumps to the start of the document
   → the CodeMirror `extensions` array was rebuilt every render (fresh `markdown()`
     instance), so react-codemirror reconfigured and reset the cursor on each keystroke.
     Now memoized. (client/src/pages/NotesPage.tsx)
2. [FIXED] sometimes information that was written in session notes is then gone (maybe due to syncing issue?)
   → the 1.2s debounced save was cancelled on unmount without flushing, so edits typed
     just before switching notes / hitting back / backgrounding the app were dropped.
     Now flushed on unmount and on app background. (client/src/pages/NotesPage.tsx)
3.