import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { ComponentEmbedRegistry } from '$lib/editor/component-embeds';

export type BlockDescriptor = {
	label: string;
	icon: string;
};

export type HoveredBlock = {
	pos: number;
	index: number;
	node: ProseMirrorNode;
	dom: HTMLElement;
};

// Node types the gutter handle never appears on. The metadata block is the
// document's locked first child with its own UI.
const EXCLUDED_BLOCKS = new Set(['metadataBlock']);

// Textblock types that can safely be converted in place.
const TURN_INTO_SOURCES = new Set(['paragraph', 'heading', 'codeBlock']);

export function describeBlockNode(
	node: ProseMirrorNode,
	registry?: ComponentEmbedRegistry
): BlockDescriptor {
	switch (node.type.name) {
		case 'paragraph':
			return { label: 'Text', icon: 'mdi:format-text' };
		case 'heading': {
			const level = Number(node.attrs.level) || 1;

			return { label: `Heading ${level}`, icon: `mdi:format-header-${Math.min(level, 6)}` };
		}
		case 'bulletList':
			return { label: 'Bullet list', icon: 'mdi:format-list-bulleted' };
		case 'orderedList':
			return { label: 'Numbered list', icon: 'mdi:format-list-numbered' };
		case 'blockquote':
			return { label: 'Quote', icon: 'mdi:format-quote-close' };
		case 'codeBlock':
			return { label: 'Code', icon: 'mdi:code-tags' };
		case 'mediaBlock':
			return node.attrs.kind === 'video'
				? { label: 'Video', icon: 'mdi:video-outline' }
				: { label: 'Image', icon: 'mdi:image-outline' };
		case 'componentEmbed': {
			const entry = registry?.get(String(node.attrs.component ?? ''));

			return { label: entry?.label ?? 'Component', icon: entry?.icon ?? 'mdi:puzzle-outline' };
		}
		case 'table':
			return { label: 'Table', icon: 'mdi:table' };
		case 'horizontalRule':
			return { label: 'Divider', icon: 'mdi:minus' };
		default:
			return { label: node.type.name, icon: 'mdi:shape-outline' };
	}
}

export function canTurnBlockInto(node: ProseMirrorNode) {
	return TURN_INTO_SOURCES.has(node.type.name);
}

// Finds the top-level block whose rendered box contains the given viewport Y.
// Working from geometry (rather than posAtCoords) keeps the answer stable
// while the pointer sits in the left gutter next to a block.
export function findTopLevelBlockAtY(view: EditorView, clientY: number): HoveredBlock | null {
	const { doc } = view.state;
	let offset = 0;

	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);
		const pos = offset;

		offset += node.nodeSize;

		if (EXCLUDED_BLOCKS.has(node.type.name)) continue;

		const dom = view.nodeDOM(pos);
		if (!(dom instanceof HTMLElement)) continue;

		const rect = dom.getBoundingClientRect();

		if (clientY >= rect.top && clientY <= rect.bottom) {
			return { pos, index, node, dom };
		}
	}

	return null;
}
