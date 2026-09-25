# Crafts product requirements

## Product model

- `/crafts` and `/crafts/<slug>` are public, prerendered, account-free reader surfaces.
- `/admin/crafts` and `/admin/crafts/<slug>` are private editing surfaces.
- Canonical Markdown files in Git contain all document metadata and body content.
- GCS stores binary assets referenced by stable asset IDs.
- IndexedDB provides local draft autosave and offline editing, not remote authority.

## Editor

- Visual and source modes must always produce the same canonical Markdown.
- Standard Markdown, GFM tables, wiki links, and registered custom components are supported.
- Invalid custom syntax must remain recoverable in source mode.
- Cmd/Ctrl+S and the Save action commit one complete Markdown file to Git.
- Publishing toggles `draft` in frontmatter and commits.
- Links, tables, media controls, selection, clipboard operations, and component controls must remain
  directly interactive in visual mode.

## Authentication

- Public reading performs no account check.
- An admin password is verified server-side; the single administrator signs in with a password.
- A signed HTTP-only session protects every repository mutation and asset upload.
- A server-side GitHub App writes only to the configured repository and branch.

## Storage

- There is no remote document database, publication copy, sync log, or deletion record.
- Deleting a craft deletes its Markdown file in a Git commit.
- Git history provides audit and recovery.
- The browser can discard its entire local cache and reload Markdown from Git.

## Offline behavior

- Public craft text and the application shell work offline after installation/visit.
- Previously requested public media is cached.
- Local editing may continue offline, but committing requires network access.
