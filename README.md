# zaki.gg

The source for zaki.gg: a SvelteKit PWA for publishing interactive crafts and editing local-first,
block-based documents.

## Development

Requirements:

- Bun 1.3+
- Node.js 22+
- Google Cloud Application Default Credentials for cloud-backed development

Install dependencies and start the configured development server:

```sh
bun install
bun run dev
```

Use `bun run dev:local` when configuration is provided through a local `.env` instead of the
deployed Cloud Run service.

## Quality checks

```sh
bun run check
bun run test
bun run lint
bun run build
```

## Architecture

- [Editor architecture](docs/editor-architecture.md)
- [Craft editor product requirements](docs/notes-prd.md)
- [Deployment and infrastructure](docs/deployment.md)
- [Number Snug puzzle](docs/puzzle.md)

The public reader lives at `/crafts/<slug>`. The private manager and editor live at
`/crafts?edit` and `/crafts/<slug>?edit`.
