import type { Editor } from '@tiptap/core';

type MarkdownEditor = Editor & { getMarkdown: () => string };

export function getEditorMarkdown(editor?: Editor) {
	return editor ? (editor as MarkdownEditor).getMarkdown() : '';
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
