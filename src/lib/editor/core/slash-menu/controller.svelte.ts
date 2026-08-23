import type { Editor, Range } from '@tiptap/core';
import type { BlockPaletteItem } from '../blocks';

export type SlashMenuState = {
	visible: boolean;
	query: string;
	from: number;
	to: number;
	left: number;
	top: number;
	activeIndex: number;
};

type SlashMenuControllerOptions = {
	getEditor: () => Editor | undefined;
	getItems: () => BlockPaletteItem[];
	onSelect: (id: string, range: Range) => void;
};

export class SlashMenuController {
	state = $state<SlashMenuState>(createHiddenSlashMenu());

	#getEditor: () => Editor | undefined;
	#getItems: () => BlockPaletteItem[];
	#onSelect: (id: string, range: Range) => void;

	constructor({ getEditor, getItems, onSelect }: SlashMenuControllerOptions) {
		this.#getEditor = getEditor;
		this.#getItems = getItems;
		this.#onSelect = onSelect;
	}

	get items() {
		const query = this.state.query.toLowerCase();

		return this.#getItems().filter((item) =>
			`${item.label} ${item.description}`.toLowerCase().includes(query)
		);
	}

	syncFromEditor() {
		const editor = this.#getEditor();

		if (!editor || editor.isDestroyed || !editor.state.selection.empty) {
			this.close();
			return;
		}

		const cursor = editor.state.selection.$from;
		if (cursor.parent.type.name !== 'paragraph') {
			this.close();
			return;
		}

		const textBefore = cursor.parent.textBetween(0, cursor.parentOffset, undefined, '\ufffc');
		const match = /^\/([^\s/]*)$/.exec(textBefore);
		if (!match) {
			this.close();
			return;
		}

		const query = match[1] ?? '';
		const coords = editor.view.coordsAtPos(cursor.pos);
		const itemCount = this.#filterItems(query).length;
		const queryChanged = query !== this.state.query;

		this.state = {
			visible: true,
			query,
			from: cursor.start(),
			to: cursor.pos,
			left: coords.left,
			top: coords.bottom + 8,
			activeIndex: queryChanged ? 0 : Math.min(this.state.activeIndex, Math.max(0, itemCount - 1))
		};
	}

	handleKeydown(event: KeyboardEvent) {
		if (!this.state.visible || event.isComposing) return false;

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const count = this.items.length;
			const direction = event.key === 'ArrowDown' ? 1 : -1;
			if (count) this.setActiveIndex((this.state.activeIndex + direction + count) % count);
			return true;
		}

		if (event.key === 'Enter') {
			const item = this.items[this.state.activeIndex];
			if (!item) return false;

			event.preventDefault();
			this.select(item.id);
			return true;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			this.close();
			return true;
		}

		return false;
	}

	select(id: string) {
		if (!this.state.visible) return;

		const range = { from: this.state.from, to: this.state.to };
		this.close();
		this.#onSelect(id, range);
	}

	setActiveIndex(index: number) {
		if (!this.state.visible || index === this.state.activeIndex) return;
		this.state.activeIndex = index;
	}

	close() {
		if (!this.state.visible) return;
		this.state = createHiddenSlashMenu();
	}

	#filterItems(query: string) {
		const normalized = query.toLowerCase();
		return this.#getItems().filter((item) =>
			`${item.label} ${item.description}`.toLowerCase().includes(normalized)
		);
	}
}

function createHiddenSlashMenu(): SlashMenuState {
	return { visible: false, query: '', from: 0, to: 0, left: 0, top: 0, activeIndex: 0 };
}
