import type { Editor, JSONContent } from '@tiptap/core';
import { createTimer } from '../../timers';
import {
	MAX_EDITOR_HISTORY_ENTRIES,
	cloneEditorContent,
	createEditorHistoryEntry,
	getEditorHistorySignature,
	type EditorHistoryEntry
} from './history';

type EditorHistoryControllerOptions = {
	getEditor: () => Editor | undefined;
	onEditorChange: () => void;
};

export class EditorHistoryController {
	entries = $state<EditorHistoryEntry[]>([]);
	activeId = $state('');
	previewId = $state('');
	panelOpen = $state(false);

	#getEditor: () => Editor | undefined;
	#onEditorChange: () => void;
	#entryIndex = 0;
	#previewReturnContent: JSONContent | null = null;
	#snapshotTimer = createTimer();

	constructor({ getEditor, onEditorChange }: EditorHistoryControllerOptions) {
		this.#getEditor = getEditor;
		this.#onEditorChange = onEditorChange;
	}

	getPersistableContent() {
		return this.#previewReturnContent ?? this.#getEditor()?.getJSON();
	}

	initialize(content: JSONContent) {
		this.#recordFromContent(content);
	}

	scheduleSnapshot() {
		this.#snapshotTimer.schedule(() => this.#recordSnapshot(), 550);
	}

	togglePanel() {
		if (!this.panelOpen) this.#flushSnapshot();
		this.panelOpen = !this.panelOpen;
	}

	closePanel() {
		this.clearPreview();
		this.panelOpen = false;
	}

	restore(entry: EditorHistoryEntry) {
		const editor = this.#getEditor();
		if (!editor) return;

		this.clearPreview();
		const currentSignature = getEditorHistorySignature(editor.getJSON());

		this.#snapshotTimer.cancel();
		this.activeId = entry.id;

		if (currentSignature === entry.signature) {
			editor.commands.focus();
			return;
		}

		editor.commands.setContent(cloneEditorContent(entry.content));
		editor.commands.focus();
	}

	preview(entry: EditorHistoryEntry) {
		const editor = this.#getEditor();
		if (!editor || entry.id === this.activeId) return;

		this.#previewReturnContent ??= editor.getJSON();
		this.previewId = entry.id;
		this.#replaceContentForPreview(entry.content);
	}

	clearPreview() {
		if (!this.#previewReturnContent) return;

		const content = this.#previewReturnContent;
		this.#previewReturnContent = null;
		this.previewId = '';
		this.#replaceContentForPreview(content);
	}

	destroy() {
		this.#snapshotTimer.cancel();
	}

	#flushSnapshot() {
		this.#snapshotTimer.cancel();
		this.#recordSnapshot();
	}

	#recordSnapshot() {
		const editor = this.#getEditor();
		if (!editor) return;

		this.#recordFromContent(this.#previewReturnContent ?? editor.getJSON());
	}

	#recordFromContent(content: JSONContent) {
		const signature = getEditorHistorySignature(content);
		const existing = this.entries.find((entry) => entry.signature === signature);

		if (existing) {
			this.activeId = existing.id;
			return;
		}

		const entry = createEditorHistoryEntry(content, this.#createId());
		this.entries = [entry, ...this.entries].slice(0, MAX_EDITOR_HISTORY_ENTRIES);
		this.activeId = entry.id;
	}

	#createId() {
		this.#entryIndex += 1;
		return `history-${Date.now()}-${this.#entryIndex}`;
	}

	#replaceContentForPreview(content: JSONContent) {
		const editor = this.#getEditor();
		if (!editor) return;

		const document = editor.schema.nodeFromJSON(cloneEditorContent(content));
		const transaction = editor.state.tr
			.replaceWith(0, editor.state.doc.content.size, document)
			.setMeta('addToHistory', false)
			.setMeta('preventUpdate', true);

		editor.view.dispatch(transaction);
		this.#onEditorChange();
	}
}
