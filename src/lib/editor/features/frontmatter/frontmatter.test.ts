import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { enterFromBody } from './index';

function navigateFromBody(source: string, staysOnLine = false) {
	const position = source.indexOf('Body');
	const state = EditorState.create({
		doc: source,
		selection: EditorSelection.cursor(position)
	});
	let target = -1;
	const view = {
		state,
		moveVertically: () =>
			EditorSelection.cursor(staysOnLine ? position : state.doc.lineAt(position).from - 1),
		dispatch: ({ selection }: { selection: { anchor: number } }) => {
			target = selection.anchor;
		},
		focus: () => {}
	} as unknown as EditorView;
	return { handled: enterFromBody(view), target };
}

describe('frontmatter arrow navigation', () => {
	it('lands on the closing divider when it directly precedes the body', () => {
		const source = '---\ntitle: Test\n---\nBody';
		expect(navigateFromBody(source)).toEqual({ handled: true, target: source.lastIndexOf('---') });
	});

	it('visits a blank line after the divider before moving to the divider', () => {
		const source = '---\ntitle: Test\n---\n\nBody';
		expect(navigateFromBody(source)).toEqual({ handled: true, target: source.indexOf('\n\n') + 1 });
	});

	it('keeps Up within a wrapped body line', () => {
		expect(navigateFromBody('---\ntitle: Test\n---\nBody', true)).toEqual({
			handled: false,
			target: -1
		});
	});
});
