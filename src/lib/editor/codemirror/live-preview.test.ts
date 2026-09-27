import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { activeAtListMarker } from './live-preview';

function parentMarker(source: string, position: number) {
	const state = EditorState.create({
		doc: source,
		selection: { anchor: position },
		extensions: [markdown({ base: markdownLanguage })]
	});
	const item = syntaxTree(state).topNode.getChild('BulletList')?.getChild('ListItem');
	const marker = item?.getChild('ListMark');
	if (!item || !marker) throw new Error('Expected a list item');
	return { state, marker, task: item.getChild('Task')?.getChild('TaskMarker') };
}

describe('Live Preview list markers', () => {
	it('keeps the parent bullet while editing any child', () => {
		const source = '- parent\n  - first\n  - second\n  - third';
		for (const child of ['first', 'second', 'third']) {
			const { state, marker } = parentMarker(source, source.indexOf(child) + child.length);
			expect(activeAtListMarker(state, marker)).toBe(false);
		}
	});

	it('reveals the source marker only while the cursor is in its prefix', () => {
		const source = '- parent\n  - child';
		for (const position of [0, 1, 2]) {
			const { state, marker } = parentMarker(source, position);
			expect(activeAtListMarker(state, marker)).toBe(true);
		}
		const { state, marker } = parentMarker(source, 3);
		expect(activeAtListMarker(state, marker)).toBe(false);
	});

	it('uses the checkbox prefix for task list items', () => {
		const source = '- [x] parent\n  - child';
		const atCheckbox = parentMarker(source, source.indexOf('[x]') + 2);
		expect(activeAtListMarker(atCheckbox.state, atCheckbox.marker, atCheckbox.task)).toBe(true);
		const atChild = parentMarker(source, source.indexOf('child') + 2);
		expect(activeAtListMarker(atChild.state, atChild.marker, atChild.task)).toBe(false);
	});
});
