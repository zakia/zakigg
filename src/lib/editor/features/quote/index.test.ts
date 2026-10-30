import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { preview } from './index';

function quotePrefixes(state: EditorState) {
	const prefixes: { from: number; to: number; hidden: boolean }[] = [];
	state.field(preview).between(0, state.doc.length, (from, to, decoration) => {
		const className = decoration.spec.class ?? '';
		if (className.includes('quote-marker'))
			prefixes.push({ from, to, hidden: className.includes('is-hidden') });
	});
	return prefixes;
}

describe('Live Preview quote prefixes', () => {
	it('keeps the same prefix span when entering and selecting quoted list text', () => {
		const doc = '> - first item\n> - second item\n\nAway';
		let state = EditorState.create({
			doc,
			selection: { anchor: doc.length },
			extensions: [markdown({ base: markdownLanguage }), preview]
		});
		const spans = [
			{ from: 0, to: 2 },
			{ from: doc.indexOf('> - second'), to: doc.indexOf('> - second') + 2 }
		];
		expect(quotePrefixes(state)).toEqual(spans.map((span) => ({ ...span, hidden: true })));
		state = state.update({
			selection: { anchor: doc.indexOf('first') + 2, head: doc.indexOf('second') + 3 }
		}).state;
		expect(quotePrefixes(state)).toEqual(spans.map((span) => ({ ...span, hidden: false })));
		expect(state.doc.toString()).toBe(doc);
	});

	it('groups adjacent nested quote syntax without consuming enclosing list markers', () => {
		const doc = '> > nested\n> - > quoted list\n\nAway';
		const state = EditorState.create({
			doc,
			selection: { anchor: doc.length },
			extensions: [markdown({ base: markdownLanguage }), preview]
		});
		expect(quotePrefixes(state)).toEqual([
			{ from: 0, to: 4, hidden: true },
			{ from: 11, to: 13, hidden: true },
			{ from: 15, to: 17, hidden: true }
		]);
	});

	it('reveals source at both quote line boundaries', () => {
		const doc = '> quote\n\nAway';
		const state = EditorState.create({
			doc,
			selection: { anchor: doc.length },
			extensions: [markdown({ base: markdownLanguage }), preview]
		});
		for (const anchor of [0, doc.indexOf('\n')]) {
			const entered = state.update({ selection: { anchor } }).state;
			expect(quotePrefixes(entered)).toEqual([{ from: 0, to: 2, hidden: false }]);
		}
	});
});
