import { InputRule, mergeAttributes, Node, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, TextSelection, type EditorState } from '@tiptap/pm/state';
import { createMetadataBlockNodeView } from './view';
import { focusMetadataBlockEdge } from './focus';
import {
	METADATA_BLOCK_NODE_NAME,
	createMetadataBlockContent,
	normalizeMetadataBlockAttrs,
	normalizeMetadataEntries,
	slugifyText,
	type MetadataBlockAttrs,
	type MetadataEntry,
	type MetadataPropertiesInput
} from './config';

type ArrowDirection = 'up' | 'down' | 'left' | 'right';

type MetadataBlockInsertAttrs = Partial<Omit<MetadataBlockAttrs, 'properties'>> & {
	properties?: MetadataPropertiesInput;
};

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		metadataBlock: {
			insertMetadataBlock: (attrs?: MetadataBlockInsertAttrs) => ReturnType;
		};
	}
}

export const MetadataBlock = Node.create({
	name: METADATA_BLOCK_NODE_NAME,
	priority: 1000,
	group: 'block',
	atom: true,
	selectable: true,
	isolating: true,

	addAttributes() {
		return {
			properties: {
				default: []
			},
			collapsed: {
				default: false
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

	addCommands() {
		return {
			insertMetadataBlock:
				(attrs = {}) =>
				({ commands }) => {
					const properties = normalizeMetadataEntries(attrs.properties);
					const shouldOpenPicker = attrs.adding ?? properties.length === 0;

					return commands.insertContent(
						createMetadataBlockContent(properties, {
							collapsed: attrs.collapsed === true,
							adding: shouldOpenPicker
						})
					);
				}
		};
	},

	addInputRules() {
		return [
			new InputRule({
				find: /^---$/,
				handler: ({ state, range }) => {
					const block = getMetadataTriggerBlock(state.doc, range.from);

					if (!block) return null;

					const metadataBlock = this.type.create({
						properties: [],
						collapsed: false,
						adding: true
					});
					const paragraph = state.schema.nodes.paragraph?.create();
					const transaction = state.tr.delete(block.replaceFrom, block.pos + block.node.nodeSize);

					transaction.insert(
						block.replaceFrom,
						paragraph ? [metadataBlock, paragraph] : metadataBlock
					);

					if (paragraph) {
						transaction.setSelection(
							TextSelection.create(transaction.doc, block.replaceFrom + metadataBlock.nodeSize + 1)
						);
					}

					transaction.scrollIntoView();
				}
			})
		];
	},

	addKeyboardShortcuts() {
		return {
			ArrowDown: () => focusMetadataBlockFromArrow(this.editor, 'down'),
			ArrowUp: () => focusMetadataBlockFromArrow(this.editor, 'up'),
			ArrowRight: () => focusMetadataBlockFromArrow(this.editor, 'right'),
			ArrowLeft: () => focusMetadataBlockFromArrow(this.editor, 'left'),
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

function getMetadataTriggerBlock(doc: ProseMirrorNode, position: number) {
	const resolved = doc.resolve(position);

	if (resolved.depth !== 1) return;

	const blockStart = resolved.before(1);
	const block = getTopLevelBlockAt(doc, blockStart);

	if (!block || block.node.type.name !== 'paragraph') return;
	if (block.node.textContent !== '--' && block.node.textContent !== '---') return;
	if (block.index <= 0) return;

	const previous = getPreviousNonEmptyTopLevelBlock(doc, block.index);
	const previousIsFirstHeading =
		previous?.node.type.name === 'heading' &&
		Number(previous.node.attrs.level) === 1 &&
		!hasLevelOneHeadingBefore(doc, previous.index);

	if (!previousIsFirstHeading) return;

	return {
		...block,
		replaceFrom:
			previous.index + 1 < block.index
				? (getTopLevelBlockAtIndex(doc, previous.index + 1)?.pos ?? block.pos)
				: block.pos
	};
}

function getTopLevelBlockAt(doc: ProseMirrorNode, position: number) {
	let offset = 0;

	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);

		if (offset === position) {
			return {
				index,
				pos: offset,
				node
			};
		}

		offset += node.nodeSize;
	}
}

function hasLevelOneHeadingBefore(doc: ProseMirrorNode, endIndex: number) {
	for (let index = 0; index < endIndex; index += 1) {
		const node = doc.child(index);

		if (node.type.name === 'heading' && Number(node.attrs.level) === 1) return true;
	}

	return false;
}

function getPreviousNonEmptyTopLevelBlock(doc: ProseMirrorNode, beforeIndex: number) {
	for (let index = beforeIndex - 1; index >= 0; index -= 1) {
		const node = doc.child(index);

		if (node.type.name === 'paragraph' && !node.textContent.trim()) continue;

		return {
			index,
			node
		};
	}
}

function getTopLevelBlockAtIndex(doc: ProseMirrorNode, targetIndex: number) {
	let offset = 0;

	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);

		if (index === targetIndex) {
			return {
				index,
				pos: offset,
				node
			};
		}

		offset += node.nodeSize;
	}
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
