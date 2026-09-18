import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { applyLinkDraft, targetFromSelection } from './link-model';

const schema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		paragraph: { content: 'inline*', group: 'block' },
		text: { group: 'inline' }
	},
	marks: {
		strong: {},
		link: { attrs: { href: {}, title: { default: null } } },
		wikiLink: { attrs: { target: {} } }
	}
});

function editorView(initialState: EditorState) {
	let state = initialState;
	return {
		get state() {
			return state;
		},
		dispatch(transaction: Transaction) {
			state = state.apply(transaction);
		}
	} as unknown as EditorView;
}

describe('link model', () => {
	it('expands a partial selection to the complete existing link', () => {
		const link = schema.marks.link.create({ href: 'https://example.com', title: 'Example' });
		const doc = schema.node('doc', undefined, [
			schema.node('paragraph', undefined, [
				schema.text('Before '),
				schema.text('Example', [link]),
				schema.text(' after')
			])
		]);
		const state = EditorState.create({
			doc,
			selection: TextSelection.create(doc, 9, 11)
		});

		const target = targetFromSelection(editorView(state));

		expect(target).toMatchObject({
			from: 8,
			to: 15,
			label: 'Example',
			destination: 'https://example.com',
			title: 'Example'
		});
	});

	it('preserves other inline marks when adding a link', () => {
		const strong = schema.marks.strong.create();
		const doc = schema.node('doc', undefined, [
			schema.node('paragraph', undefined, [schema.text('Bold text', [strong])])
		]);
		const view = editorView(
			EditorState.create({ doc, selection: TextSelection.create(doc, 1, 10) })
		);
		const target = targetFromSelection(view);
		expect(target).toBeDefined();

		const result = applyLinkDraft(target!, {
			destination: 'https://example.com',
			label: 'Bold text'
		});

		expect(result.ok).toBe(true);
		expect(view.state.doc.firstChild?.firstChild?.marks.map((mark) => mark.type.name)).toEqual([
			'strong',
			'link'
		]);
	});
});
