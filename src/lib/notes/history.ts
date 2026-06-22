import type { JSONContent } from '@tiptap/core';

export const MAX_EDITOR_HISTORY_ENTRIES = 60;

export type EditorHistoryEntry = {
	id: string;
	content: JSONContent;
	signature: string;
	preview: string;
	createdAt: number;
	wordCount: number;
	characterCount: number;
};

export type EditorHistoryDiffLine = {
	id: string;
	type: 'added' | 'removed' | 'context';
	text: string;
};

export type EditorHistoryDiff = {
	lines: EditorHistoryDiffLine[];
	added: number;
	removed: number;
	overflow: number;
};

export function createEditorHistoryEntry(content: JSONContent, id: string): EditorHistoryEntry {
	const snapshot = cloneEditorContent(content);
	const text = getEditorPlainText(snapshot);

	return {
		id,
		content: snapshot,
		signature: getEditorHistorySignature(snapshot),
		preview: summarizeEditorText(text),
		createdAt: Date.now(),
		wordCount: countWords(text),
		characterCount: text.length
	};
}

export function cloneEditorContent(content: JSONContent): JSONContent {
	return JSON.parse(JSON.stringify(content)) as JSONContent;
}

export function getEditorHistorySignature(content: JSONContent) {
	return JSON.stringify(content);
}

export function createEditorHistoryDiff(
	current: JSONContent,
	previous?: JSONContent,
	maxLines = 5
): EditorHistoryDiff {
	const previousLines = previous ? getEditorTextLines(previous) : [];
	const currentLines = getEditorTextLines(current);
	const lines = diffTextLines(previousLines, currentLines);
	const changedLines = lines.filter((line) => line.type !== 'context');
	const visibleLines = changedLines.length ? changedLines : lines.slice(0, maxLines);
	const added = lines.filter((line) => line.type === 'added').length;
	const removed = lines.filter((line) => line.type === 'removed').length;

	return {
		lines: visibleLines.slice(0, maxLines).map((line, index) => ({
			...line,
			id: `${line.type}-${index}-${line.text}`
		})),
		added,
		removed,
		overflow: Math.max(0, visibleLines.length - maxLines)
	};
}

function getEditorPlainText(content: JSONContent) {
	const chunks: string[] = [];

	collectText(content, chunks);

	return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function getEditorTextLines(content: JSONContent) {
	const lines: string[] = [];

	collectTextLines(content, lines);

	return lines;
}

function collectTextLines(node: JSONContent, lines: string[]) {
	if (node.type && isLineNode(node.type)) {
		const text = getNodeText(node);

		if (text) {
			lines.push(text);
		}

		return;
	}

	for (const child of node.content ?? []) {
		collectTextLines(child, lines);
	}
}

function isLineNode(type: string) {
	return ['paragraph', 'heading', 'codeBlock', 'listItem', 'table_cell', 'table_header'].includes(
		type
	);
}

function getNodeText(node: JSONContent) {
	const chunks: string[] = [];

	collectText(node, chunks);

	return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function collectText(node: JSONContent, chunks: string[]) {
	if (node.text) {
		chunks.push(node.text);
	}

	for (const child of node.content ?? []) {
		collectText(child, chunks);
	}
}

function summarizeEditorText(text: string) {
	if (!text) return 'Empty document';
	if (text.length <= 72) return text;

	return `${text.slice(0, 72).trimEnd()}...`;
}

function countWords(text: string) {
	if (!text) return 0;

	return text.split(/\s+/).filter(Boolean).length;
}

type DiffLineInput = Omit<EditorHistoryDiffLine, 'id'>;

function diffTextLines(previousLines: string[], currentLines: string[]): DiffLineInput[] {
	if (!previousLines.length && !currentLines.length) {
		return [{ type: 'context', text: 'Empty document' }];
	}

	if (!previousLines.length) {
		return currentLines.map((text) => ({ type: 'added', text }));
	}

	if (!currentLines.length) {
		return previousLines.map((text) => ({ type: 'removed', text }));
	}

	if (previousLines.length * currentLines.length > 12_000) {
		return [
			...previousLines.map((text) => ({ type: 'removed' as const, text })),
			...currentLines.map((text) => ({ type: 'added' as const, text }))
		];
	}

	const table = Array.from({ length: previousLines.length + 1 }, () =>
		Array.from({ length: currentLines.length + 1 }, () => 0)
	);

	for (let previousIndex = previousLines.length - 1; previousIndex >= 0; previousIndex -= 1) {
		for (let currentIndex = currentLines.length - 1; currentIndex >= 0; currentIndex -= 1) {
			table[previousIndex][currentIndex] =
				previousLines[previousIndex] === currentLines[currentIndex]
					? table[previousIndex + 1][currentIndex + 1] + 1
					: Math.max(
							table[previousIndex + 1][currentIndex],
							table[previousIndex][currentIndex + 1]
						);
		}
	}

	const diff: DiffLineInput[] = [];
	let previousIndex = 0;
	let currentIndex = 0;

	while (previousIndex < previousLines.length && currentIndex < currentLines.length) {
		if (previousLines[previousIndex] === currentLines[currentIndex]) {
			diff.push({ type: 'context', text: previousLines[previousIndex] });
			previousIndex += 1;
			currentIndex += 1;
			continue;
		}

		if (table[previousIndex + 1][currentIndex] >= table[previousIndex][currentIndex + 1]) {
			diff.push({ type: 'removed', text: previousLines[previousIndex] });
			previousIndex += 1;
			continue;
		}

		diff.push({ type: 'added', text: currentLines[currentIndex] });
		currentIndex += 1;
	}

	while (previousIndex < previousLines.length) {
		diff.push({ type: 'removed', text: previousLines[previousIndex] });
		previousIndex += 1;
	}

	while (currentIndex < currentLines.length) {
		diff.push({ type: 'added', text: currentLines[currentIndex] });
		currentIndex += 1;
	}

	return diff;
}
