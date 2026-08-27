<script lang="ts">
	import { browser } from '$app/environment';
	import MilkdownEditor from '../milkdown/MilkdownEditor.svelte';

	const STORAGE_KEY = 'zaki.gg:milkdown-kit-shell-v4';
	const DEFAULT_MARKDOWN = `# A Markdown-native editor

Select some of this sentence to try the Svelte formatting toolbar. It is portalled outside the document, so appearing and disappearing should not move the page.

Type \`/\` on an empty line for headings, lists, code, Columns, and YouTube.

\`\`\`typescript
const canonicalDocument: string = 'markdown'
\`\`\`

<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />

<Columns gap="medium">
<Column width={60}>
Main column
</Column>
<Column width={40}>
Secondary column
</Column>
</Columns>
`;

	const initialMarkdown = browser ? (localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MARKDOWN) : '';
</script>

<main class="document-shell">
	<MilkdownEditor
		{initialMarkdown}
		onMarkdownChange={(markdown) => localStorage.setItem(STORAGE_KEY, markdown)}
		onError={(error) => console.error('Milkdown Kit spike failed to start', error)}
	/>
</main>

<style>
	.document-shell {
		box-sizing: border-box;
		flex: 1;
		margin-inline: auto;
		min-height: 100%;
		padding: clamp(var(--s2), 7vw, calc(var(--s4) * 1.35)) var(--s0)
			calc(var(--mobile-nav-height) + var(--s4));
		width: min(100%, 54rem);
	}
</style>
