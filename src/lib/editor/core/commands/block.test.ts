import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { runBlockCommand } from './block';

function createEditor() {
	return new Editor({
		extensions: [StarterKit],
		content: {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }]
		}
	});
}

describe('block commands', () => {
	it('duplicates and deletes blocks through one command boundary', () => {
		const editor = createEditor();

		try {
			expect(runBlockCommand(editor, { type: 'duplicate', pos: 0 })).toBe(true);
			expect(editor.getJSON().content).toHaveLength(2);

			expect(runBlockCommand(editor, { type: 'delete', pos: 0 })).toBe(true);
			expect(editor.getJSON().content).toEqual([
				{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }
			]);
		} finally {
			editor.destroy();
		}
	});

	it('inserts below without exposing Tiptap to the menu', () => {
		const editor = createEditor();

		try {
			expect(runBlockCommand(editor, { type: 'insert-below', pos: 0 })).toBe(true);
			expect(editor.getJSON().content).toHaveLength(2);
		} finally {
			editor.destroy();
		}
	});
});
