# Markdown editor

A document is `{ id, markdown }`. Markdown includes optional YAML frontmatter.
Derived properties, diagnostics, and presentation are not persisted document state.
CodeMirror owns the source, selection, and undo history in both editing modes.

## Ownership

| File                            | Owns                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `Document.ts`                   | Source-only document records and legacy archive compatibility                |
| `document/frontmatter.ts`       | Generic YAML reading and source-preserving property edits                    |
| `document/embeds.ts`            | Embed prop decoding, nesting, and nested Markdown interpretation             |
| `document/validation.ts`        | Source diagnostics using the host's pure embed validation role               |
| `document/markdown-renderer.ts` | Reading output and safe source fallback                                      |
| `Editor.svelte`                 | CodeMirror lifecycle, mode switching, asynchronous insertion positions       |
| `features/`                     | Source recognition, selection rules, decorations, commands, widget lifecycle |
| `configuration.ts`              | Host-supplied links, attachments, embed presentation, and tag colors         |
| `Session.svelte.ts`             | Explicit Save state and the successfully saved source baseline               |

`../crafts/Page.ts` is a derived craft view, not the generic document model.
Craft controls, public article headings, URLs, publication validation, and embed
catalog selection belong to `../crafts`. Legacy craft file import/export helpers
remain in `document/persistence` for compatibility; the editor does not use them.
`document/persistence/storage.ts` stages attachment blobs only, not document recovery.

## Editing contract

Live Preview decorates the same source used by Source mode. Switching modes keeps
selection and undo history. Property controls dispatch source changes through the
same CodeMirror view. Widgets must not keep their own editable text copies.

Each Markdown feature starts at its `index.ts`: source recognition, selection,
preview, editing appearance, commands, and events. Shared lifecycle belongs to
`features/feature.ts`. Keep substantial helpers separate when they own real work,
such as code headers, media interaction, or list transactions.

The shared interpretation module does not force CodeMirror and reading to use one
parser. CodeMirror needs incremental source positions; reading uses a Markdown AST.
They share frontmatter, embed meaning, validation, and heading/link interpretation.
Invalid previews leave source accessible. Save diagnostics identify a source line.

The host supplies `EditorOptions`: file insertion, attachment resolution, wiki-link
resolution, embed mounting/cleanup, and optional tag colors. An editor without those
options can still edit ordinary Markdown. It imports no craft catalog or provider.
Embed presentation has a failure boundary and an explicit retry control.

## Explicit Save

Typing performs no document persistence. Save or Cmd/Ctrl+S captures the source,
validates it, persists needed attachments, and writes Markdown through the host.
Only the captured source becomes the saved baseline; typing during Save remains
unsaved. Repeated explicit requests serialize without parallel writes. Failures
keep text editable and permit retry. Unsaved navigation warns before discarding.

There is no autosave, browser document recovery, conflict UI, merge engine, or Git
commit behavior. Storage uses last-save-wins for the current single-editor workflow.

## Persistence

`../server/storage/index.ts` selects both text and attachment storage once.
Filesystem text values are written atomically. Local attachment records live under
`.data/assets` with their bytes and serving metadata. GCS adapters preserve existing
`content/crafts/` and `assets/` object paths.

`../server/content/repository.ts` applies craft indexing, seed/deletion behavior,
and tag allocation once over the provider-independent text store. Neither adapter
parses Markdown or allocates tags. The `sha` field is a content-cache token only;
it is not an expected revision or a condition for Save.

## Verification

Use `bun run check`, targeted Vitest files while editing, and `bun run test` before
completion. The source, Save, and storage interfaces are the test surfaces. Storage
contract tests cover actual filesystem persistence and a GCS Bucket stand-in;
they do not verify live GCS credentials or HTTP behavior.

Run the checks in `scripts/editor/README.md` against a local development server for
caret positioning and selection at desktop/mobile widths. The list keyboard
contract is in `docs/editor-list-behavior.md`. Test a local attachment upload and
read through the application routes, then explicitly save and reload a disposable
craft before deleting it.
