import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { preview } from '.';

function hiddenMarkers(source: string, anchor: number) {
	const state = EditorState.create({
		doc: source,
		selection: { anchor },
		extensions: [markdown({ base: markdownLanguage }), preview]
	});
	const hidden: { from: number; to: number }[] = [];
	state.field(preview).between(0, state.doc.length, (from, to) => {
		if (from < to) hidden.push({ from, to });
	});
	return hidden;
}

describe('Live Preview headings', () => {
	it('reveals ATX hashes only when the caret is in the marker prefix', () => {
		const source = '## Dry food';
		for (const anchor of [0, 1, 2, 3]) expect(hiddenMarkers(source, anchor)).toEqual([]);
		for (const anchor of [4, 6, source.length])
			expect(hiddenMarkers(source, anchor)).toEqual([{ from: 0, to: 2 }]);
	});

	it('keeps a setext underline hidden while editing the heading text', () => {
		const source = 'Dry food\n--------';
		expect(hiddenMarkers(source, 3)).toEqual([{ from: 9, to: 17 }]);
		expect(hiddenMarkers(source, 12)).toEqual([]);
	});
});
