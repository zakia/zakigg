# Editor architecture

Canonical Markdown is the only persisted document format. CodeMirror owns both editing modes:
Source mode shows the Markdown directly; Live Preview decorates the same text and reveals syntax
when the caret enters it. The public renderer reads that Markdown for published pages.

The CodeMirror document contains the entire file, including YAML frontmatter. `title:` supplies
the single visible document heading. Page title, date, tags, slug, and draft status are projections
of that source; they are not parallel editable state. Moving above the body or clicking the heading
reveals the YAML in CodeMirror for direct editing. Invalid frontmatter remains editable and autosaves
locally, with a visible error; explicit Git Save waits for valid frontmatter.

```text
public build                     private editor
content/crafts/*.md              /admin/crafts/*
        ↓                               ↓
Markdown parser                     CodeMirror
        ↓                               ↓
static craft pages               IndexedDB draft
                                        ↓ explicit Save
                                  Git repository adapter
```

## Ownership

- `src/lib/editor/codemirror` owns source editing, Live Preview, and file insertion.
- `src/lib/editor/document` owns the canonical document model, Markdown rendering,
  frontmatter parsing and source edits, local drafts, import/export, and the editing session.
- `src/lib/crafts` owns craft routes, Git commit commands, publication controls, and the custom
  component registry.
- `src/lib/server/content` owns bundled content reads and explicit Git repository operations.
- `content/crafts` is the public build input and remote source of truth.
- GCS stores binary assets only.

The editor layer does not import application routes or GitHub. The application injects a
`DocumentRepositoryAdapter` that commits a complete Markdown document.

The keyboard contract for nested, ordered, and task lists is in
[`editor-list-behavior.md`](./editor-list-behavior.md).

CodeMirror features are composed as extensions. Frontmatter uses a state-owned block replacement
for its collapsed heading and reveals its original YAML when selected. Code blocks keep their code
text in the main editor. Decorations render a compact header, language selector, and copy button
when the cursor is outside the block; moving into the block reveals the original fence lines.
List commands edit Markdown directly and compose structural changes into one transaction for undo.

## Document contract

Every file is self-contained:

```md
---
id: page_...
title: Example
slug: example
description: Optional summary
date: 2026-09-16
tags:
  - notes
draft: true
---

Markdown and allowed custom components.
```

`id` is stable and determines the repository filename. `slug` may change without renaming the
file. `draft: true` excludes the document from public builds. Publishing changes that field and
commits the same file.

## Saving

Typing autosaves to IndexedDB after a short debounce. It does not create remote writes. Save or
Cmd/Ctrl+S uploads referenced local assets to GCS and commits the complete Markdown file to Git.
Delete creates a normal Git deletion commit. Git history supplies revisions and recovery; there
are no mutation records, checkpoints, publication snapshots, or tombstones.

The admin manager opens from IndexedDB immediately. On a browser's first editor visit, the bundled
Markdown snapshot seeds documents that are not already local; it never overwrites a local draft.
Normal list and document reads do not contact GitHub. “Reload from Git” is the explicit destructive
recovery path for discarding local drafts and fetching the current branch.

## Public rendering and offline behavior

Public routes never query authentication, GitHub, or a database. Vite imports all Markdown under
`content/crafts` during the build, and SvelteKit prerenders the collection and known craft routes.
The service worker precaches the craft collection and caches visited craft pages and media.

Document text, UI, and previously visited media therefore remain available offline. Large videos
are cached only after they are requested.

## Custom components

Custom components use the MDX-like syntax supported by the public Markdown parser. Component
definitions own validation and public rendering. Live Preview shows compact placeholders for
single-line components and keeps multiline components editable as source. Source mode remains
available for precise editing and recovery.
