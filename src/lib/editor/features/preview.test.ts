import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { type EditorView, type WidgetType } from '@codemirror/view';
import { activeAtListMarker } from './list';
import { preview } from './media';

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

function imageWidget(state: EditorState) {
	let widget: WidgetType | undefined;
	state.field(preview).between(0, state.doc.length, (_from, _to, decoration) => {
		widget = decoration.spec.widget;
	});
	if (!widget) throw new Error('Expected an image widget');
	return widget;
}

function imageDecoration(state: EditorState) {
	let result: { from: number; to: number; block: boolean } | undefined;
	state.field(preview).between(0, state.doc.length, (from, to, decoration) => {
		if (decoration.spec.widget) result = { from, to, block: !!decoration.spec.block };
	});
	return result;
}

describe('Live Preview media', () => {
	it('keeps the same image DOM when a newline is inserted above it', () => {
		const state = EditorState.create({
			doc: 'Above\n![photo](https://example.com/photo.png)',
			extensions: [markdown({ base: markdownLanguage }), preview]
		});
		const before = imageWidget(state);
		const after = imageWidget(state.update({ changes: { from: 5, insert: '\n' } }).state);
		const image = { alt: '' };
		const dom = {
			querySelector: () => image,
			setAttribute: () => {}
		} as unknown as HTMLElement;
		expect(after.updateDOM(dom, {} as EditorView, before)).toBe(true);
		expect(image.alt).toBe('photo');
	});

	it('shows editable image Markdown with a preview while the caret is on its line', () => {
		const source = 'Above\n![photo](https://example.com/photo.png)\nBelow';
		const imageFrom = source.indexOf('![');
		const lineEnd = source.indexOf('\nBelow');
		for (const anchor of [imageFrom, imageFrom + 5, lineEnd]) {
			const state = EditorState.create({
				doc: source,
				selection: { anchor },
				extensions: [markdown({ base: markdownLanguage }), preview]
			});
			expect(imageDecoration(state)).toEqual({ from: lineEnd, to: lineEnd, block: true });
		}
		const away = EditorState.create({
			doc: source,
			selection: { anchor: source.length },
			extensions: [markdown({ base: markdownLanguage }), preview]
		});
		expect(imageDecoration(away)).toEqual({ from: imageFrom, to: lineEnd, block: false });
	});
});
