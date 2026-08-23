import type { Editor } from '@tiptap/core';
import type { NodeType } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { normalizeLanguage } from './config';

type VSCodeClipboardData = {
	mode?: unknown;
};

function parseVSCodeClipboardData(value: string): VSCodeClipboardData | null {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export function createVSCodeCodeBlockPastePlugin(editor: Editor, type: NodeType) {
	return new Plugin({
		key: new PluginKey('codeBlockVSCodeHandler'),
		props: {
			handlePaste: (view, event) => {
				if (!event.clipboardData || editor.isActive(type.name)) return false;

				const text = event.clipboardData.getData('text/plain');
				const vscode = event.clipboardData.getData('vscode-editor-data');

				if (!text || !vscode) return false;

				const vscodeData = parseVSCodeClipboardData(vscode);
				if (!vscodeData) return false;

				const language = normalizeLanguage(vscodeData.mode);
				const textNode = view.state.schema.text(text.replace(/\r\n?/g, '\n'));
				const transaction = view.state.tr.replaceSelectionWith(
					type.create({ language, title: '' }, textNode)
				);

				if (transaction.selection.$from.parent.type !== type) {
					transaction.setSelection(
						TextSelection.near(transaction.doc.resolve(Math.max(0, transaction.selection.from - 2)))
					);
				}

				transaction.setMeta('paste', true);
				view.dispatch(transaction);

				return true;
			}
		}
	});
}
