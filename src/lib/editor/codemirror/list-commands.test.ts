import { describe, expect, it } from 'vitest';
import { indentLess, indentMore, insertNewlineAndIndent } from '@codemirror/commands';
import { insertNewlineContinueMarkup, markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { EditorState, type StateCommand } from '@codemirror/state';
import {
	exitEmptyListItem,
	indentListItem,
	insertListHardBreak,
	insertListSiblingAfterContinuation,
	moveLeftAcrossListIndent,
	moveRightAcrossListIndent,
	outdentListItem
} from './list-commands';

function editor(
	markdownText: string,
	selection: number | { anchor: number; head: number } = markdownText.length
) {
	let state = EditorState.create({
		doc: markdownText,
		extensions: [markdown({ base: markdownLanguage }), indentUnit.of('    ')]
	});
	state = state.update({
		selection: typeof selection === 'number' ? { anchor: selection } : selection
	}).state;
	const run = (command: StateCommand) =>
		command({
			state,
			dispatch(transaction) {
				state = transaction.state;
			}
		});
	return {
		get text() {
			return state.doc.toString();
		},
		get tree() {
			return syntaxTree(state).toString();
		},
		get cursor() {
			return state.selection.main.head;
		},
		setCursor(position: number) {
			state = state.update({ selection: { anchor: position } }).state;
		},
		left() {
			return run(moveLeftAcrossListIndent);
		},
		right() {
			return run(moveRightAcrossListIndent);
		},
		type(text: string) {
			state = state.update(state.replaceSelection(text)).state;
		},
		enter() {
			if (
				!run(exitEmptyListItem) &&
				!run(insertListSiblingAfterContinuation) &&
				!run(insertNewlineContinueMarkup)
			)
				run(insertNewlineAndIndent);
		},
		shiftEnter() {
			if (!run(insertListHardBreak)) run(insertNewlineAndIndent);
		},
		tab() {
			if (!run(indentListItem)) run(indentMore);
		},
		shiftTab() {
			if (!run(outdentListItem)) run(indentLess);
		}
	};
}

describe('list indentation navigation', () => {
	it('crosses structural spaces in one step in both directions', () => {
		const source = '- parent\n    - child';
		const start = source.indexOf('    - child');
		const e = editor(source, start + 4);
		expect(e.left()).toBe(true);
		expect(e.cursor).toBe(start);
		expect(e.right()).toBe(true);
		expect(e.cursor).toBe(start + 4);
		expect(e.text).toBe(source);
	});

	it('does the same on a continuation line', () => {
		const source = '- parent  \n      detail';
		const start = source.indexOf('      detail');
		const e = editor(source, start + 2);
		expect(e.right()).toBe(true);
		expect(e.cursor).toBe(start + 6);
		e.setCursor(start + 5);
		expect(e.left()).toBe(true);
		expect(e.cursor).toBe(start);
	});

	it('leaves ordinary indentation and list marker text to normal arrow navigation', () => {
		const plain = editor('    code', 4);
		expect(plain.left()).toBe(false);
		const list = editor('- parent\n    - child');
		expect(list.left()).toBe(false);
		expect(list.right()).toBe(false);
	});
});

describe('Markdown list keyboard contract', () => {
	it('Enter continues a bullet list at the same level', () => {
		const e = editor('- first');
		e.enter();
		expect(e.text).toBe('- first\n- ');
	});

	it('Enter increments ordered items and resets task checkboxes', () => {
		const ordered = editor('1. first');
		ordered.enter();
		expect(ordered.text).toBe('1. first\n2. ');
		const task = editor('- [x] done');
		task.enter();
		expect(task.text).toBe('- [x] done\n- [ ] ');
	});

	it('Enter on an empty nested item outdents, then exits the list', () => {
		const e = editor('- parent\n    - child');
		e.enter();
		expect(e.text).toBe('- parent\n    - child\n    - ');
		e.enter();
		expect(e.text).toBe('- parent\n    - child\n- ');
		e.enter();
		expect(e.text).toBe('- parent\n    - child\n');
	});

	it('Enter does not remove an empty parent that still has children', () => {
		const source = '- \n    - child';
		const e = editor(source, 2);
		e.enter();
		expect(e.text).toBe(source);
	});

	it('Enter exits an empty item with only blank continuation lines', () => {
		const e = editor('- parent\n- ');
		e.shiftEnter();
		e.enter();
		expect(e.text).toBe('- parent\n');
	});

	it('Shift-Enter makes a hard break within the item; Enter after text starts a sibling', () => {
		const e = editor('- first');
		e.shiftEnter();
		expect(e.text).toBe('- first  \n  ');
		e.type('continued');
		e.enter();
		expect(e.text).toBe('- first  \n  continued\n- ');
	});

	it('Shift-Enter, repeated Tab, text, Enter keeps the entire item nested', () => {
		const e = editor('- parent\n- child');
		e.shiftEnter();
		e.tab();
		e.tab();
		e.type('continued');
		e.enter();
		expect(e.text).toBe('- parent\n    - child  \n      continued\n    - ');
		expect(e.tree).toContain('BulletList(ListItem(ListMark,Paragraph,BulletList(');
	});

	it('Enter, Tab, type, Enter creates and continues a child item', () => {
		const e = editor('- parent');
		e.enter();
		e.tab();
		e.type('child');
		e.enter();
		expect(e.text).toBe('- parent\n    - child\n    - ');
	});

	it('Tab, Shift-Enter, type, Enter preserves the new depth', () => {
		const e = editor('- parent\n- child');
		e.tab();
		e.shiftEnter();
		e.type('details');
		e.enter();
		expect(e.text).toBe('- parent\n    - child  \n      details\n    - ');
	});

	it('Shift-Tab, Tab, Enter is reversible before continuing the list', () => {
		const e = editor('- parent\n    - child');
		e.shiftTab();
		e.tab();
		e.enter();
		expect(e.text).toBe('- parent\n    - child\n    - ');
	});

	it('Shift-Enter followed by Enter on the blank continuation starts a sibling', () => {
		const e = editor('- first');
		e.shiftEnter();
		e.enter();
		expect(e.text).toBe('- first\n- ');
	});

	it('Shift-Enter inside a task keeps the task; Enter creates a new unchecked task', () => {
		const e = editor('- [x] done');
		e.shiftEnter();
		e.type('details');
		e.enter();
		expect(e.text).toBe('- [x] done  \n  details\n- [ ] ');
	});

	it('Shift-Enter and Tab on an empty item still allow continued list editing', () => {
		const e = editor('- parent\n- ');
		e.shiftEnter();
		e.tab();
		e.type('child');
		e.enter();
		expect(e.text).toBe('- parent\n    - \n      child\n    - ');
	});

	it('Tab moves an item and its descendants; Shift-Tab reverses it', () => {
		const source = '- first\n- second\n    - child\n      continuation';
		const e = editor(source, source.indexOf('second') + 3);
		e.tab();
		expect(e.text).toBe('- first\n    - second\n        - child\n          continuation');
		e.shiftTab();
		expect(e.text).toBe(source);
	});

	it('Tab moves selected sibling items and their descendants as a group', () => {
		const source = '- first\n- second\n    - child\n- third';
		const e = editor(source, { anchor: source.indexOf('- second'), head: source.length });
		e.tab();
		expect(e.text).toBe('- first\n    - second\n        - child\n    - third');
		e.shiftTab();
		expect(e.text).toBe(source);
	});

	it('selected numbered siblings renumber as a nested group', () => {
		const source = '1. one\n2. two\n3. three\n4. four';
		const e = editor(source, { anchor: source.indexOf('2. two'), head: source.indexOf('4. four') });
		e.tab();
		expect(e.text).toBe('1. one\n    1. two\n    2. three\n2. four');
		e.shiftTab();
		expect(e.text).toBe(source);
	});

	it('a selection mixing an unselected child and its parent sibling stays intact', () => {
		const source = '- first\n    - child\n- second';
		const e = editor(source, { anchor: source.indexOf('    - child'), head: source.length });
		e.tab();
		expect(e.text).toBe(source);
	});

	it('Tab keeps a loose item paragraph with its item', () => {
		const source = '- first\n- second\n\n  second paragraph\n- third';
		const e = editor(source, source.indexOf('second') + 2);
		e.tab();
		expect(e.text).toBe('- first\n    - second\n    \n      second paragraph\n- third');
	});

	it('Tab on the first item cannot make it a code block', () => {
		const e = editor('- first');
		e.tab();
		e.tab();
		expect(e.text).toBe('- first');
	});

	it('Tab does not cross two separate list blocks', () => {
		const source = '- first\n\nparagraph\n\n- second';
		const e = editor(source);
		e.tab();
		expect(e.text).toBe(source);
	});

	it('Tab can nest an adjacent bullet under an ordered item', () => {
		const e = editor('1. first\n- second');
		e.tab();
		expect(e.text).toBe('1. first\n    - second');
		expect(e.tree).toContain('OrderedList(ListItem(ListMark,Paragraph,BulletList(');
	});

	it('a numbered list nested under a bullet starts at one', () => {
		const e = editor('- first\n5. second');
		e.tab();
		expect(e.text).toBe('- first\n    1. second');
	});

	it('Tab uses enough indentation for a three-digit ordered marker', () => {
		const e = editor('100. parent\n101. child');
		e.tab();
		expect(e.text).toBe('100. parent\n     1. child');
		expect(e.tree).toContain('OrderedList(ListItem(ListMark,Paragraph,OrderedList(');
	});

	it('Tab and Enter work when ordered list numbers cross from two to three digits', () => {
		const e = editor('99. parent\n100. child');
		e.tab();
		e.enter();
		expect(e.text).toBe('99. parent\n    1. child\n    2. ');
	});

	it('indent and outdent renumber ordered siblings at both depths', () => {
		const source = '1. first\n2. second\n3. third';
		const e = editor(source, source.indexOf('second') + 3);
		e.tab();
		expect(e.text).toBe('1. first\n    1. second\n2. third');
		e.shiftTab();
		expect(e.text).toBe(source);
	});

	it('Enter after a continued ordered item renumbers following siblings', () => {
		const source = '1. first\n2. second';
		const e = editor(source, source.indexOf('first') + 'first'.length);
		e.shiftEnter();
		e.type('details');
		e.enter();
		expect(e.text).toBe('1. first  \n   details\n2. \n3. second');
	});

	it('Tab on a continuation moves its owner; Shift-Tab moves it back', () => {
		const e = editor('1. first\n2. second');
		e.shiftEnter();
		e.tab();
		e.shiftTab();
		e.type('continued');
		e.enter();
		expect(e.text).toBe('1. first\n2. second  \n   continued\n3. ');
	});

	it('list commands leave ordinary paragraphs to CodeMirror', () => {
		const e = editor('ordinary text');
		e.shiftEnter();
		expect(e.text).toBe('ordinary text\n');
	});

	it('list commands do not treat markers inside code blocks as list items', () => {
		const e = editor('```md\n- example\n```', '```md\n- example'.length);
		e.shiftEnter();
		expect(e.text).toBe('```md\n- example\n\n```');
		const indented = editor('    - example');
		indented.tab();
		expect(indented.text).toBe('        - example');
	});
});
