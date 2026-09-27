import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { changeCodeBlockLanguage, codeBlockExtension } from './code-blocks';

function selectLanguage(source: string, language: string) {
	const state = EditorState.create({
		doc: source,
		extensions: [markdown({ base: markdownLanguage })]
	});
	const changes = changeCodeBlockLanguage(state, 0, language);
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
			extensions: [markdown({ base: markdownLanguage }), ...codeBlockExtension]
		});
		const decorations = () => {
			const classes: string[] = [];
			let widgetCount = 0;
			state.field(codeBlockExtension[0]).between(0, state.doc.length, (_from, _to, value) => {
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
