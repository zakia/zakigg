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

		root.className = 'component-embed-node';
		root.setAttribute('data-component-embed', String(currentNode.attrs.component ?? ''));
		root.contentEditable = 'false';

		const component = mount(ComponentEmbedNodeView, {
			target: root,
			props: {
				node: nodeStore,
				registry,
				updateProps
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
				const target = event.target as Element | null;

				if (!target) return false;

				// ProseMirror must see the drag lifecycle for draggable nodes
				// to move (rather than the browser half-performing a native
				// HTML drag), and events on the drag handle are how a drag or
				// node selection starts.
				if (event.type.startsWith('drag') || event.type === 'drop') return false;
				if (target.closest?.('[data-embed-drag-handle]')) return false;

				// Everything else inside the embed belongs to the component
				// (game clicks, form inputs), not the editor.
				return root.contains(target);
			},

			destroy() {
				void unmount(component);
			}
		};
	};
}
