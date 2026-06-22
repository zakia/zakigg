import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { CODE_BLOCK_CLASS_NAMES, type CodeBlockAttributes, normalizeLanguage } from './config';
import CodeBlock from './CodeBlock.svelte';

function syncCodeBlockRoot(root: HTMLElement, node: ProseMirrorNode) {
	const language = normalizeLanguage(node.attrs.language);
	const title = String(node.attrs.title ?? '');

	root.setAttribute('data-code-language', language);

	if (title) {
		root.setAttribute('data-title', title);
	} else {
		root.removeAttribute('data-title');
	}
}

export function createCodeBlockNodeView(editor: Editor) {
	return ({
		node,
		getPos
	}: {
		node: ProseMirrorNode;
		getPos: () => number | undefined;
	}): NodeView => {
		let currentNode = node;
		const root = document.createElement('figure');
		const code = document.createElement('code');
		const nodeStore = writable(currentNode);

		const updateAttributes = (attributes: CodeBlockAttributes) => {
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

		root.className = CODE_BLOCK_CLASS_NAMES.root;
		root.setAttribute('data-code-block', '');
		syncCodeBlockRoot(root, currentNode);
		code.className = CODE_BLOCK_CLASS_NAMES.content;

		const component = mount(CodeBlock, {
			target: root,
			props: {
				node: nodeStore,
				contentDOM: code,
				updateAttributes,
				titleEditable: true,
				languageEditable: true
			}
		});
		flushSync();

		const header = root.querySelector(`.${CODE_BLOCK_CLASS_NAMES.header}`);

		return {
			dom: root,
			contentDOM: code,

			update(updatedNode) {
				if (updatedNode.type.name !== currentNode.type.name) return false;

				currentNode = updatedNode;
				syncCodeBlockRoot(root, currentNode);
				nodeStore.set(currentNode);

				return true;
			},

			stopEvent(event) {
				const target = event.target as globalThis.Node | null;

				return !!target && !!header?.contains(target);
			},

			destroy() {
				void unmount(component);
			}
		};
	};
}
