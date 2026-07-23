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

// Position of the hovered block in the coordinate space of the editor host
// (the scroll content). The handle UI renders absolutely inside that same
// element, so content and handle share one coordinate space and scrolling
// needs no handling at all.
export type BlockHandleTarget = BlockDescriptor & {
	pos: number;
	nodeTypeName: string;
	turnable: boolean;
	position: { top: number; left: number; width: number; height: number };
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

// The watcher's entire event surface: mousemove over the editor host (which
// spans the gutter) retargets, mouseleave hides, document edits hide. The
// pointer is resolved per node from the event target, with a geometric
// fallback for the gutter where no node can receive events.
function createBlockHandleWatcher(view: EditorView, options: BlockHandleOptions) {
	const host = view.dom.parentElement ?? view.dom;
	// The event boundary must be the element the handle UI is mounted in
	// (the positioned scroll container) — if it were an inner element, moving
	// the pointer onto the handle would fire mouseleave, hide the handle,
	// re-enter, re-show, and oscillate.
	const boundary = (view.dom.offsetParent as HTMLElement | null) ?? host;
	let lastTarget: BlockHandleTarget | null = null;
	let pendingMove: MouseEvent | null = null;
	let moveTimer = 0;

	const publish = (target: BlockHandleTarget | null) => {
		if (!target && !lastTarget) return;
		if (target && lastTarget && target.pos === lastTarget.pos) {
			const samePlace =
				target.position.top === lastTarget.position.top &&
				target.position.left === lastTarget.position.left;

			if (samePlace) return;
		}

		lastTarget = target;
		options.onTargetChange?.(target);
	};

	const publishBlock = (block: HoveredBlock) => {
		const hostRect = host.getBoundingClientRect();
		const rect = block.dom.getBoundingClientRect();

		publish({
			...describeBlockNode(block.node, options.registry),
			pos: block.pos,
			nodeTypeName: block.node.type.name,
			turnable: canTurnBlockInto(block.node),
			position: {
				top: rect.top - hostRect.top,
				left: rect.left - hostRect.left,
				width: rect.width,
				height: rect.height
			}
		});
	};

	const locate = (event: MouseEvent) => {
		// Interacting with the handle UI itself must not re-target it.
		if (event.target instanceof Element && event.target.closest('[data-block-handle-ui]')) {
			return;
		}

		if (!view.editable) {
			publish(null);
			return;
		}

		const block =
			findTopLevelBlockByTarget(view, event.target) ?? findTopLevelBlockAtY(view, event.clientY);

		// In the gaps between blocks, keep the current handle rather than
		// flickering it away.
		if (block) publishBlock(block);
	};

	// Trailing-edge throttle: the LAST pointer position is always processed.
	// setTimeout (not rAF) because rAF stalls in non-rendering tabs.
	const handleMouseMove = (event: MouseEvent) => {
		pendingMove = event;

		if (moveTimer) return;

		moveTimer = window.setTimeout(() => {
			moveTimer = 0;

			if (!pendingMove) return;

			const moveEvent = pendingMove;

			pendingMove = null;
			locate(moveEvent);
		}, 24);
	};

	const handleMouseLeave = (event: MouseEvent) => {
		// Defense in depth: never hide because the pointer moved onto the
		// handle itself, wherever it happens to be mounted.
		if (
			event.relatedTarget instanceof Element &&
			event.relatedTarget.closest('[data-block-handle-ui]')
		) {
			return;
		}

		pendingMove = null;
		publish(null);
	};

	boundary.addEventListener('mousemove', handleMouseMove);
	boundary.addEventListener('mouseleave', handleMouseLeave);

	return {
		update(_view: EditorView, previousState: { doc: unknown }) {
			// Document edits shift block positions; hide until the pointer
			// signals where it is again.
			if (view.state.doc !== previousState.doc) publish(null);
		},
		destroy() {
			if (moveTimer) window.clearTimeout(moveTimer);
			boundary.removeEventListener('mousemove', handleMouseMove);
			boundary.removeEventListener('mouseleave', handleMouseLeave);
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
