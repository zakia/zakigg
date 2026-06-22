# Notes PRD

## Summary

Build `/notes` as a public, local-first document editor on zaki.gg. V0 is intentionally small:
one rich text document, autosaved locally in the browser, with markdown export. The long-term
direction is a block-document workspace that can grow into multiple documents, background cloud
sync, collaboration, custom blocks, and spatial/canvas layout.

The product principle is: **rich text UX, block-document data, markdown portability**.

## Product Direction

- Keep the app in SvelteKit.
- Use Tiptap as the editor engine for V0 because it gives us structured blocks, rich editing,
  keyboard/input rules, custom-node room, and a Yjs-compatible path later.
- Treat markdown as an import/export/source compatibility format, not the canonical internal model.
- Store local content in a versioned document envelope so future migrations can move from raw
  Tiptap JSON toward a first-class app `NoteDoc`.
- Design the document around durable blocks so future headers, paragraphs, timers, drawings, and
  spatial canvas elements can keep identity across rearrangements.

## V0 Scope

- Add a public `/notes` route.
- Show one default document editor as the primary screen.
- Support rich text editing with common blocks and marks:
  - Paragraphs
  - Headings
  - Bullet and ordered lists
  - Blockquotes
  - Code blocks
  - Bold, italic, strike, and inline code
  - Undo and redo
- Autosave locally in the browser.
- Persist the note with IndexedDB and keep a localStorage backup.
- Expose `Copy Markdown` and `Download .md` actions.
- Add a `Notes` link to the site dock.

## V0 Non-Goals

- No authentication.
- No server persistence.
- No cloud sync.
- No collaboration.
- No multiple-note UI.
- No custom timer block.
- No canvas/spatial mode.

V0 is public but local-only: anyone can visit `/notes`, but their content lives in their own
browser storage.

## Data Model

V0 persists a single default document at key `zaki.gg:notes:v1:default`.

```ts
type NotesDocV1 = {
	version: 1;
	editor: 'tiptap';
	content: JSONContent;
	updatedAt: string;
};
```

The default local document can persist Tiptap JSON directly for now. Future versions should migrate
toward an app-owned block model, roughly:

```ts
type NoteBlock = {
	id: string;
	type: 'paragraph' | 'heading' | 'timer' | 'canvas';
	content?: unknown;
	attrs?: Record<string, unknown>;
	layout?: {
		mode: 'flow' | 'canvas';
		x?: number;
		y?: number;
		width?: number;
	};
};
```

## Roadmap

- V1: multiple notes with a local note index and routes such as `/notes/:id`.
- V2: local-first CRDT persistence with Yjs and y-indexeddb.
- V3: background cloud sync through Y-Sweet or a similar Yjs sync service.
- V4: authenticated private notes and explicit sharing.
- V5: custom blocks such as timer, checklist, embed, and richer code blocks.
- V6: spatial mode where selected document blocks can be arranged on a canvas and collapsed back
  into document order.

## Testing Checklist

### PRD And Build Hygiene

- Confirm this file exists and captures vision, V0 scope, roadmap, and tests.
- Run `pnpm run check`.
- Run `pnpm run lint`.
- Run `pnpm run build`.

### Editor Integration

- Start the dev server with `pnpm run dev`.
- Open `/notes`.
- Confirm the page renders without SSR or browser-only errors.
- Confirm the dock includes `Notes` and marks `/notes` active.

### Persistence

- Type a heading, paragraph, list, quote, and code block.
- Refresh the page and confirm the content returns.
- Close and reopen the tab and confirm the content returns.
- Clear `zaki.gg:notes:v1:default` from browser storage and confirm the editor recovers to an
  empty document.
- Confirm another browser profile/device does not see the same note in V0.

### Markdown Export

- Create content with heading, paragraph, bold, italic, list, quote, and code block.
- Use `Copy Markdown` and paste into a plain text editor.
- Use `Download .md` and open the downloaded file.
- Confirm the exported markdown matches the note.

### UX And Accessibility

- Verify desktop and mobile widths.
- Confirm toolbar buttons have accessible labels and titles.
- Confirm typing focus remains stable when using toolbar controls.
- Confirm save state moves through saving and saved locally states.
