# Editor Architecture

## Direction

The editor uses an app-owned block architecture with Tiptap as its text-editing and rendering
adapter. Tiptap is not the product data model, command registry, persistence coordinator, or
collaboration protocol.

This keeps the mature ProseMirror editing behavior we already rely on while creating the same
important boundaries found in block-native editors: stable block identity, a unified block
catalog, independent embed lifecycles, and block-addressable operations.

## Ownership Boundaries

```text
NotePageV1 (page envelope)
├── title, properties, slug, timestamps
└── content (body-only Tiptap JSON)
    └── addressable blocks with stable blockId attributes

Block catalog
├── palette metadata
├── insertion commands
├── turn-into commands
└── gutter labels and editability

Tiptap adapter
├── schema and text editing
├── block identity repair
├── selection and keyboard behavior
└── NodeViews for isolated embeds

CraftEditorSession
├── autosave and persistence
├── page properties
├── sync presentation state
└── publication lifecycle

Svelte editor surface
├── menus, toolbars, overlays, and panels
└── translates user intent into catalog/editor/session commands
```

## Invariants

- The page title is owned by the page envelope/properties and is rendered once by the article
  header. An H1 inside `content` is an ordinary body heading.
- Markdown frontmatter maps to page properties. Markdown body maps to editor content.
- Every document-level block has a durable `blockId`. List items also have IDs because they are
  independently movable and mutable.
- Paragraphs inside list items, quotes, and table cells do not receive independent IDs. Their
  owning container is the addressable block.
- Block IDs survive ordinary edits and saves. Missing or duplicated IDs are repaired at both the
  storage boundary and the editor transaction boundary.
- Block positions and paths are derived through `buildBlockIndex`; positions are never persisted
  because editing makes them stale.
- Slash insertion, gutter descriptions, turn-into behavior, and custom-block edit behavior come
  from one block catalog.
- Embedded components own their internal state and edit lifecycle through NodeViews. The editor
  communicates with them using generic block events rather than component-specific branches.
- Page persistence, cloud-sync labels, and publication do not belong to the editor UI component.

## Canonical Data

`NotePageV1.content` remains versioned Tiptap JSON for now. Persisting a second shadow block tree
would create two sources of truth and more migration risk without improving the current product.
Stable IDs make the existing tree block-addressable; `buildBlockIndex` supplies the flat lookup
needed by commands and future synchronization.

Example:

```ts
{
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { blockId: 'block_...' },
      content: [{ type: 'text', text: 'Hello' }]
    }
  ]
}
```

## Compatibility And Migration

Normalization happens whenever a page is created, imported, or read from storage:

1. Legacy in-document metadata nodes are lifted into page properties.
2. A legacy leading H1 is removed only when it matches the page title.
3. A legacy presentation-only description heading is removed only alongside that matching title.
4. Stable block IDs are added and collisions are repaired.

The page schema remains version 1 because these attributes are backward-compatible and legacy
records are normalized on read. A version bump is reserved for a non-compatible envelope or
content migration.

## Collaboration Path

The current cloud sync remains page-record synchronization. The next collaboration layer should
operate on block-addressed mutations instead of shipping opaque editor transactions:

```ts
type BlockOperation = {
	operationId: string;
	pageId: string;
	blockId: string;
	baseVersion: number;
	kind: 'insert' | 'move' | 'update-content' | 'update-attrs' | 'delete';
	payload: unknown;
};
```

An OT engine can then transform structural operations by `blockId`, while inline text operations
use positions relative to the addressed text block. Cursor presence should likewise be expressed
as `{ blockId, anchorOffset, headOffset }`, never as a raw document-wide position.

OT is intentionally a later layer. Stable identity and explicit commands must exist first;
otherwise the sync engine would be forced to infer product intent from ProseMirror transactions.

## Next Steps

1. Route block insertion, movement, duplication, conversion, and deletion through a typed command
   service that emits `BlockOperation` records.
2. Persist a local operation journal beside page snapshots and add deterministic replay tests.
3. Add block-relative selection bookmarks so history preview and remote presence survive moves.
4. Specify transform rules for concurrent move/delete, split/merge, and inline text edits.
5. Introduce real-time transport only after operation replay and transform tests are reliable.
