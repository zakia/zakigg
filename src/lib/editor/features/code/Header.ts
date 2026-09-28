import { redo, undo } from '@codemirror/commands';
import { WidgetType, type EditorView } from '@codemirror/view';
import { CODE_BLOCK_LANGUAGES, normalizeLanguage } from './config';
import { read, changeLanguage, type Block } from './source';

export class Header extends WidgetType {
	constructor(readonly block: Block) {
		super();
	}
	eq(other: Header) {
		return (
			this.block.from === other.block.from &&
			this.block.language === other.block.language &&
			this.block.meta === other.block.meta &&
			this.block.code === other.block.code
		);
	}
	toDOM(view: EditorView) {
		const header = document.createElement('div');
		header.className = 'cm-code-header';
		header.contentEditable = 'false';
		header.addEventListener('keydown', (event) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
			event.preventDefault();
			event.stopPropagation();
			if (event.shiftKey) redo(view);
			else undo(view);
		});
		const language = document.createElement('select');
		language.setAttribute('aria-label', 'Code block language');
		const selected = normalizeLanguage(this.block.language);
		if (this.block.language && selected === 'plaintext' && this.block.language !== 'plaintext') {
			const unknown = document.createElement('option');
			unknown.value = this.block.language;
			unknown.textContent = this.block.language;
			language.append(unknown);
		}
		for (const item of CODE_BLOCK_LANGUAGES) {
			const option = document.createElement('option');
			option.value = item.value;
			option.textContent = item.label;
			language.append(option);
		}
		language.value = this.block.language || 'plaintext';
		if (!language.value) language.value = selected;
		language.addEventListener('change', () => {
			const changes = changeLanguage(view.state, this.block.from, language.value);
			if (changes) view.dispatch({ changes, userEvent: 'input' });
		});
		const details = document.createElement('div');
		details.className = 'cm-code-details';
		if (this.block.meta) {
			const title = document.createElement('span');
			title.className = 'cm-code-meta';
			title.textContent = this.block.meta;
			details.append(title);
		}
		const copy = document.createElement('button');
		copy.type = 'button';
		copy.className = 'cm-code-copy';
		copy.textContent = 'Copy';
		copy.setAttribute('aria-label', 'Copy code block');
		copy.addEventListener('click', async () => {
			const current = read(view.state, this.block.from);
			if (!current) return;
			try {
				await navigator.clipboard.writeText(current.code);
				copy.textContent = 'Copied';
			} catch {
				copy.textContent = 'Copy failed';
			}
			window.setTimeout(() => {
				if (copy.isConnected) copy.textContent = 'Copy';
			}, 1300);
		});
		const controls = document.createElement('div');
		controls.className = 'cm-code-controls';
		controls.append(copy, language);
		header.append(details, controls);
		return header;
	}
	ignoreEvent() {
		return true;
	}
}
