import type { JSONContent } from '@tiptap/core';

export const NOTES_DOC_VERSION = 1;
export const NOTES_EDITOR = 'tiptap';
export const DEFAULT_NOTE_ID = 'default';
export const NOTES_STORAGE_KEY = 'zaki.gg:notes:v1:default';

export const EMPTY_TIPTAP_DOC = {
	type: 'doc',
	content: [
		{
			type: 'paragraph'
		}
	]
} satisfies JSONContent;

export type NotesDocV1 = {
	version: typeof NOTES_DOC_VERSION;
	editor: typeof NOTES_EDITOR;
	content: JSONContent;
	updatedAt: string;
};

export function createNotesDoc(
	content: JSONContent,
	updatedAt = new Date().toISOString()
): NotesDocV1 {
	return {
		version: NOTES_DOC_VERSION,
		editor: NOTES_EDITOR,
		content,
		updatedAt
	};
}

export function parseStoredNote(value: unknown): NotesDocV1 | null {
	if (!value || typeof value !== 'object') return null;

	const note = value as Partial<NotesDocV1>;

	if (
		note.version !== NOTES_DOC_VERSION ||
		note.editor !== NOTES_EDITOR ||
		typeof note.updatedAt !== 'string' ||
		!isJSONContent(note.content)
	) {
		return null;
	}

	return {
		version: NOTES_DOC_VERSION,
		editor: NOTES_EDITOR,
		content: note.content,
		updatedAt: note.updatedAt
	};
}

function isJSONContent(value: unknown): value is JSONContent {
	return Boolean(
		value && typeof value === 'object' && typeof (value as JSONContent).type === 'string'
	);
}
