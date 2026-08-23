import type { Editor, Range } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { LinkPopoverState } from './popover';
import { isValidLinkHref, normalizeLinkHref } from './extension';

type ApplyLinkEditResult =
	| {
			ok: true;
			range: Range;
	  }
	| {
			ok: false;
			error: string;
	  };

export function applyLinkEditToEditor(
	editor: Editor,
	popover: LinkPopoverState
): ApplyLinkEditResult {
	const href = normalizeLinkHref(popover.href);
	const label = popover.label.replace(/\s+/g, ' ').trim() || href;

	if (!isValidLinkHref(href)) {
		return {
			ok: false,
			error: 'Enter a valid link'
		};
	}

	editor
		.chain()
		.focus()
		.insertContentAt(
			{ from: popover.from, to: popover.to },
			{
				type: 'text',
				text: label,
				marks: [
					{
						type: 'link',
						attrs: { href }
					}
				]
			}
		)
		.setTextSelection({ from: popover.from, to: popover.from + label.length })
		.run();

	return {
		ok: true,
		range: { from: popover.from, to: popover.from + label.length }
	};
}

export function removeLinkFromEditor(editor: Editor, popover: LinkPopoverState) {
	const label = editor.state.doc.textBetween(popover.from, popover.to, '\n');

	let transaction = editor.state.tr.replaceWith(
		popover.from,
		popover.to,
		editor.state.schema.text(label)
	);

	transaction = transaction.setSelection(
		TextSelection.create(transaction.doc, popover.from, popover.from + label.length)
	);

	editor.view.dispatch(transaction);
	editor.commands.focus();
}
