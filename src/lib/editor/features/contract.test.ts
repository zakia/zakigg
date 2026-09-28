import { describe, expect, it } from 'vitest';
import { Compartment, EditorSelection, EditorState, type StateField } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { yamlFrontmatter } from '@codemirror/lang-yaml';
import type { DecorationSet } from '@codemirror/view';
import { preview as frontmatter } from './frontmatter';
import { frontmatterRange } from './frontmatter/source';
import { preview as link } from './link';
import { preview as table } from './table';
import { preview as code } from './code';
import { preview as heading } from './heading';
import { preview as format } from './format';
import { preview } from './index';

function stateFor(
	doc: string,
	anchor: number,
	extensions: StateField<DecorationSet>[] = [frontmatter]
) {
	return EditorState.create({
		doc,
		selection: { anchor },
		extensions: [yamlFrontmatter({ content: markdown({ base: markdownLanguage }) }), ...extensions]
	});
}
function widgets(state: EditorState, field: StateField<DecorationSet>) {
	const result: { from: number; to: number }[] = [];
	state.field(field).between(0, state.doc.length, (from, to, decoration) => {
		if (decoration.spec.widget) result.push({ from, to });
	});
	return result;
}

describe('feature source contract', () => {
	it('leaves the body and its separator outside the frontmatter summary', () => {
		for (const body of ['\n', '\n\n', '\nBody', '\n\nBody']) {
			const doc = `---\ntitle: Test\n---${body}`;
			const range = frontmatterRange(doc)!;
			let state = stateFor(doc, range.bodyFrom);
			expect(widgets(state, frontmatter)).toEqual([{ from: 0, to: range.fenceTo }]);
			state = state.update({ changes: { from: range.bodyFrom, insert: '\n' } }).state;
			expect(widgets(state, frontmatter)).toEqual([{ from: 0, to: range.fenceTo }]);
			expect(state.doc.toString()).toBe(
				doc.slice(0, range.bodyFrom) + '\n' + doc.slice(range.bodyFrom)
			);
		}
	});

	it('reveals raw YAML at either fence, inside the title, and for a selection spanning into the body', () => {
		const doc = '---\ntitle: Test\n---\n\nBody';
		const range = frontmatterRange(doc)!;
		for (const anchor of [0, doc.indexOf('Test'), range.fenceTo]) {
			const state = stateFor(doc, anchor);
			expect(widgets(state, frontmatter)).toEqual([]);
			expect(state.doc.toString()).toBe(doc);
		}
		const state = stateFor(doc, range.bodyFrom).update({
			selection: EditorSelection.range(doc.indexOf('title'), doc.length)
		}).state;
		expect(widgets(state, frontmatter)).toEqual([]);
	});

	it('never hides invalid YAML and keeps validation feedback visible', () => {
		const doc = '---\ntitle: [\n---\n\nBody';
		for (const anchor of [doc.indexOf('title'), doc.length]) {
			const state = stateFor(doc, anchor);
			expect(widgets(state, frontmatter)).toEqual([{ from: 0, to: 0 }]);
			expect(state.doc.toString()).toBe(doc);
		}
	});

	it('reveals a wiki link or table on entry and restores it on exit without changing text', () => {
		for (const [body, field] of [
			['[[some-page|A label]]', link],
			['| A | B |\n| - | - |\n| 1 | 2 |', table]
		] as const) {
			const doc = `Before\n\n${body}\n\nAfter`;
			let state = stateFor(doc, 0, [field]);
			expect(widgets(state, field)).toEqual([{ from: 8, to: 8 + body.length }]);
			state = state.update({ selection: { anchor: 10 } }).state;
			expect(widgets(state, field)).toEqual([]);
			state = state.update({ selection: { anchor: doc.length } }).state;
			expect(widgets(state, field)).toEqual([{ from: 8, to: 8 + body.length }]);
			expect(state.doc.toString()).toBe(doc);
		}
	});

	it('does not interpret Markdown-looking text inside code as nested features', () => {
		const doc = 'Before\n\n```md\n# Heading\n**bold**\n[[link]]\n```\n\nAfter';
		const state = stateFor(doc, 0, [code, heading, format, link]);
		expect(widgets(state, code)).toHaveLength(2);
		for (const field of [heading, format, link]) expect(state.field(field).size).toBe(0);
	});

	it('keeps document and selection unchanged when preview is removed and restored', () => {
		const doc = '---\ntitle: Test\n---\n\n# Heading\n\n[link](https://example.com)';
		const mode = new Compartment();
		let state = EditorState.create({
			doc,
			selection: { anchor: doc.length },
			extensions: [
				yamlFrontmatter({ content: markdown({ base: markdownLanguage }) }),
				mode.of(preview)
			]
		});
		const selection = state.selection;
		for (const extension of [[], preview]) {
			state = state.update({ effects: mode.reconfigure(extension) }).state;
			expect(state.doc.toString()).toBe(doc);
			expect(state.selection.eq(selection)).toBe(true);
		}
	});
});
