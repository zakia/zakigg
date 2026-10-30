# Editor architecture

The persisted document is a key and its complete Markdown source, including
optional YAML frontmatter. The editor uses the same CodeMirror text in Live Preview
and Source mode; reading produces a separate presentation of that text.

See `src/lib/editor/README.md` for code ownership and `editor-architecture-plan.md`
for the agreed product contract and verification criteria.

## Seams

- Markdown interpretation owns generic properties, embed meaning, and diagnostics.
  It does not know craft URLs, publication requirements, rendering implementations,
  or storage providers.
- Editor features own source positions, selection, decorations, keyboard behavior,
  and widget lifecycle. Host configuration supplies link and attachment resolution,
  file insertion, embed presentation, and tag presentation.
- A small editing session tracks current source, explicit Save, errors, and the
  saved baseline. Properties and widget edits share CodeMirror's undo history.
- The craft host projects title, tags, date, slug, and publication from Markdown.
  Those projections are not parallel editable or persisted document state.
- Text and binary attachment stores have GCS and filesystem adapters. Provider
  selection happens in `src/lib/server/storage/index.ts`. Shared craft policy sits
  above them, in the content repository.

## Save and errors

Only Save or Cmd/Ctrl+S writes documents. Validate captured source, persist referenced
new attachments, then write Markdown. Mark that exact source saved; later typing
remains dirty. Invalid YAML and configured embed props produce source diagnostics.
Ordinary unfinished Markdown is valid. Preview failures preserve visible source.

Failures keep current text available for retry. Unsaved navigation warns. There is
no autosave, document recovery, sync queue, optimistic conflict check, merge engine,
or Git Save. The current single-editor workflow uses last-save-wins behavior.

## Local and cloud storage

Local Markdown files retain `content/crafts/<id>.md`. Tag assignments retain their
existing registry file. Local attachments live under `.data/assets` and are served
through the same `/media/` routes as cloud attachments. Local mode requires no GCS
credentials.

GCS retains `content/crafts/` and `assets/` paths, bundled seed fallback, and deletion
records for removed seeds. A content hash supports compiled-content caching only.
The generic storage seam does not claim transactional or globally ordered writes
for every possible future KV provider.

## Interaction requirements

Preserve code title/language/highlighting/copy controls, source reveal, list nesting
and selection, tables, media, and custom embeds. Mode switches preserve source,
selection, and undo. The detailed list contract is in `editor-list-behavior.md`.
Obsidian guides interaction behavior; full vault interoperability is deferred.
