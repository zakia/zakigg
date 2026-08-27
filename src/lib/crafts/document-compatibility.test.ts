import { describe, expect, it } from 'vitest';
import quotes from './quotes/content.md?raw';
import rings from './rings/content.md?raw';
import { getCraftDocumentMarkdown, migrateCraftDocumentToMarkdown } from './document-content';
import type { CraftDocument } from './types';
import {
	editorContentToMarkdown,
	markdownBodyToEditorContent
} from '$lib/editor/document/markdown-ast';

const markdownCorpus = [
	['quotes', quotes],
	['rings', rings]
] as const;

describe('craft document compatibility corpus', () => {
	it.each(markdownCorpus)('keeps the canonical %s craft stable', (_name, markdown) => {
		const stableMarkdown = editorContentToMarkdown(markdownBodyToEditorContent(markdown));
		const secondPass = editorContentToMarkdown(markdownBodyToEditorContent(stableMarkdown));

		expect(markdown).not.toBe('');
		expect(secondPass).toBe(stableMarkdown);
	});

	it('keeps the legacy boundary available for stored v1 crafts', () => {
		const legacy: CraftDocument = {
			version: 1,
			editor: 'tiptap',
			content: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Legacy body' }] }]
			}
		};
		const markdown = getCraftDocumentMarkdown(legacy);

		expect(markdown).toBe('Legacy body\n');
		expect(migrateCraftDocumentToMarkdown(legacy)).toEqual({
			version: 2,
			format: 'markdown',
			markdown
		});
	});

	it('round-trips the complete authoring syntax without semantic drift', () => {
		const markdown = `## Compatibility document

Paragraph with **bold**, _emphasis_, ~~strike~~, [a link](https://example.com), and \`code\`.

> [!WARNING]
> Preserve existing content before migration.

| Feature | State |
| --- | --- |
| Tables | supported |

\`\`\`ts title="example.ts"
const canonical: string = 'markdown'
\`\`\`

<Image src="https://example.com/image.jpg" alt="Example" width={75} />

<Columns gap="medium">
<Column width={2}>
### Main

- One
- Two
</Column>
<Column>
Secondary column
</Column>
</Columns>
`;
		const first = editorContentToMarkdown(markdownBodyToEditorContent(markdown));
		const second = editorContentToMarkdown(markdownBodyToEditorContent(first));

		expect(second).toBe(first);
		expect(first).toContain('> [!WARNING]');
		expect(first).toContain('<Columns gap="medium">');
		expect(first).toContain('title="example.ts"');
	});
});
