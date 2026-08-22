# Notes PRD

## Summary

`/crafts` combines a public collection with a private, local-first document manager on zaki.gg.
Editable documents, metadata, and media assets are browser-first in IndexedDB; signed-in users can
synchronize and publish immutable reader snapshots. Markdown remains the portable export format,
while the canonical editing model is versioned Tiptap JSON stored in a page object store.

The product principle is: **rich block editing, clear ownership boundaries, markdown portability**.

## Product Direction

- Keep the app in SvelteKit.
- Use Tiptap as the text-editing/render adapter beneath an app-owned block architecture. Product
  commands, block definitions, page state, persistence, and collaboration must not be owned by
  Tiptap components.
- Treat markdown as an import/export/source compatibility format, not the canonical internal model.
- Store pages and assets in IndexedDB with a versioned schema that can migrate from earlier
  single-note storage.
- Keep `/crafts?edit` as the manager surface, `/crafts/<slug>?edit` as the private editor URL, and
  `/crafts/<slug>` as the durable published URL.

## Current Scope

- Provide the local document manager at `/crafts?edit` behind the edit gate.
- Serve `/crafts/<slug>?edit` as the WYSIWYG editor and `/crafts/<slug>` as the published reader.
- Keep page metadata alongside the editor document in the page envelope. Properties are edited in
  the properties panel rather than represented as a document node.
- Source page metadata from page properties:
  - Title (property value, else the page envelope title)
  - Slug (property value, else derived from the title)
  - Tags, description, date, and draft
  - Created and updated timestamps
- Render the page title once in the article header. Body H1 nodes are ordinary section headings.
- Give every addressable document block and list item a stable identity.
- Use one block catalog for insertion, gutter labels, conversion, and custom edit behavior.
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
- Migrate the old single default note into the crafts page store.
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

- No file-system publishing from the editor.
- No simultaneous multiplayer editing yet.
- No second persisted shadow block model beside Tiptap JSON.

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
	properties: MetadataEntry[];
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

Addressable nodes in `content` carry stable identity:

```ts
type AddressableBlockAttrs = {
	blockId: string;
};
```

See [Editor Architecture](./editor-architecture.md) for the ownership model, invariants, and
collaboration path.

## Roadmap

- V2 (shipped): import/restore from notes export zips.
- V3 (shipped): authenticated snapshot synchronization.
- V4 (shipped): custom embeds, media blocks, tables, code blocks, and unified block controls.
- V5 (shipped): stable block identity and explicit editor ownership boundaries.
- V6 (current): block operation journal, replay, and OT transform rules.
- V7: real-time multi-user presence and editing.
- V8: spatial mode where selected document blocks can be arranged on a canvas and collapsed back
  into document order.

## Testing Checklist

### Build Hygiene

- Run `bun run check`.
- Run Prettier on edited files.
- Run `bun run build` when unrelated project check blockers are resolved.

### Manager

- Open `/crafts?edit`.
- Confirm the migrated default craft exists.
- Create a page with title and tags.
- Search and tag-filter pages.
- Duplicate and delete a page.
- Export one page.
- Export the database.
- Confirm orphaned assets are visible and cleanable.

### Editor

- Open `/crafts/<slug>?edit` and confirm the article header shows exactly one page title.
- Edit content and confirm autosave returns to saved state.
- Edit the title or slug property, then confirm the URL follows slug changes.
- Add a body H1 and confirm it does not rename the page.
- Paste markdown with YAML frontmatter and confirm properties merge into page properties.
- Insert, duplicate, convert, and move blocks; confirm each serialized block has one unique ID.
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
