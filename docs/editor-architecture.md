# Editor architecture

The editor follows a one-way dependency model inspired by Gutenberg:

```text
application route
    ↓
document editor
    ↓
editor core
```

## Core

`src/lib/editor/core` owns the reusable block-editing mechanics: Tiptap extensions, block
identity and handles, formatting controls, links, lists, tables, media blocks, and the component
embed contract. It operates on editor content and an injected embed registry. It must not import
document persistence, synchronization, publication, application routes, or craft modules.

## Document

`src/lib/editor/document` composes the core into a complete document editing experience. It owns
the document model, metadata, history, import/export, local persistence, asset storage, and sync.
Publication is optional and supplied through `DocumentPublicationAdapter`; the document editor does
not know which application feature publishes it.

## Application

Routes own screen layout, navigation, authentication gates, URLs, and publication implementations.
They provide the document editor with its embed registry and optional adapters. Code in
`src/lib/editor` must never import from `src/lib/crafts` or from a route.

Public consumers should prefer the entry points at `src/lib/editor/core/index.ts` and
`src/lib/editor/document/index.ts` instead of reaching into implementation folders.

## Direction

The editor uses an app-owned block architecture with Tiptap as its text-editing and rendering
adapter. Tiptap is not the product data model, command registry, persistence coordinator, or
collaboration protocol.

This keeps the mature ProseMirror editing behavior we already rely on while preserving the
important boundaries found in block-native editors: stable block identity, a unified block
catalog, independent embed lifecycles, and block-addressable operations.

## Ownership details

```text
Document model
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

Editor command service
├── typed block insertion and block-menu commands
├── media, table, and list commands
└── translates product intent into Tiptap operations

Document session
├── autosave and persistence
├── document properties
├── sync presentation state
└── optional publication adapter

Svelte document editor
├── composes menus, toolbars, overlays, and panels
├── delegates slash-menu and history state to interaction controllers
└── translates user intent into command-service and session calls
```

## Invariants

- The document title is owned by the document envelope/properties and is rendered once by the
  document header. An H1 inside `content` is an ordinary body heading.
- Markdown frontmatter maps to document properties. Markdown body maps to editor content.
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
- Persistence, cloud-sync labels, and publication do not belong to editor core.

## Canonical data

The current document content remains versioned Tiptap JSON. Persisting a second shadow block tree
would create two sources of truth without improving the product. Stable IDs make the existing tree
block-addressable; `buildBlockIndex` supplies the flat lookup needed by commands and future
synchronization.

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

## Normalization

Normalization happens whenever a document is created, imported, or read from storage:

1. Legacy in-document metadata nodes are lifted into document properties.
2. A leading H1 is removed only when it matches the document title.
3. A presentation-only description heading is removed only alongside that matching title.
4. Stable block IDs are added and collisions are repaired.

## Collaboration path

The current cloud sync remains document-record synchronization. A future collaboration layer
should operate on block-addressed mutations instead of shipping opaque editor transactions:

```ts
type BlockOperation = {
	operationId: string;
	documentId: string;
	blockId: string;
	baseVersion: number;
	kind: 'insert' | 'move' | 'update-content' | 'update-attrs' | 'delete';
	payload: unknown;
};
```

An OT engine can transform structural operations by `blockId`, while inline text operations use
positions relative to the addressed text block. Cursor presence should likewise use
`{ blockId, anchorOffset, headOffset }`, never a raw document-wide position.

OT is intentionally a later layer. Stable identity and explicit commands must exist first;
otherwise the sync engine would be forced to infer product intent from ProseMirror transactions.

## Next steps

1. Extend the typed command service to cover movement and inline structural edits, then emit
   `BlockOperation` records from that single boundary.
2. Persist a local operation journal beside document snapshots and add deterministic replay tests.
3. Add block-relative selection bookmarks so history preview and remote presence survive moves.
4. Specify transform rules for concurrent move/delete, split/merge, and inline text edits.
5. Introduce real-time transport only after operation replay and transform tests are reliable.
