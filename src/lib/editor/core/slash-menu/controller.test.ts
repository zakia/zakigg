import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';
import type { BlockPaletteItem } from '../blocks';
import { SlashMenuController } from './controller.svelte';

const items = [
	{ id: 'paragraph', label: 'Text', description: 'Plain paragraph', icon: 'text' },
	{ id: 'heading-1', label: 'Heading 1', description: 'Large section heading', icon: 'heading' },
	{
		id: 'code-block',
		label: 'Code block',
		description: 'Code with syntax highlighting',
		icon: 'code'
	},
	{ id: 'timer', label: 'Timer', description: 'Interactive component', icon: 'timer' }
] as BlockPaletteItem[];

function createEditor(textBefore: string) {
	return {
		state: {
			selection: {
				empty: true,
				$from: {
					parent: {
						type: { name: 'paragraph' },
						textBetween: () => textBefore
					},
					parentOffset: textBefore.length,
					pos: textBefore.length + 1,
					start: () => 1
				}
			}
		},
		view: {
			coordsAtPos: () => ({ left: 10, bottom: 20 })
		}
	} as unknown as Editor;
}

describe('SlashMenuController', () => {
	it('resets selection to the first result when the query changes', () => {
		let editor = createEditor('/');
		const controller = new SlashMenuController({
			getEditor: () => editor,
			getItems: () => items,
			onSelect: vi.fn()
		});

		controller.syncFromEditor();
		controller.setActiveIndex(1);
		editor = createEditor('/co');
		controller.syncFromEditor();

		expect(controller.state.activeIndex).toBe(0);
		expect(controller.items[0]?.id).toBe('code-block');
	});

	it('does not inspect coordinates before the editor view is mounted', () => {
		const editor = {
			isDestroyed: true,
			get state() {
				throw new Error('state should not be inspected');
			}
		} as unknown as Editor;
		const controller = new SlashMenuController({
			getEditor: () => editor,
			getItems: () => items,
			onSelect: vi.fn()
		});

		expect(() => controller.syncFromEditor()).not.toThrow();
		expect(controller.state.visible).toBe(false);
	});
});
