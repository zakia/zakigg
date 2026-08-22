import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { canJoin } from '@tiptap/pm/transform';

type ListTypeName = 'bulletList' | 'orderedList';
type ListMarker = {
	listTypeName: ListTypeName;
	attrs: Record<string, unknown>;
};

const listContinuityPluginKey = new PluginKey('listContinuity');
const BULLET_MARKER_PATTERN = /^[-+*]$/;
const ORDERED_MARKER_PATTERN = /^(\d+)\.$/;

function findAncestorDepth($position: ResolvedPos, name: string) {
	for (let depth = $position.depth; depth > 0; depth -= 1) {
		if ($position.node(depth).type.name === name) {
			return depth;
		}
	}
}

function findListDepth($position: ResolvedPos) {
	for (let depth = $position.depth; depth > 0; depth -= 1) {
		const nodeName = $position.node(depth).type.name;

		if (nodeName === 'bulletList' || nodeName === 'orderedList') {
			return depth;
		}
	}
}

function parseListMarker(value: string): ListMarker | undefined {
	if (BULLET_MARKER_PATTERN.test(value)) {
		return {
			listTypeName: 'bulletList',
			attrs: {}
		};
	}

	const orderedMatch = ORDERED_MARKER_PATTERN.exec(value);

	if (orderedMatch) {
		return {
			listTypeName: 'orderedList',
			attrs: {
				start: Number(orderedMatch[1])
			}
		};
	}
}

function setCurrentListType(
	editor: Editor,
	listTypeName: ListTypeName,
	attrs: Record<string, unknown>
) {
	return editor.commands.command(({ state, dispatch }) => {
		const listDepth = findListDepth(state.selection.$from);
		const listType = state.schema.nodes[listTypeName];

		if (!listDepth || !listType) {
			return false;
		}

		const listPosition = state.selection.$from.before(listDepth);
		const currentList = state.selection.$from.node(listDepth);
		const nextAttrs = listTypeName === 'orderedList' ? attrs : {};

		if (currentList.type.name === listTypeName) {
			if (listTypeName === 'orderedList') {
				dispatch?.(state.tr.setNodeMarkup(listPosition, undefined, nextAttrs));
			}

			return true;
		}

		dispatch?.(state.tr.setNodeMarkup(listPosition, listType, nextAttrs));

		return true;
	});
}

function applyListMarkerShortcut(editor: Editor) {
	const { state } = editor;
	const { selection } = state;

	if (!selection.empty) {
		return false;
	}

	const { $from } = selection;

	if ($from.parent.type.name !== 'paragraph' || $from.parent.type.spec.code) {
		return false;
	}

	const marker = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
	const listMarker = parseListMarker(marker);

	if (!listMarker) {
		return false;
	}

	const listItemDepth = findAncestorDepth($from, 'listItem');
	const listDepth = findListDepth($from);

	if (!listItemDepth || !listDepth) {
		return false;
	}

	const listItem = $from.node(listItemDepth);
	const markerIsOnlyItemContent = listItem.childCount === 1 && $from.parent.textContent === marker;

	if (!markerIsOnlyItemContent) {
		return false;
	}

	const markerFrom = $from.pos - marker.length;
	const markerTo = $from.pos;
	const listItemIndex = $from.index(listDepth);

	editor.commands.deleteRange({ from: markerFrom, to: markerTo });

	if (listItemIndex > 0) {
		editor.commands.sinkListItem('listItem');
	}

	setCurrentListType(editor, listMarker.listTypeName, listMarker.attrs);

	return true;
}

export const ListMarkerInput = Extension.create({
	name: 'listMarkerInput',

	addKeyboardShortcuts() {
		return {
			Space: () => applyListMarkerShortcut(this.editor)
		};
	}
});

export const ListContinuity = Extension.create({
	name: 'listContinuity',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: listContinuityPluginKey,
				appendTransaction: (transactions, _oldState, newState) => {
					if (!transactions.some((transaction) => transaction.docChanged)) return null;

					let transaction = newState.tr;
					let joinPosition = findAdjacentListJoinPosition(transaction.doc);

					while (joinPosition !== undefined) {
						transaction = transaction.join(joinPosition);
						joinPosition = findAdjacentListJoinPosition(transaction.doc);
					}

					return transaction.docChanged ? transaction : null;
				}
			})
		];
	}
});

function findAdjacentListJoinPosition(doc: ProseMirrorNode) {
	let joinPosition: number | undefined;

	doc.descendants((node, position, parent, index) => {
		if (joinPosition !== undefined || !parent) return false;

		const next = parent.maybeChild(index + 1);

		if (next && canMergeAdjacentLists(node, next) && canJoin(doc, position + node.nodeSize)) {
			joinPosition = position + node.nodeSize;
			return false;
		}

		return true;
	});

	return joinPosition;
}

function canMergeAdjacentLists(left: ProseMirrorNode, right: ProseMirrorNode) {
	if (!isListNode(left) || left.type !== right.type) return false;

	if (left.type.name !== 'orderedList') return true;

	return Number(right.attrs?.start ?? 1) === 1;
}

function isListNode(node: ProseMirrorNode) {
	return node.type.name === 'bulletList' || node.type.name === 'orderedList';
}
