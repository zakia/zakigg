import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { runBlockTurn, type BlockTurnTarget } from '../blocks';

export type BlockCommand =
	| { type: 'edit'; pos: number }
	| { type: 'duplicate'; pos: number }
	| { type: 'insert-below'; pos: number }
	| { type: 'delete'; pos: number }
	| { type: 'turn-into'; pos: number; target: BlockTurnTarget };

/**
 * The single command boundary for actions initiated by block UI. Keeping the
 * menu declarative makes these operations reusable by keyboard commands and
 * future command-palette surfaces without teaching UI components ProseMirror.
 */
export function runBlockCommand(editor: Editor, command: BlockCommand) {
	switch (command.type) {
		case 'edit':
			return openBlockEditMode(editor, command.pos);
		case 'duplicate':
			return duplicateBlock(editor, command.pos);
		case 'insert-below':
			return insertParagraphBelow(editor, command.pos);
		case 'delete':
			return deleteBlock(editor, command.pos);
		case 'turn-into':
			return turnBlockInto(editor, command.pos, command.target);
	}
}

function openBlockEditMode(editor: Editor, pos: number) {
	const dom = editor.view.nodeDOM(pos);

	if (!(dom instanceof HTMLElement)) return false;

	dom.dispatchEvent(new CustomEvent('editor-block-edit'));
	return true;
}

function duplicateBlock(editor: Editor, pos: number) {
	const node = editor.state.doc.nodeAt(pos);

	if (!node) return false;

	editor.view.dispatch(editor.state.tr.insert(pos + node.nodeSize, node.copy(node.content)));
	return true;
}

function deleteBlock(editor: Editor, pos: number) {
	const node = editor.state.doc.nodeAt(pos);

	if (!node) return false;

	editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
	focusMountedEditor(editor);
	return true;
}

function insertParagraphBelow(editor: Editor, pos: number) {
	const node = editor.state.doc.nodeAt(pos);
	const paragraph = editor.schema.nodes.paragraph?.create();

	if (!node || !paragraph) return false;

	const insertAt = pos + node.nodeSize;
	const insertedNode =
		node.type.name === 'listItem'
			? editor.schema.nodes.listItem?.create(null, paragraph)
			: paragraph;

	if (!insertedNode) return false;

	const transaction = editor.state.tr.insert(insertAt, insertedNode);

	transaction.setSelection(
		TextSelection.create(transaction.doc, insertAt + (node.type.name === 'listItem' ? 2 : 1))
	);
	editor.view.dispatch(transaction);
	focusMountedEditor(editor);
	return true;
}

function turnBlockInto(editor: Editor, pos: number, target: BlockTurnTarget) {
	const node = editor.state.doc.nodeAt(pos);

	if (!node) return false;

	editor
		.chain()
		.setTextSelection(pos + 1)
		.focus()
		.run();
	return runBlockTurn(editor, target);
}

function focusMountedEditor(editor: Editor) {
	if (editor.options.element) editor.view.focus();
}
