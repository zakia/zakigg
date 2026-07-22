# Notes PRD

## Summary

`/notes` is a public, local-first document manager on zaki.gg. Documents, metadata, and media
assets are managed entirely in the browser with IndexedDB. Markdown remains the portable export
format, while the canonical editing model is versioned Tiptap JSON stored in a page object store.

The product principle is: **rich text UX, browser-owned documents, markdown portability**.

## Product Direction

- Keep the app in SvelteKit.
- Use Tiptap as the editor engine because it gives us structured blocks, rich editing,
  keyboard/input rules, custom-node room, and a Yjs-compatible path later.
- Treat markdown as an import/export/source compatibility format, not the canonical internal model.
- Store pages and assets in IndexedDB with a versioned schema that can migrate from earlier
  single-note storage.
- Keep `/notes` as the manager/admin surface and `/notes/<slug>` as the durable page URL.

## Current Scope

- Add a local document manager at `/notes`.
- Serve `/notes/<slug>` as an always-editable WYSIWYG page. There is no separate read-only
  view: documents live in each visitor's own browser, so the author is the only reader.
- Make metadata structural, not optional: every document begins with a required metadata
  (properties) block above the first H1, enforced by the editor schema so it cannot be
  deleted. An empty block renders as a compact "Add property" row.
- Source page metadata from the content itself:
  - Title (metadata `title` property, else the first H1)
  - Slug (metadata `slug` property, else derived from the title)
  - Tags, description, date, and draft as metadata block properties
  - Created and updated timestamps
- Round-trip metadata as standard top-of-file YAML frontmatter in markdown.
- Support local page administration:
  - Create pages
  - Import pages from note export zips (file picker or drag and drop)
  - Search pages
  - Filter by tag
  - Open, duplicate, and delete pages
  - See page, word, asset, and orphan-asset counts
  - Delete orphaned assets
- Persist page content and media assets in IndexedDB.
- Migrate the old single default note into `/notes/default`.
- Export one page as a zip containing:
  - `page.md`
  - `page.json`
  - `manifest.json`
  - referenced assets under `assets/`
- Export the whole local database as a zip containing:
  - one markdown file per page
  - one JSON file per page
  - `manifest.json`
  - all stored assets under `assets/`

## Non-Goals

- No authentication.
- No server persistence.
- No file-system publishing from `/notes`.
- No Craft editing interop from `/notes`.
- No cloud sync.
- No collaboration.

The app is public but local-only: anyone can visit `/notes`, but their documents live in their own
browser storage.

## Data Model

The IndexedDB database is `zaki.gg-notes`.

```ts
type NotePageV1 = {
	version: 1;
	editor: 'tiptap';
	id: string;
	slug: string;
	title: string;
	tags: string[];
	content: JSONContent;
	createdAt: string;
	updatedAt: string;
};
```

```ts
type NotesAssetV1 = {
	id: string;
	blob: Blob;
	mediaType: string;
	name: string;
	size: number;
	pageIds?: string[];
	createdAt: string;
	updatedAt: string;
};
```

Future versions should migrate toward an app-owned block model, roughly:

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

- V2 (shipped): import/restore from notes export zips.
- V3: local-first CRDT persistence with Yjs and y-indexeddb.
- V4: background cloud sync through Y-Sweet or a similar Yjs sync service.
- V5: authenticated private notes and explicit sharing.
- V6: custom blocks such as checklist, richer embeds, and richer code blocks.
- V7: spatial mode where selected document blocks can be arranged on a canvas and collapsed back
  into document order.

## Testing Checklist

### Build Hygiene

- Run `bun run check`.
- Run Prettier on edited files.
- Run `bun run build` when unrelated project check blockers are resolved.

### Manager

- Open `/notes`.
- Confirm `/notes/default` exists after migration.
- Create a page with title and tags.
- Search and tag-filter pages.
- Duplicate and delete a page.
- Export one page.
- Export the database.
- Confirm orphaned assets are visible and cleanable.

### Editor

- Open `/notes/<slug>` and confirm the editor loads with the metadata block above the H1.
- Confirm the metadata block cannot be deleted and an empty one stays compact.
- Edit content and confirm autosave returns to saved state.
- Edit the H1 or the metadata title/slug properties, then confirm the URL follows slug changes.
- Paste markdown with YAML frontmatter and confirm properties merge into the metadata block.
- Refresh and confirm content and assets return.

### Assets And Export

- Insert an image or video.
- Refresh the editor and confirm the asset renders.
- Export the page and confirm markdown asset references point to files under `assets/`.
- Export the full database and confirm the manifest lists every page and asset.

### UX And Accessibility

- Verify desktop and mobile widths.
- Confirm toolbar buttons have accessible labels and titles.
- Confirm typing focus remains stable when using toolbar controls.
- Confirm no text or controls overlap in the mobile reader or editor.
