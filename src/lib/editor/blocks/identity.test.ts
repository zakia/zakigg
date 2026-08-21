import { describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { StarterKit } from '@tiptap/starter-kit';
import { buildBlockIndex, normalizeBlockIdentities } from './identity';
import { BlockIdentity, createBlockIdentityPlugin } from './identity-extension';

function createSequentialId() {
	let index = 0;

	return () => `block_test_${++index}`;
}

describe('block identity', () => {
	it('assigns stable identities to document blocks and list items', () => {
		const source: JSONContent = {
			type: 'doc',
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }]
						}
					]
				}
			]
		};

		const normalized = normalizeBlockIdentities(source, createSequentialId());
		const normalizedAgain = normalizeBlockIdentities(normalized, createSequentialId());
		const index = buildBlockIndex(normalized);

		expect(normalizedAgain).toEqual(normalized);
		expect([...index.values()]).toEqual([
			{ id: 'block_test_1', type: 'paragraph', path: [0], parentId: null },
			{ id: 'block_test_2', type: 'bulletList', path: [1], parentId: null },
			{ id: 'block_test_3', type: 'listItem', path: [1, 0], parentId: 'block_test_2' }
		]);
		expect(normalized.content?.[1].content?.[0].content?.[0].attrs).toBeUndefined();
	});

	it('repairs duplicated identities while preserving the first owner', () => {
		const normalized = normalizeBlockIdentities(
			{
				type: 'doc',
				content: [
					{ type: 'paragraph', attrs: { blockId: 'block_existing' } },
					{ type: 'heading', attrs: { level: 2, blockId: 'block_existing' } }
				]
			},
			createSequentialId()
		);

		expect(normalized.content?.[0].attrs?.blockId).toBe('block_existing');
		expect(normalized.content?.[1].attrs?.blockId).toBe('block_test_1');
	});

	it('repairs new and duplicated blocks after an editor transaction', () => {
		const editor = new Editor({
			extensions: [StarterKit, BlockIdentity],
			content: {
				type: 'doc',
				content: [
					{ type: 'paragraph', attrs: { blockId: 'block_existing' } },
					{ type: 'paragraph', attrs: { blockId: 'block_existing' } }
				]
			}
		});

		try {
			const state = EditorState.create({
				schema: editor.schema,
				doc: editor.state.doc,
				plugins: [createBlockIdentityPlugin()]
			});
			const paragraph = state.schema.nodes.paragraph.create();
			const nextState = state.applyTransaction(
				state.tr.insert(state.doc.content.size, paragraph)
			).state;
			const ids =
				nextState.doc.toJSON().content?.map((node: JSONContent) => node.attrs?.blockId) ?? [];

			expect(ids).toHaveLength(3);
			expect(ids[0]).toBe('block_existing');
			expect(ids.every((id: unknown) => typeof id === 'string' && id.startsWith('block_'))).toBe(
				true
			);
			expect(new Set(ids).size).toBe(ids.length);
		} finally {
			editor.destroy();
		}
	});
});
