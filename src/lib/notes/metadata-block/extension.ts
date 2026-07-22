import { mergeAttributes, Node, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, TextSelection, type EditorState } from '@tiptap/pm/state';
import { createMetadataBlockNodeView } from './view';
import { focusMetadataBlockEdge } from './focus';
import {
	METADATA_BLOCK_NODE_NAME,
	normalizeMetadataBlockAttrs,
	normalizeMetadataEntries,
	slugifyText,
	type MetadataEntry
} from './config';

type ArrowDirection = 'up' | 'down' | 'left' | 'right';

// Deliberately in no group: the document schema (`metadataBlock block+`)
// admits it only as the required first child, so it can never be inserted
// elsewhere or deleted.
export const MetadataBlock = Node.create({
	name: METADATA_BLOCK_NODE_NAME,
	priority: 1000,
	atom: true,
	selectable: true,
	isolating: true,

	addAttributes() {
		return {
			properties: {
				default: []
			},
			collapsed: {
				default: true
			},
			adding: {
				default: false,
				rendered: false
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'section[data-note-metadata]',
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) return false;

					return normalizeMetadataBlockAttrs({
						properties: parseJsonAttribute(element.dataset.noteMetadataProperties),
						collapsed: element.dataset.collapsed === 'true',
						adding: false
					});
				}
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const attrs = normalizeMetadataBlockAttrs(node.attrs);

		return [
			'section',
			mergeAttributes(HTMLAttributes, {
				'data-note-metadata': '',
				'data-note-metadata-properties': JSON.stringify(attrs.properties),
				'data-collapsed': attrs.collapsed ? 'true' : null
			}),
			['strong', {}, 'Properties']
		];
	},

	addKeyboardShortcuts() {
		return {
			ArrowDown: () => focusMetadataBlockFromArrow(this.editor, 'down'),
			ArrowUp: () => focusMetadataBlockFromArrow(this.editor, 'up'),
			ArrowRight: () => focusMetadataBlockFromArrow(this.editor, 'right'),
			ArrowLeft: () => focusMetadataBlockFromArrow(this.editor, 'left'),
			// The schema keeps a metadata block present, but a delete that spans
			// it would make ProseMirror synthesize a fresh EMPTY block to
			// satisfy the schema — silently wiping the properties. Swallow the
			// deletes that would reach it instead.
			Backspace: () => preventLeadingMetadataBlockDeletion(this.editor),
			Delete: () => isMetadataBlockSelection(this.editor.state.selection),
			// Select-all covers the content below the block; the properties are
			// metadata, not part of the text selection.
			'Mod-a': () => selectContentBelowMetadataBlock(this.editor),
			Enter: () => {
				const { selection } = this.editor.state;

				if (!isMetadataBlockSelection(selection)) return false;

				return focusMetadataBlockEdge(this.editor.view.nodeDOM(selection.from), 'first');
			}
		};
	},

	addProseMirrorPlugins() {
		return [createTitleSyncPlugin()];
	},

	addNodeView() {
		return createMetadataBlockNodeView(this.editor);
	}
});

// Keep the `title`/`slug` properties following the first H1 while they still
// match what the heading last produced; a manual edit to either property
// diverges it and stops the auto-sync.
function createTitleSyncPlugin() {
	return new Plugin({
		appendTransaction(transactions, oldState, newState) {
			if (!transactions.some((tr) => tr.docChanged && tr.getMeta('addToHistory') !== false)) {
				return null;
			}

			const previousTitle = getFirstLevelOneHeadingText(oldState.doc);
			const nextTitle = getFirstLevelOneHeadingText(newState.doc);
			if (previousTitle === nextTitle) return null;

			const block = findTopLevelMetadataBlock(newState.doc);
			if (!block) return null;

			const entries = normalizeMetadataEntries(block.node.attrs.properties);
			const titleEntry = entries.find((entry) => entry.key === 'title');
			const slugEntry = entries.find((entry) => entry.key === 'slug');
			const currentTitle = typeof titleEntry?.value === 'string' ? titleEntry.value : '';
			const currentSlug = typeof slugEntry?.value === 'string' ? slugEntry.value : '';
			const syncTitle =
				Boolean(titleEntry || nextTitle) && (!currentTitle || currentTitle === previousTitle);
			const syncSlug =
				Boolean(slugEntry || nextTitle) &&
				(!currentSlug || currentSlug === slugifyText(previousTitle));

			if (!syncTitle && !syncSlug) return null;

			const next: MetadataEntry[] = entries.map((entry) => {
				if (syncTitle && entry.key === 'title') return { key: 'title', value: nextTitle };
				if (syncSlug && entry.key === 'slug') return { key: 'slug', value: slugifyText(nextTitle) };

				return entry;
			});

			if (syncSlug && !slugEntry) next.unshift({ key: 'slug', value: slugifyText(nextTitle) });
			if (syncTitle && !titleEntry) next.unshift({ key: 'title', value: nextTitle });
			if (JSON.stringify(next) === JSON.stringify(entries)) return null;

			return newState.tr.setNodeMarkup(block.pos, undefined, {
				...block.node.attrs,
				properties: next
			});
		}
	});
}

function getFirstLevelOneHeadingText(doc: ProseMirrorNode) {
	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);

		if (node.type.name === 'heading' && Number(node.attrs.level) === 1) {
			return node.textContent.trim().replace(/\s+/g, ' ');
		}
	}

	return '';
}

function findTopLevelMetadataBlock(doc: ProseMirrorNode) {
	let offset = 0;

	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);

		if (node.type.name === METADATA_BLOCK_NODE_NAME) {
			return {
				node,
				pos: offset
			};
		}

		offset += node.nodeSize;
	}
}

// True (= swallow the key) when a backspace would merge into or delete the
// leading metadata block: either the block itself is node-selected, or the
// caret sits at the very start of the top-level block right after it.
function preventLeadingMetadataBlockDeletion(editor: Editor) {
	const { selection, doc } = editor.state;

	if (isMetadataBlockSelection(selection)) return true;
	if (!(selection instanceof TextSelection) || !selection.empty) return false;

	const { $head } = selection;

	return (
		$head.depth === 1 &&
		$head.index(0) === 1 &&
		$head.parentOffset === 0 &&
		doc.child(0).type.name === METADATA_BLOCK_NODE_NAME
	);
}

function selectContentBelowMetadataBlock(editor: Editor) {
	const { state, view } = editor;
	const { doc } = state;

	if (doc.childCount < 2 || doc.child(0).type.name !== METADATA_BLOCK_NODE_NAME) return false;

	view.dispatch(
		state.tr.setSelection(
			TextSelection.between(doc.resolve(doc.child(0).nodeSize), doc.resolve(doc.content.size))
		)
	);

	return true;
}

function isMetadataBlockSelection(selection: EditorState['selection']): selection is NodeSelection {
	return (
		selection instanceof NodeSelection && selection.node.type.name === METADATA_BLOCK_NODE_NAME
	);
}

// Arrow keys never node-select the block: moving toward it from an adjacent
// text block enters its property fields instead.
function focusMetadataBlockFromArrow(editor: Editor, direction: ArrowDirection) {
	const forward = direction === 'down' || direction === 'right';
	const { state, view } = editor;
	const { selection } = state;

	if (isMetadataBlockSelection(selection)) {
		return focusMetadataBlockEdge(view.nodeDOM(selection.from), forward ? 'first' : 'last');
	}

	if (!selection.empty) return false;

	const position = getAdjacentMetadataBlockPos(editor, direction, forward);
	if (position === undefined) return false;

	return focusMetadataBlockEdge(view.nodeDOM(position), forward ? 'first' : 'last');
}

function getAdjacentMetadataBlockPos(editor: Editor, direction: ArrowDirection, forward: boolean) {
	const { state, view } = editor;
	const { selection } = state;
	const { $head } = selection;

	if (selection instanceof TextSelection) {
		if ($head.depth < 1 || !view.endOfTextblock(direction)) return;

		if (forward) {
			const after = $head.after(1);

			return state.doc.nodeAt(after)?.type.name === METADATA_BLOCK_NODE_NAME ? after : undefined;
		}

		const index = $head.index(0);
		if (index <= 0) return;

		const before = state.doc.child(index - 1);

		return before.type.name === METADATA_BLOCK_NODE_NAME
			? $head.before(1) - before.nodeSize
			: undefined;
	}

	// Gap cursors sit directly between top-level blocks.
	const adjacent = forward ? $head.nodeAfter : $head.nodeBefore;
	if (adjacent?.type.name !== METADATA_BLOCK_NODE_NAME) return;

	return forward ? $head.pos : $head.pos - adjacent.nodeSize;
}

function parseJsonAttribute(value: string | undefined): JSONContent['attrs'] {
	if (!value) return {};

	try {
		const parsed: unknown = JSON.parse(value);

		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}
