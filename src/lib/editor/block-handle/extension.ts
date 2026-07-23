import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { ComponentEmbedRegistry } from '$lib/editor/component-embeds';
import {
	canTurnBlockInto,
	describeBlockNode,
	findTopLevelBlockAtY,
	findTopLevelBlockByTarget,
	type BlockDescriptor,
	type HoveredBlock
} from './blocks';

export type BlockHandleTarget = BlockDescriptor & {
	pos: number;
	nodeTypeName: string;
	turnable: boolean;
	rect: { top: number; left: number; width: number; height: number };
};

export type BlockTurnTarget =
	| 'text'
	| 'heading-1'
	| 'heading-2'
	| 'heading-3'
	| 'bullet-list'
	| 'ordered-list'
	| 'quote'
	| 'code';

type BlockHandleOptions = {
	registry?: ComponentEmbedRegistry;
	onTargetChange?: (target: BlockHandleTarget | null) => void;
};

// How far left of the content the pointer still counts as "in the gutter".
const GUTTER_REACH = 64;

export const BlockHandle = Extension.create<BlockHandleOptions>({
	name: 'blockHandle',

	addOptions() {
		return {
			registry: undefined,
			onTargetChange: undefined
		};
	},

	addProseMirrorPlugins() {
		const options = this.options;

		return [
			new Plugin({
				key: new PluginKey('blockHandle'),
				view(view) {
					return createBlockHandleWatcher(view, options);
				}
			})
		];
	}
});

// Two complementary signals drive the handle:
// - retargeting is event-driven per node: crossing a block boundary fires
//   mouseover exactly once, so tracking is precise with no sampling;
// - a trailing-throttled document mousemove covers only what node events
//   cannot see — the left gutter (no node under the pointer) and leaving
//   the editor entirely.
function createBlockHandleWatcher(view: EditorView, options: BlockHandleOptions) {
	let lastTarget: BlockHandleTarget | null = null;
	let pendingMove: MouseEvent | null = null;
	let moveTimer = 0;

	const publish = (target: BlockHandleTarget | null) => {
		if (!target && !lastTarget) return;
		if (
			target &&
			lastTarget &&
			target.pos === lastTarget.pos &&
			target.rect.top === lastTarget.rect.top
		) {
			return;
		}

		lastTarget = target;
		options.onTargetChange?.(target);
	};

	const publishBlock = (block: HoveredBlock) => {
		const rect = block.dom.getBoundingClientRect();

		publish({
			...describeBlockNode(block.node, options.registry),
			pos: block.pos,
			nodeTypeName: block.node.type.name,
			turnable: canTurnBlockInto(block.node),
			rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
		});
	};

	const handleMouseOver = (event: MouseEvent) => {
		if (!view.editable) return;

		const block = findTopLevelBlockByTarget(view, event.target);

		if (block) publishBlock(block);
	};

	const locate = (event: MouseEvent) => {
		// Interacting with the handle UI itself must not re-target or hide it.
		if (event.target instanceof Element && event.target.closest('[data-block-handle-ui]')) {
			return;
		}

		if (!view.editable) {
			publish(null);
			return;
		}

		const editorRect = view.dom.getBoundingClientRect();
		const withinBand =
			event.clientX >= editorRect.left - GUTTER_REACH &&
			event.clientX <= editorRect.right &&
			event.clientY >= editorRect.top &&
			event.clientY <= editorRect.bottom;

		if (!withinBand) {
			publish(null);
			return;
		}

		const block =
			findTopLevelBlockByTarget(view, event.target) ?? findTopLevelBlockAtY(view, event.clientY);

		// In the gaps between blocks, keep the current handle rather than
		// flickering it away.
		if (block) publishBlock(block);
	};

	// Trailing-edge throttle: the LAST pointer position is always processed,
	// so the handle can never stick on a stale block. setTimeout (not rAF)
	// because rAF stalls in non-rendering tabs.
	const handleMouseMove = (event: MouseEvent) => {
		pendingMove = event;

		if (moveTimer) return;

		moveTimer = window.setTimeout(() => {
			moveTimer = 0;

			if (!pendingMove) return;

			const moveEvent = pendingMove;

			pendingMove = null;
			locate(moveEvent);
		}, 32);
	};

	const hide = () => publish(null);

	view.dom.addEventListener('mouseover', handleMouseOver);
	document.addEventListener('mousemove', handleMouseMove);
	document.addEventListener('scroll', hide, true);
	document.addEventListener('dragend', hide);

	return {
		update(_view: EditorView, previousState: { doc: unknown }) {
			// Document edits invalidate the cached position and rect.
			if (view.state.doc !== previousState.doc) hide();
		},
		destroy() {
			if (moveTimer) window.clearTimeout(moveTimer);
			view.dom.removeEventListener('mouseover', handleMouseOver);
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('scroll', hide, true);
			document.removeEventListener('dragend', hide);
			publish(null);
		}
	};
}

// Starts a ProseMirror-native drag of the block at `pos`: node-selects it,
// serializes the slice for cross-app drops, uses the block's real DOM as the
// drag preview, and registers the move with the editor view so dropping
// relocates rather than copies.
export function startBlockDrag(editor: Editor, pos: number, event: DragEvent) {
	const view = editor.view;
	const node = view.state.doc.nodeAt(pos);

	if (!node || !event.dataTransfer) return false;

	view.focus();

	const selection = NodeSelection.create(view.state.doc, pos);

	view.dispatch(view.state.tr.setSelection(selection));

	const slice = selection.content();
	const serialize = (
		view as EditorView & {
			serializeForClipboard?: (content: typeof slice) => { dom: HTMLElement; text: string };
		}
	).serializeForClipboard?.bind(view);

	event.dataTransfer.clearData();

	if (serialize) {
		const { dom, text } = serialize(slice);

		event.dataTransfer.setData('text/html', dom.innerHTML);
		event.dataTransfer.setData('text/plain', text);
	}

	event.dataTransfer.effectAllowed = 'copyMove';

	const dom = view.nodeDOM(pos);

	if (dom instanceof HTMLElement) {
		event.dataTransfer.setDragImage(dom, 0, dom.offsetHeight / 2);
	}

	(view as { dragging: unknown }).dragging = { slice, move: true };

	return true;
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
	const tr = editor.state.tr.insert(insertAt, paragraph);

	tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
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

	switch (target) {
		case 'text':
			chain.setParagraph().run();
			return;
		case 'heading-1':
		case 'heading-2':
		case 'heading-3':
			chain.setHeading({ level: Number(target.slice(-1)) as 1 | 2 | 3 }).run();
			return;
		case 'bullet-list':
			chain.setParagraph().toggleBulletList().run();
			return;
		case 'ordered-list':
			chain.setParagraph().toggleOrderedList().run();
			return;
		case 'quote':
			chain.setParagraph().toggleBlockquote().run();
			return;
		case 'code':
			chain.toggleCodeBlock().run();
			return;
	}
}
