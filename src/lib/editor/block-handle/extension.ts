import { Extension, type Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { DragHandlePlugin, normalizeNestedOptions } from '@tiptap/extension-drag-handle';
import { offset, shift } from '@floating-ui/dom';
import {
	createBlockCatalog,
	runBlockTurn,
	type BlockCatalog,
	type BlockDescriptor,
	type BlockTurnTarget
} from '$lib/editor/blocks';

// The hovered block, described for the handle UI. Positioning is owned by the
// drag-handle extension (floating-ui), so no coordinates travel with the
// target — the handle element is placed in the gutter for us.
export type BlockHandleTarget = BlockDescriptor & {
	pos: number;
	nodeTypeName: string;
	turnable: boolean;
};

type BlockHandleOptions = {
	catalog: BlockCatalog;
	// The DOM element the drag-handle positions and makes draggable. It is
	// owned by the Svelte layer (BlockHandle.svelte) and handed in here so the
	// extension can bind ProseMirror's native drag to the visible grip.
	getElement?: () => HTMLElement | null;
	onTargetChange?: (target: BlockHandleTarget | null) => void;
};

// The block handle is now built on @tiptap/extension-drag-handle: it owns hover
// detection, gutter positioning (floating-ui) and native drag-to-reorder. We
// only translate its node-change signal into a describe-able target for our
// own chip + menu UI, and keep the in-place block operations the menu invokes.
export const BlockHandle = Extension.create<BlockHandleOptions>({
	name: 'blockHandle',

	addOptions() {
		return {
			catalog: createBlockCatalog(),
			getElement: undefined,
			onTargetChange: undefined
		};
	},

	addProseMirrorPlugins() {
		const element = this.options.getElement?.();

		// No handle element yet (e.g. server render) — run without the plugin.
		if (!element) return [];

		const { catalog, onTargetChange } = this.options;

		const { plugin } = DragHandlePlugin({
			editor: this.editor,
			element,
			pluginKey: 'blockHandle',
			// Prefer individual list items while retaining top-level block dragging.
			nestedOptions: normalizeNestedOptions({
				rules: [
					{
						id: 'nested-lists-only',
						evaluate: ({ depth, $pos }) => {
							if (depth <= 1) return 0;

							for (let ancestorDepth = 1; ancestorDepth < depth; ancestorDepth += 1) {
								const name = $pos.node(ancestorDepth).type.name;
								if (name === 'bulletList' || name === 'orderedList') return 0;
							}

							return 1000;
						}
					}
				],
				edgeDetection: 'none'
			}),
			computePositionConfig: {
				placement: 'left-start',
				// The editor scrolls inside its own viewport. Fixed coordinates keep
				// floating-ui's viewport measurements aligned after any scroll depth.
				strategy: 'fixed',
				// offset sits the handle in the gutter; shift with crossAxis:true
				// nudges it back horizontally (the cross axis for a left placement)
				// when the gutter is too narrow, instead of clipping off-screen.
				middleware: [offset({ mainAxis: 4, crossAxis: 1 }), shift({ padding: 4, crossAxis: true })]
			},
			onNodeChange: ({ node, pos }) => {
				if (!node || catalog.isExcluded(node)) {
					onTargetChange?.(null);
					return;
				}

				onTargetChange?.({
					...catalog.describe(node),
					pos,
					nodeTypeName: node.type.name,
					turnable: catalog.canTurn(node)
				});
			}
		});

		return [plugin];
	}
});

// The drag-handle repositions/hides itself on hover; locking freezes it in
// place so the block menu doesn't slip to another block while it is open.
export function lockBlockHandle(editor: Editor) {
	editor.view.dispatch(editor.state.tr.setMeta('lockDragHandle', true));
}

export function unlockBlockHandle(editor: Editor) {
	editor.view.dispatch(editor.state.tr.setMeta('lockDragHandle', false));
}

export function hideBlockHandle(editor: Editor) {
	editor.view.dispatch(editor.state.tr.setMeta('hideDragHandle', true));
}

export function openBlockEditMode(editor: Editor, pos: number) {
	const dom = editor.view.nodeDOM(pos);

	if (!(dom instanceof HTMLElement)) return;

	dom.dispatchEvent(new CustomEvent('editor-block-edit'));
}

export function duplicateBlock(editor: Editor, pos: number) {
	const node = editor.state.doc.nodeAt(pos);

	if (!node) return;

	editor.view.dispatch(editor.state.tr.insert(pos + node.nodeSize, node.copy(node.content)));
}

export function deleteBlock(editor: Editor, pos: number) {
	const node = editor.state.doc.nodeAt(pos);

	if (!node) return;

	editor
		.chain()
		.focus()
		.deleteRange({ from: pos, to: pos + node.nodeSize })
		.run();
}

export function insertParagraphBelow(editor: Editor, pos: number) {
	const node = editor.state.doc.nodeAt(pos);
	const paragraph = editor.schema.nodes.paragraph?.create();

	if (!node || !paragraph) return;

	const insertAt = pos + node.nodeSize;
	const insertedNode =
		node.type.name === 'listItem'
			? editor.schema.nodes.listItem?.create(null, paragraph)
			: paragraph;

	if (!insertedNode) return;

	const tr = editor.state.tr.insert(insertAt, insertedNode);

	tr.setSelection(TextSelection.create(tr.doc, insertAt + (node.type.name === 'listItem' ? 2 : 1)));
	editor.view.dispatch(tr);
	editor.view.focus();
}

// In-place conversion for simple textblocks (see canTurnBlockInto).
export function turnBlockInto(editor: Editor, pos: number, target: BlockTurnTarget) {
	const node = editor.state.doc.nodeAt(pos);

	if (!node) return;

	const chain = editor
		.chain()
		.setTextSelection(pos + 1)
		.focus();

	chain.run();
	runBlockTurn(editor, target);
}
