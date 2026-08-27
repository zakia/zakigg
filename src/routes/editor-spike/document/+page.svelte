<script lang="ts">
	import { componentEmbeds } from '$lib/embeds';
	import MilkdownDocumentEditor from '$lib/editor/document/MilkdownDocumentEditor.svelte';
	import { createNotePage } from '$lib/editor/document/model';

	const page = createNotePage({
		id: 'page_milkdown_document_spike',
		slug: 'milkdown-document-spike',
		title: 'Milkdown document adapter',
		properties: [
			{ key: 'title', value: 'Milkdown document adapter' },
			{ key: 'date', value: '2026-08-24' },
			{ key: 'tags', value: ['editor', 'markdown'] }
		],
		markdown: `---
title: Milkdown document adapter
date: 2026-08-24
tags:
  - editor
  - markdown
---

This route exercises the production page contract: metadata, save state, export, and the Kit/Svelte editing surface.

<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />

<Columns gap="medium">
<Column width={60}>
The first column remains directly editable.
</Column>
<Column width={40}>
Drag the divider to change the canonical Markdown widths.
</Column>
</Columns>
`
	});
</script>

<MilkdownDocumentEditor {page} embeds={componentEmbeds} isSyncEnabled={() => false} />
