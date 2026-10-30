# Editor browser check

Start the Vite development server, then open a fresh isolated browser session:

```sh
playwright-cli -s=editor-css open 'http://localhost:5173/crafts/style-guide?edit' --browser=chrome
playwright-cli -s=editor-css run-code --filename=scripts/editor/check-browser.js
playwright-cli -s=editor-css close
```

Use the development server's port if it differs. The check uses the supplied page's local origin and the real Style Guide editor, with CodeMirror's public `EditorView.findFromDOM` API loaded through Vite. It requires a development server rather than a production build.

Synthetic Markdown covers frontmatter, a component containing nested Markdown, a table, a horizontal rule, a fenced code block, nested and task lists, media, headings, and a blockquote. At desktop and mobile widths, the check scrolls to text before and after widgets, clicks its actual rendered position, checks the exact source selection, types a marker, and verifies the complete Markdown change. The image response is supplied locally by the browser check.

The check temporarily replaces the open document in memory. It restores the original Markdown, selection, editor mode, viewport, and scroll position in `finally`, removes its browser helper and image route, and never saves to Git. It creates no screenshots or other files. Use an isolated session and close it afterward.

## List selection

Run the list selection regression in the same isolated development session:

```sh
playwright-cli -s=editor-css run-code --filename=scripts/editor/check-list-selection.js
```

This check drags text forward and backward within and across bullet, nested, ordered, and task list items, selects backward to each marker's following text boundary, and extends ranges with Shift-click. It also Shift-clicks preview markers, drags from preview markers into subsequent text, and selects complete raw prefixes including nested indentation and same-line nesting (`- - text`). Four cases cover forward and backward selection across list items inside single and nested blockquotes (`> - text` and `> > - text`). A mobile fixture verifies selection from wrapped nested text into the next item in both directions. Markdown source mode provides control cases.

Text selection checks assert the exact anchor, head, and selected Markdown using native text coordinates. Preview marker interactions require the original anchor to remain intact when extending a selection, or its new anchor to stay within the clicked source prefix when starting a drag; a marker widget does not identify one particular source character. Each case confirms that selecting did not change the document and types a replacement to verify the complete resulting source.

Fixture scrolling temporarily disables smooth scrolling so reset animations cannot move pointer endpoints during a drag. Failures are collected before reporting. Original source, selection, mode, viewport, scroll position, scroll behavior, and released mouse/Shift state are restored in `finally`. No Git save occurs.
