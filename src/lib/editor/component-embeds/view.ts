import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import ComponentEmbedNodeView from './ComponentEmbedNodeView.svelte';
import type { ComponentEmbedRegistry } from './registry';

export function createComponentEmbedNodeView(editor: Editor, registry: ComponentEmbedRegistry) {
	return ({
		node,
		getPos
	}: {
		node: ProseMirrorNode;
		getPos: () => number | undefined;
	}): NodeView => {
		let currentNode = node;
		const root = document.createElement('div');
		const nodeStore = writable(currentNode);

		const updateAttributes = (attributes: Record<string, unknown>) => {
			const position = getPos();

			if (typeof position !== 'number') {
				return { ok: false as const, message: 'Unable to update component position.' };
			}

			editor.commands.command(({ tr }) => {
				tr.setNodeMarkup(position, undefined, {
					...currentNode.attrs,
					...attributes
				});

				return true;
			});

			return { ok: true as const };
		};

		const updateProps = (props: Record<string, unknown>) => {
			const componentId = String(currentNode.attrs.component ?? '');
			const result = registry.parseProps(componentId, props);

			if (!result.ok) return result;

			return updateAttributes({
				props: result.props
			});
		};

		const setEditing = (editing: boolean, props?: Record<string, unknown>) =>
			updateAttributes({
				...(props ? { props } : {}),
				editing
			});

		root.className = 'component-embed-node';
		root.setAttribute('data-component-embed', String(currentNode.attrs.component ?? ''));
		root.contentEditable = 'false';

		const component = mount(ComponentEmbedNodeView, {
			target: root,
			props: {
				node: nodeStore,
				registry,
				updateProps,
				setEditing
			}
		});
		flushSync();

		return {
			dom: root,

			update(updatedNode) {
				if (updatedNode.type.name !== currentNode.type.name) return false;

				currentNode = updatedNode;
				root.setAttribute('data-component-embed', String(currentNode.attrs.component ?? ''));
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
