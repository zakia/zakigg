import type { Editor, JSONContent } from '@tiptap/core';

type MarkdownEditor = Editor & {
	getMarkdown: () => string;
	markdown?: {
		parse: (markdown: string) => JSONContent;
	};
};

const MARKDOWN_FILE_RE = /\.(md|markdown|mdown|mkdn)$/i;
const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const MARKDOWN_BLOCK_RE =
	/^[ \t]{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S|>\s+\S|`{3,}|~{3,}|-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|\|.+\||::component\{)/m;
const MARKDOWN_INLINE_RE = /(?:!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/;

export function getEditorMarkdown(editor?: Editor) {
	return editor ? (editor as MarkdownEditor).getMarkdown() : '';
}

export function insertEditorMarkdown(editor: Editor | undefined, markdown: string) {
	if (!editor || !markdown.trim()) return false;

	const content = (editor as MarkdownEditor).markdown?.parse(markdown)?.content;

	if (!content?.length) return false;

	return editor.chain().focus().insertContent(normalizeMarkdownContent(content)).run();
}

export function looksLikeMarkdown(value: string) {
	const text = value.trim();

	if (!text) return false;
	if (text.includes('::component{')) return true;

	return MARKDOWN_BLOCK_RE.test(text) || MARKDOWN_INLINE_RE.test(text);
}

export function getMarkdownFiles(data: DataTransfer | null | undefined) {
	if (!data) return [];

	const files = new Map<string, File>();

	for (const file of Array.from(data.files ?? [])) {
		if (isMarkdownFile(file)) files.set(getFileKey(file), file);
	}

	for (const item of Array.from(data.items ?? [])) {
		if (item.kind !== 'file') continue;

		const file = item.getAsFile();
		if (file && isMarkdownFile(file)) files.set(getFileKey(file), file);
	}

	return [...files.values()];
}

export function isMarkdownFile(file: File) {
	return MARKDOWN_MIME_TYPES.has(file.type.toLowerCase()) || MARKDOWN_FILE_RE.test(file.name);
}

export function downloadMarkdownFile(markdown: string) {
	const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
	document.body.append(anchor);
	anchor.click();
	window.setTimeout(() => {
		anchor.remove();
		URL.revokeObjectURL(url);
	}, 1000);
}

function getFileKey(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':');
}

function normalizeMarkdownContent(content: JSONContent[]) {
	return content.map(normalizeMarkdownNode);
}

function normalizeMarkdownNode(node: JSONContent): JSONContent {
	const content = node.content?.map(normalizeMarkdownNode);

	if (node.type === 'listItem' && content?.[0]?.type !== 'paragraph') {
		return {
			...node,
			content: [{ type: 'paragraph' }, ...(content ?? [])]
		};
	}

	return {
		...node,
		...(content ? { content } : {})
	};
}
