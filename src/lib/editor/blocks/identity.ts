import type { JSONContent } from '@tiptap/core';

export const BLOCK_ID_ATTRIBUTE = 'blockId';

export const BLOCK_IDENTITY_NODE_TYPES = [
	'paragraph',
	'heading',
	'blockquote',
	'codeBlock',
	'horizontalRule',
	'bulletList',
	'orderedList',
	'listItem',
	'mediaBlock',
	'componentEmbed',
	'table'
] as const;

const blockIdentityNodeTypes = new Set<string>(BLOCK_IDENTITY_NODE_TYPES);

export type BlockIndexEntry = {
	id: string;
	type: string;
	path: number[];
	parentId: string | null;
};

export type BlockIndex = Map<string, BlockIndexEntry>;

export function createBlockId() {
	const uuid = globalThis.crypto?.randomUUID?.();

	return `block_${uuid ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

/**
 * Adds durable identity to document-level blocks and list items. Containers
 * such as quotes and tables remain one addressable block; their internal
 * paragraphs/cells deliberately do not become independent editor blocks.
 */
export function normalizeBlockIdentities(
	content: JSONContent,
	createId: () => string = createBlockId
): JSONContent {
	const seen = new Set<string>();

	function visit(node: JSONContent, path: number[], parentBlockId: string | null): JSONContent {
		const addressable = isAddressableJSONBlock(node, path);
		let blockId = addressable ? readBlockId(node.attrs?.[BLOCK_ID_ATTRIBUTE]) : '';

		if (addressable && (!blockId || seen.has(blockId))) {
			blockId = claimUniqueBlockId(seen, createId);
		} else if (blockId) {
			seen.add(blockId);
		}

		const nextParentBlockId = addressable ? blockId : parentBlockId;
		const children = node.content?.map((child, index) =>
			visit(child, [...path, index], nextParentBlockId)
		);

		return {
			...node,
			...(addressable ? { attrs: { ...node.attrs, [BLOCK_ID_ATTRIBUTE]: blockId } } : {}),
			...(children ? { content: children } : {})
		};
	}

	return visit(content, [], null);
}

/** Builds an ephemeral lookup without persisting positions into page data. */
export function buildBlockIndex(content: JSONContent): BlockIndex {
	const index: BlockIndex = new Map();

	function visit(node: JSONContent, path: number[], parentBlockId: string | null) {
		const addressable = isAddressableJSONBlock(node, path);
		const blockId = addressable ? readBlockId(node.attrs?.[BLOCK_ID_ATTRIBUTE]) : '';

		if (blockId) {
			index.set(blockId, {
				id: blockId,
				type: node.type ?? 'unknown',
				path,
				parentId: parentBlockId
			});
		}

		const nextParentBlockId = blockId || parentBlockId;
		node.content?.forEach((child, childIndex) =>
			visit(child, [...path, childIndex], nextParentBlockId)
		);
	}

	visit(content, [], null);
	return index;
}

function isAddressableJSONBlock(node: JSONContent, path: number[]) {
	return (
		Boolean(node.type && isBlockIdentityNodeType(node.type)) &&
		(path.length === 1 || node.type === 'listItem')
	);
}

export function isBlockIdentityNodeType(type: string) {
	return blockIdentityNodeTypes.has(type);
}

export function readBlockId(value: unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

export function claimUniqueBlockId(seen: Set<string>, createId: () => string) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const candidate = readBlockId(createId());

		if (candidate && !seen.has(candidate)) {
			seen.add(candidate);
			return candidate;
		}
	}

	let suffix = seen.size + 1;
	let candidate = `block_${Date.now()}_${suffix}`;

	while (seen.has(candidate)) {
		suffix += 1;
		candidate = `block_${Date.now()}_${suffix}`;
	}

	seen.add(candidate);
	return candidate;
}
