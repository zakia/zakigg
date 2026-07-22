import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import MetadataBlock from './MetadataBlock.svelte';
import { normalizeMetadataBlockAttrs, type MetadataEntry } from './config';

export function createMetadataBlockNodeView(editor: Editor) {
	return ({
		node,
		getPos
	}: {
		node: ProseMirrorNode;
		getPos: () => number | undefined;
	}): NodeView => {
		let currentNode = node;
		const root = document.createElement('section');
		const nodeStore = writable(currentNode);

		const updateAttributes = (attributes: Record<string, unknown>) => {
			const position = getPos();

			if (typeof position !== 'number') return;

			editor.commands.command(({ tr }) => {
				tr.setNodeMarkup(position, undefined, {
					...currentNode.attrs,
					...attributes
				});

				return true;
			});
		};

		const updateProperties = (properties: MetadataEntry[]) => {
			updateAttributes({
				properties
			});
		};

		const setCollapsed = (collapsed: boolean) => {
			updateAttributes({
				collapsed
			});
		};

		const setAdding = (adding: boolean) => {
			updateAttributes({
				adding
			});
		};

		// Moves the caret back into the document on either side of the block.
		// Must never leave focus dangling: falls forward when there is nothing
		// before the block, inserts a trailing paragraph when nothing follows,
		// and as a last resort focuses the document edge.
		const exitBlock = (side: 'before' | 'after') => {
			const position = getPos();

			if (typeof position !== 'number') {
				editor.commands.focus(side === 'before' ? 'start' : 'end');
				return;
			}

			const after = position + currentNode.nodeSize;
			const applied = editor
				.chain()
				.focus(undefined, { scrollIntoView: false })
				.command(({ tr }) => {
					const selection =
						side === 'before'
							? (findTextSelectionBefore(tr.doc, position) ?? findTextSelectionAfter(tr.doc, after))
							: findTextSelectionAfter(tr.doc, after);

					if (selection) {
						tr.setSelection(selection).scrollIntoView();

						return true;
					}

					const paragraph = editor.schema.nodes.paragraph?.create();
					if (!paragraph) return false;

					tr.insert(after, paragraph)
						.setSelection(TextSelection.create(tr.doc, after + 1))
						.scrollIntoView();

					return true;
				})
				.run();

			if (!applied) editor.commands.focus(side === 'before' ? 'start' : 'end');
		};

		root.className = 'metadata-block-node';
		root.setAttribute('data-note-metadata', '');
		root.contentEditable = 'false';

		const component = mount(MetadataBlock, {
			target: root,
			props: {
				node: nodeStore,
				updateProperties,
				setCollapsed,
				setAdding,
				exitBlock
			}
		});
		flushSync();

		return {
			dom: root,

			update(updatedNode) {
				if (updatedNode.type.name !== currentNode.type.name) return false;

				currentNode = updatedNode;
				root.toggleAttribute(
					'data-collapsed',
					normalizeMetadataBlockAttrs(currentNode.attrs).collapsed
				);
				nodeStore.set(currentNode);

				return true;
			},

			stopEvent(event) {
				const target = event.target as globalThis.Node | null;

				return !!target && root.contains(target);
			},

			destroy() {
				void unmount(component);
			}
		};
	};
}

function findTextSelectionBefore(doc: ProseMirrorNode, position: number) {
	const selection = TextSelection.near(doc.resolve(position), -1);

	return selection.head <= position ? selection : null;
}

function findTextSelectionAfter(doc: ProseMirrorNode, after: number) {
	const selection = TextSelection.near(doc.resolve(Math.min(after, doc.content.size)), 1);

	return selection.head >= after ? selection : null;
}
