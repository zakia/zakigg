# Editor architecture

Canonical Markdown is the only persisted document format. Milkdown/ProseMirror provides the
visual editing projection, CodeMirror provides source editing, and both round-trip through the
same Markdown string.

```text
public build                     private editor
content/crafts/*.md              /admin/crafts/*
        ↓                               ↓
Markdown parser                  Milkdown + CodeMirror
        ↓                               ↓
static craft pages               IndexedDB draft
                                        ↓ explicit Save
                                  Git repository adapter
```

## Ownership

- `src/lib/editor/milkdown` owns visual editing behavior and Markdown serialization.
- `src/lib/editor/document` owns the canonical document model, frontmatter, local drafts,
  import/export, and the editing session.
- `src/lib/crafts` owns craft routes, Git commit commands, publication controls, and the custom
  component registry.
- `src/lib/server/content` owns repository reads and writes.
- `content/crafts` is the public build input and remote source of truth.
- GCS stores binary assets only.

The editor layer does not import application routes or GitHub. The application injects a
`DocumentRepositoryAdapter` that commits a complete Markdown document.

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

The admin manager normally refreshes repository documents into the local cache. “Reload from Git”
is the explicit destructive recovery path for discarding local drafts.

## Public rendering and offline behavior

Public routes never query authentication, GitHub, or a database. Vite imports all Markdown under
`content/crafts` during the build, and SvelteKit prerenders the collection and known craft routes.
The service worker precaches the craft collection and caches visited craft pages and media.

Document text, UI, and previously visited media therefore remain available offline. Large videos
are cached only after they are requested.

## Custom components

Custom components use the MDX-like syntax supported by the shared Markdown parser. Component
definitions own validation, editor NodeViews, and public rendering. Unknown or invalid components
must fail visibly while source mode remains available for recovery.
