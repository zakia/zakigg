# Editor architecture

Canonical Markdown is the only persisted document format. CodeMirror owns both editing modes:
Source mode shows the Markdown directly; Live Preview decorates the same text and reveals syntax
when the caret enters it. The public renderer reads that Markdown for published pages.

The CodeMirror document contains the entire file, including YAML frontmatter. `title:` supplies
the single visible document heading. Page title, date, tags, slug, and publication status are projections
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

- `src/lib/editor/Editor.svelte` and `src/lib/editor/features` own source editing, Live Preview,
  and file insertion. `Page.ts`, `Session.svelte.ts`, and `document` own the canonical document
  model, Markdown rendering, frontmatter, browser backups, and import/export.
- `src/lib/crafts` owns craft collection and detail UI, publication behavior, and repository calls.
- `src/lib/embeds` owns the custom components used by published Markdown and their shared media UI.
- `src/lib/server/content` owns bundled content reads and explicit Git repository operations.
- `content/crafts` is the public build input and remote source of truth.
- GCS stores binary assets only.

The editor layer does not import application routes or GitHub. The craft edit page supplies the
editing session with a save callback that commits a complete Markdown document.

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
published: false
---

Markdown and allowed custom components.
```

`id` is stable and determines the repository filename. `slug` may change without renaming the
file. `published: false` excludes the document from public builds. Publishing changes that field and
commits the same file.

## Saving

Typing autosaves to IndexedDB after a short debounce. It does not create remote writes. Save or
Cmd/Ctrl+S uploads referenced local assets to GCS and commits the complete Markdown file to Git.
Delete creates a normal Git deletion commit. Git history supplies revisions and recovery; there
are no mutation records, checkpoints, publication snapshots, or tombstones.

The shared `/crafts` collection uses the build snapshot for visitors. Signed-in users also see
repository and local-only pages. Opening a repository page reads its latest Git version and offers
any differing browser copy as recoverable local changes. Refreshing the collection does not clear
local drafts or assets.

## Public rendering and offline behavior

Public craft detail pages read the build snapshot without querying authentication or GitHub. Vite
imports Markdown under `content/crafts` during the build, and SvelteKit prerenders known craft routes.
The service worker precaches the craft collection and caches visited craft pages and media.

Document text, UI, and previously visited media therefore remain available offline. Large videos
are cached only after they are requested.

## Custom components

Custom components use the MDX-like syntax supported by the public Markdown parser. Component
definitions own validation and public rendering. Live Preview shows compact placeholders for
single-line components and keeps multiline components editable as source. Source mode remains
available for precise editing and recovery.
