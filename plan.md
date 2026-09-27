# Markdown Editor Rebuild — Plan & Context

## Follow-up decision and current status

- Keep CodeMirror Live Preview as the main editor, with Source mode for precise edits.
  A separate preview pane is not the target experience.
- Keep `![alt](url)` as the embed syntax for images, video, audio, and files.
  The URL extension identifies the media type; local files without a usable
  extension receive one from their MIME type when available.
- Do not invest in preserving the old `<Image>` and `<Video>` authoring path.
  Existing documents need a content migration before those renderers are removed.
- Formatting toolbars and slash menus are outside the current editor work.
- Live Preview now reveals source at the caret, renders GFM tables and task
  controls, styles code, lists, callouts, wiki links, and horizontal rules, and
  keeps pasted/dropped file insertion anchored while assets save.

The sections below preserve the original handoff. The follow-up above supersedes
its open decisions and describes the current implementation.

---

## 1. The problem we started with

The old editor was built on **Milkdown** (a ProseMirror WYSIWYG). It had serious
issues:

- **Dragging an image duplicated it** instead of moving it.
- **Dropping a file opened it in a new tab** (the editor had no drop handler, so
  the browser's default file-open behavior fired).
- Media used a **non-standard authoring syntax**: `<Image align="center" … />`
  instead of normal markdown `![alt](src)`. This was verbose, non-portable, and
  required a custom renderer everywhere.

The root cause was an over-generalization: images/videos/attachments were folded
into a custom "component embed" system (registry, ProseMirror node-view, MDX
parsing, lazy upload) that was meant for rich interactive widgets (games, timers,
columns, YouTube) but was also used for basic media.

## 2. Decisions we made

1. **Drop Milkdown entirely.** It was the source of the drag bug, the component
   machinery, and the non-portable syntax.
2. **Use CodeMirror 6** (already a dependency) as the editor engine.
3. **Media model**: drop/paste a file → generate standard markdown
   `![alt](url)` → store locally → render by media type.
4. **Obsidian-style inline live preview** was the requested editor style.
5. **Media URL carries the file extension** so the renderer can detect type
   without a metadata lookup (the published page is server-prerendered, so type
   must be inferable from the URL alone).

## 3. Current implementation (in the repo)

New editor lives in `src/lib/editor/codemirror/`:

| File                    | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `MarkdownEditor.svelte` | CodeMirror editor, Live/Markdown mode toggle, drop/paste → `![alt](url)`, theme |
| `live-preview.ts`       | **Bespoke** decoration renderer (the problem, see §4)                           |
| `media-drop.ts`         | `createMediaMarkdown(file)` → saves asset, returns `![alt](url)`                |
| `media-types.ts`        | `mediaKindForFile/Url`, `mediaUrlForAsset`, `escapeAlt`                         |

Removed:

- `src/lib/editor/milkdown/` (~5,000 lines) deleted.
- `@milkdown/kit` removed from `package.json`.

Updated to support `/media/<id>.<ext>`:

- `src/routes/media/[id]/+server.ts` — strips the extension.
- `getReferencedAssetIds` (in `document/model.ts`) — matches `/media/<id>` and
  legacy `local-asset://`.
- `rewriteAssetSources` (in `document/markdown.ts`) — export rewrite handles both.
- `file-import.ts` — imports media as `![alt](url)` instead of components.
- `renderCraftMarkdown` (`src/lib/crafts/markdown-renderer.ts`) — detects media
  type and emits `<img>` / `<video>` / `<audio>` / download link.

Verified with `playwright-cli` (installed the `microsoft/playwright-cli` skill):

- Drop image → `![test image](/media/<id>.png)` → renders `<img>` from local blob.
- Drop video → renders `<video controls>`.
- Keyboard navigation works (Cmd+Down to doc end).
- Live preview renders headings/paragraphs/media; component embeds render as
  styled chips.

## 4. The critical architectural problem (must fix)

I built a **second, bespoke markdown renderer** (`live-preview.ts`) that
re-implements markdown rendering from scratch via CodeMirror decorations. It is a
**parallel path** to the real reader renderer:

- **Reader / published view** (`renderCraftMarkdown`): full, correct pipeline
  (`mdast-util-from-markdown` → `mdast-util-to-hast` → `hast-util-to-html`).
  Handles lists (real `<ul>`/`<ol>` bullets), code blocks (`<pre><code>`, fence
  stripped), tables, quotes, etc. correctly.
- **Editor live preview** (`live-preview.ts`): partial, hand-rolled. It:
  - hides the `-` list marker but **never draws a bullet** → lists show no dots.
  - does not handle `FencedCode` → code blocks show the raw ` ```lang ` fence.
  - does not handle tables.

This is the root cause of the "super buggy" / "different from reader view"
feedback: **two renderers that will always drift.**

**The lesson:** I should have reused `renderCraftMarkdown` instead of writing a
parallel renderer. There must be **one** source of truth for markdown rendering.

## 5. How Obsidian handles it (for reference)

Obsidian's public documentation describes three user-facing states: Live
Preview, Source mode, and Reading view. Live Preview hides most syntax until
the cursor enters formatted content. Its internal renderer architecture is not
publicly established; the earlier claim that it has only one renderer was an
unsupported inference. Our editor should share Markdown semantics and test
parity with the published reader while keeping text directly editable.

## 6. Options to fix the divergence

**A. Source editor + live preview pane (GitHub Write/Preview style).**

- Editor = CodeMirror markdown source.
- A rendered preview pane/toggle that runs `renderCraftMarkdown` on the live text.
- **Trivially consistent** (preview IS the reader renderer). Very maintainable.
- Loses the fully-inline Obsidian feel.

**B. True inline live preview (chosen, refined).**

- Decorate editable text for headings, lists, quotes, code, and inline syntax.
- Use reader-backed widgets selectively for inactive tables and media.
- Reveal source when a construct is entered. Replacing every block with reader
  HTML would hide the text needed for editing.

**C. (discussed, not recommended)** Overlay the reader HTML behind a transparent
CodeMirror. Guaranteed consistency but fragile caret alignment.

## 7. Open questions for the next model

1. **Which approach: A or B?** **B**, with the selective widget design above.
2. Should **component embeds** (Timer, StyleGuidePreview, games) render as full
   interactive widgets inside the editor, or stay as placeholder chips?
3. **Wiki links** `[[…]]` — style/click them inline in the editor?
4. **Code blocks / tables** in live preview (matters more under B).
5. Should we re-add a **slash menu / formatting toolbar** (lost with Milkdown)?
6. Is the `/media/<id>.<ext>` URL format the right call, or should the media URL
   keep a stable path without extension and detect type another way?

## 8. Note on scope/cleanup

- The test drafts I created while validating (style-guide, code, sheep-bread)
  were cleaned up by deleting the local IndexedDB pages so they reload from the
  repository.
- `.playwright-cli/` was added to `.gitignore` and `.prettierignore`.
- `package.json` no longer includes `@milkdown/kit`.
