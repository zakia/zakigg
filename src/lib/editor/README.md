# Editor

Markdown, including YAML frontmatter, is the editable document. CodeMirror owns
that text, its selection, and its undo history. Preview features change its
appearance; they do not maintain another document model.

## Where to start

| File                              | Owns                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `Page.ts`                         | The stored page and normalized metadata derived from Markdown. |
| `Editor.svelte`                   | The CodeMirror view, mode switching, and file insertion.       |
| `Workspace.svelte`                | Composition: editor, actions, layout, and save callbacks.      |
| `Session.svelte.ts`               | Current source, browser backups, and the Git save baseline.    |
| `features/index.ts`               | The features installed in live and source modes.               |
| `document/persistence/storage.ts` | IndexedDB pages, assets, and migrations.                       |
| `../crafts/Edit.svelte`           | Loading a craft, its URL, and the repository adapter.          |
| `../crafts/Content.svelte`        | Rendering published content.                                   |

`Workspace` creates one `Session` for one page ID. CodeMirror changes flow to
`session.update(markdown)`. `session.page` derives metadata from the current text.
Controls dispatch changes to YAML in CodeMirror, preserving undo and selection.
The session accepts a page, whether it came from Git, a browser backup function,
and an optional repository save function. There is no separate publication service.

`createPage(properties, body)` creates new source with default metadata, including
`published: false` and a stable slug. `readPage(markdown, previous?)` reads existing
source unchanged; `previous` preserves identity and fallback metadata during edits.
`parseStoredPage` is the compatibility boundary for browser records and archives.

`Editor`, `Workspace`, and `Session` are provisional names. Their responsibilities
above are the boundaries to preserve when revisiting the names or composition.

## A Markdown feature

Each folder in `features/` owns one kind of Markdown: source recognition,
inactive appearance, active appearance, controls, and keyboard behavior. A
feature uses the small contract in `features/feature.ts`:

```ts
const preview = feature({
	find(state) {
		/* return source ranges and parsed data */
	},
	active(state, source) {
		/* optional selection rule */
	},
	render(state, source) {
		/* return CodeMirror decorations */
	},
	edit(state, source) {
		/* optional decorations while editing */
	}
});
```

- `find` reads the current text and returns ranges in CodeMirror coordinates.
- `render` decorates or replaces those ranges when inactive.
- `edit` defaults to no decorations, revealing raw source. It can retain useful
  styling or a preview, as code and images do.
- `active` defaults to a caret strictly inside the range or a selection overlapping
  it. Blocks can use `touches` to include their delimiters; images use `onLine`.
- `keys`, `events`, and `theme` are ordinary CodeMirror extensions exported by the
  feature when needed. `features/index.ts` installs them. List arrow shortcuts
  apply only in live mode because they navigate rendered markers.

The shared lifecycle rebuilds decorations after text, selection, or syntax-tree
changes. Switching modes removes preview fields while preserving text and history.
Source mode retains editing commands and syntax highlighting.

Source positions always come from the current editor state. Widget controls
must dispatch transactions rather than editing rendered DOM or storing a second
copy of editable text. Keyboard commands return `false` when they do not apply,
allowing normal CodeMirror behavior to continue.

### Finding your way around a feature

Start at `index.ts`. After imports, every entry point follows the same reading
order: `preview` (`find`, optional `active`, `render`, optional `edit`), keyboard
bindings, events, and theme. Local helpers and small widgets follow those exports.
Omitted behavior uses the shared defaults; there are no placeholder files or hooks.

Start a feature in that one file. Extract code when it has a substantial, distinct
responsibility or is shared with another consumer:

| File                        | When it earns a separate place                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `source.ts`                 | Source recognition and data transformations used by commands, controls, or public rendering.    |
| `commands.ts`               | Substantial keyboard transactions, as in list indentation, continuation, and renumbering.       |
| A named widget or component | Substantial UI with its own controls or lifecycle, such as the code `Header` or media `Widget`. |

Links fit in `index.ts`, including URL parsing and navigation. Lists use `index.ts`
for preview and bindings, `source.ts` for reading list structure, and `commands.ts`
for edits, including numbering. Code keeps its source parser and interactive
header separate; its public `Content` also uses shared language configuration and
syntax highlighting. Media keeps file insertion separate because it writes assets
to storage, while source recognition is also used by import and public rendering.

File counts can differ. The entry point and the reasons for opening another file
should stay predictable.

### Frontmatter

`features/frontmatter/source.ts` separates `yamlFrom`/`yamlTo`, `fenceTo`, and
`bodyFrom`. The summary replaces only through `fenceTo`. The newline after the
closing fence and the body stay outside that replacement. Entering either fence
or the YAML reveals raw source. Invalid YAML remains visible with an error.

### Rendering

Live preview and public rendering have different jobs. Public rendering produces
HTML and Svelte content; live preview preserves editable source positions. Shared
code rendering configuration and presentation live in `features/code/`. Do not
put public rendering inside a CodeMirror widget lifecycle.

## Saving and opening

1. Typing updates CodeMirror and `Session.markdown`. After 350 ms, `Session.backup()`
   writes a browser copy to IndexedDB. Local writes are serialized.
2. **Save to Git** (or Cmd/Ctrl+S) captures the current source, attempts a browser
   backup, uploads referenced local assets, and commits Markdown through the
   authenticated repository command. Missing/invalid YAML and changed document IDs
   cannot be committed; incomplete source can still be backed up locally.
3. The save lock is independent of typing. Repeated saves share the in-flight
   operation. Only the captured source becomes the saved baseline; typing during
   that save remains dirty. Undoing to the saved source makes the document clean.
4. `published` controls inclusion in the public site. Changing the checkbox only
   edits YAML; it takes effect after Save to Git and a site build. Legacy `draft`
   is read with inverted meaning; explicit `published` takes precedence. Changing
   the setting removes the legacy key. A commit is not deployment confirmation.
5. Opening an existing craft fetches the live repository and its file SHA. Git's
   version is shown first. A differing browser copy is preserved and offered as
   **Restore local changes**. Restoring is an undoable editor transaction. Local-only
   documents remain editable; when Git is unavailable, the browser copy can be
   edited and backed up, but Git saving requires reloading successfully first.
6. Saves must supply the SHA originally loaded (or `null` for a new file). A
   conflict stops the save and preserves local text. It never retries using an
   unseen newer SHA. Reload to inspect Git, then deliberately restore local work.

New and imported documents stay local until explicitly saved. The shared `/crafts` collection shows the public build snapshot to visitors. Signed-in
users automatically see the live repository plus local-only/changed pages, publication
markers, and New/refresh/select controls. `/admin/crafts` redirects to this list. Refreshing
never clears drafts or assets. Public routes continue to read the build snapshot.
The development fallback writes files in `content/crafts`; it does **not** commit
those working-tree changes. The configured GitHub backend creates real commits.

### Tag colors

`src/lib/crafts/tags.json` maps normalized tag names to palette names. The six curated
colors and allocation rules live in `src/lib/crafts/tags.ts`. Existing assignments
stay fixed, even when no post uses a tag. New tags take an unused color first, then
the least-used color. Filters are derived from visible posts, never the registry.
Clicking an active filter clears it; there is no separate All button.

Save to Git updates the post and new assignments in one commit. Both are read from
one branch revision; a non-forced branch update rejects concurrent changes. The
development fallback writes the registry and Markdown locally and serializes saves.
Unknown, unsaved tags render neutrally until saving assigns their color. Tags added
by editing Markdown directly should also be assigned in `src/lib/crafts/tags.json` (or
saved once through the editor).

`src/lib/components/tag.ts` supplies the shared badge color. Public pages use the
build snapshot of the registry. Authenticated reads and saves apply live assignments
as CSS variables, updating both Svelte badges and CodeMirror widgets immediately
without rebuilding the editor or waiting for deployment.

### IndexedDB

Database: `zaki.gg-notes`, schema version 8. It contains:

| Store      | Contents                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages`    | Markdown, derived metadata, IDs, timestamps, and the last known Git Markdown baseline (`gitMarkdown`) when available.                                                       |
| `recovery` | One previous browser copy per document, kept when opening Git would replace differing local text. Restoring first backs it up to `pages`, then removes this recovery entry. |
| `assets`   | Attachment blobs, MIME types, filenames, sizes, timestamps, and associated page IDs.                                                                                        |

The baseline distinguishes unchanged caches from actual local edits; it is not a
sync queue. There is no automatic Git commit, polling, merge engine, or deployment
tracking. Legacy records without a known baseline are treated conservatively as
potential local changes. The upgrade preserves existing pages and asset blobs.
The old one-time snapshot seeding and destructive reload path have been removed.

## Checks

Run `bun run check` and `bun run test`. Feature tests cover source boundaries,
selection transitions, controls, and editing commands. Verify caret navigation,
mode switching, widgets, and autosave in a browser after interaction changes.
