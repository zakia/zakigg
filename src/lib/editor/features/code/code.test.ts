import { changeLanguage } from './source';
import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { preview, enterDown, enterUp } from './index';

function selectLanguage(source: string, language: string) {
	const state = EditorState.create({
		doc: source,
		extensions: [markdown({ base: markdownLanguage })]
	});
	const changes = changeLanguage(state, 0, language);
	expect(changes).not.toBeNull();
	return state.update({ changes: changes! }).state.doc.toString();
}

describe('code fence language selector', () => {
	it('keeps title metadata while changing the language', () => {
		expect(selectLanguage('```js guitar.ts\nconst x = 1;\n```', 'typescript')).toBe(
			'```typescript guitar.ts\nconst x = 1;\n```'
		);
	});

	it('keeps metadata when changing to plain text', () => {
		expect(selectLanguage('```js guitar.ts\ncode\n```', 'plaintext')).toBe(
			'```plaintext guitar.ts\ncode\n```'
		);
	});

	it('leaves a metadata-free plain text fence without a language token', () => {
		expect(selectLanguage('```js\ncode\n```', 'plaintext')).toBe('```\ncode\n```');
	});
});

describe('code fence preview', () => {
	it('shows fence source while the cursor is inside and restores the rendered header on exit', () => {
		const source = 'Before\n\n```js\nconst x = 1;\n```\n\nAfter';
		let state = EditorState.create({
			doc: source,
			extensions: [markdown({ base: markdownLanguage }), preview]
		});
		const decorations = () => {
			const classes: string[] = [];
			let widgetCount = 0;
			state.field(preview).between(0, state.doc.length, (_from, _to, value) => {
				if (value.spec.class) classes.push(value.spec.class);
				if (value.spec.widget) widgetCount++;
			});
			return { classes, widgetCount };
		};

		expect(decorations().widgetCount).toBe(2);
		state = state.update({ selection: { anchor: source.indexOf('const') + 2 } }).state;
		expect(decorations().classes).toContain('cm-code-source-line cm-code-source-first');
		expect(decorations().widgetCount).toBe(0);
		state = state.update({ selection: { anchor: source.indexOf('After') } }).state;
		expect(decorations().widgetCount).toBe(2);
	});
});

describe('code fence arrow navigation', () => {
	const source = 'Before\n```js\ncode\n```\nAfter';
	function entry(from: string, direction: 'up' | 'down', staysOnLine = false) {
		const position = source.indexOf(from);
		const state = EditorState.create({
			doc: source,
			selection: EditorSelection.cursor(position),
			extensions: [markdown({ base: markdownLanguage })]
		});
		let target = -1;
		const view = {
			state,
			moveVertically: () =>
				EditorSelection.cursor(
					staysOnLine
						? position
						: state.doc.line(state.doc.lineAt(position).number + (direction === 'down' ? 1 : -1))
								.from
				),
			dispatch: ({ selection }: { selection: { anchor: number } }) => {
				target = selection.anchor;
			}
		} as unknown as EditorView;
		return {
			handled: (direction === 'down' ? enterDown : enterUp)(view),
			target
		};
	}

	it('visits the opening and closing fences before code content', () => {
		expect(entry('Before', 'down')).toEqual({ handled: true, target: source.indexOf('```js') });
		expect(entry('After', 'up')).toEqual({ handled: true, target: source.lastIndexOf('```') });
	});

	it('leaves vertical movement within a wrapped line alone', () => {
		expect(entry('Before', 'down', true)).toEqual({ handled: false, target: -1 });
	});
});
