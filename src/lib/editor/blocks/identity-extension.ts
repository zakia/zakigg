import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
	BLOCK_ID_ATTRIBUTE,
	BLOCK_IDENTITY_NODE_TYPES,
	claimUniqueBlockId,
	createBlockId,
	isBlockIdentityNodeType,
	readBlockId
} from './identity';

const blockIdentityPluginKey = new PluginKey('blockIdentity');

export const BlockIdentity = Extension.create({
	name: 'blockIdentity',

	addGlobalAttributes() {
		return [
			{
				types: [...BLOCK_IDENTITY_NODE_TYPES],
				attributes: {
					[BLOCK_ID_ATTRIBUTE]: {
						default: null,
						parseHTML: (element: HTMLElement) => element.dataset.blockId || null,
						renderHTML: (attributes: Record<string, unknown>) => {
							const blockId = readBlockId(attributes[BLOCK_ID_ATTRIBUTE]);

							return blockId ? { 'data-block-id': blockId } : {};
						}
					}
				}
			}
		];
	},

	addProseMirrorPlugins() {
		return [createBlockIdentityPlugin()];
	}
});

export function createBlockIdentityPlugin() {
	return new Plugin({
		key: blockIdentityPluginKey,
		appendTransaction: (transactions, _oldState, newState) => {
			if (!transactions.some((transaction) => transaction.docChanged)) return null;

			const transaction = newState.tr;
			const seen = new Set<string>();

			newState.doc.descendants((node, position, parent) => {
				if (!isAddressableProseMirrorBlock(node, parent)) return true;

				const currentId = readBlockId(node.attrs[BLOCK_ID_ATTRIBUTE]);
				if (currentId && !seen.has(currentId)) {
					seen.add(currentId);
					return true;
				}

				const blockId = claimUniqueBlockId(seen, createBlockId);
				transaction.setNodeMarkup(position, undefined, {
					...node.attrs,
					[BLOCK_ID_ATTRIBUTE]: blockId
				});

				return true;
			});

			if (!transaction.docChanged) return null;

			transaction.setMeta('addToHistory', false);
			return transaction;
		}
	});
}

function isAddressableProseMirrorBlock(
	node: ProseMirrorNode,
	parent: ProseMirrorNode | null | undefined
) {
	return (
		isBlockIdentityNodeType(node.type.name) &&
		(parent?.type.name === 'doc' || node.type.name === 'listItem')
	);
}
