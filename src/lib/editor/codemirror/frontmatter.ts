import { StateField, type EditorState } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	WidgetType,
	type Command,
	type DecorationSet
} from '@codemirror/view';
import { readFrontmatter, type FrontmatterRange } from '$lib/editor/document/frontmatter-source';

function propertyText(value: unknown) {
	return String(value ?? '');
}

function summaryDetail(values: Record<string, unknown>) {
	const date = formatDate(propertyText(values.date));
	const tags = Array.isArray(values.tags) ? values.tags.map(String).filter(Boolean) : [];
	return [date, ...tags.map((tag) => `#${tag}`)].filter(Boolean).join('  ·  ');
}

function formatDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const time = Date.parse(`${value}T12:00:00Z`);
	return Number.isNaN(time)
		? value
		: new Intl.DateTimeFormat(undefined, {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
				timeZone: 'UTC'
			}).format(time);
}

function titlePosition(source: string, range: FrontmatterRange) {
	const yaml = source.slice(range.yamlFrom, range.yamlTo);
	const title = /^title:[^\r\n]*/m.exec(yaml);
	return title ? range.yamlFrom + title.index + title[0].length : range.yamlFrom;
}

export const openFrontmatter: Command = (view) => {
	const source = view.state.doc.toString();
	const range = readFrontmatter(source).range;
	if (!range) return false;
	view.dispatch({ selection: { anchor: titlePosition(source, range) }, scrollIntoView: true });
	view.focus();
	return true;
};

export const openFrontmatterFromBody: Command = (view) => {
	const range = readFrontmatter(view.state.doc.toString()).range;
	if (!range || !view.state.selection.main.empty) return false;
	const position = view.state.selection.main.head;
	if (position < range.to) return false;
	const line = view.state.doc.lineAt(position);
	if (view.state.doc.sliceString(range.to, line.from).trim()) return false;
	view.dispatch({ selection: { anchor: range.yamlTo }, scrollIntoView: true });
	view.focus();
	return true;
};

class FrontmatterSummary extends WidgetType {
	constructor(
		readonly title: string,
		readonly detail: string
	) {
		super();
	}
	eq(other: FrontmatterSummary) {
		return this.title === other.title && this.detail === other.detail;
	}
	toDOM(view: EditorView) {
		const root = document.createElement('div');
		root.className = 'cm-frontmatter-summary';
		root.contentEditable = 'false';
		const heading = document.createElement('h1');
		heading.className = 'cm-frontmatter-h1';
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'cm-frontmatter-open';
		button.setAttribute('aria-label', 'Edit frontmatter YAML');
		const title = document.createElement('span');
		title.className = 'cm-frontmatter-title';
		title.textContent = this.title;
		button.append(title);
		button.addEventListener('click', () => openFrontmatter(view));
		heading.append(button);
		const detail = document.createElement('span');
		detail.className = 'cm-frontmatter-detail';
		detail.textContent = this.detail;
		root.append(heading, detail);
		return root;
	}
}

class ErrorWidget extends WidgetType {
	constructor(readonly message: string) {
		super();
	}
	eq(other: ErrorWidget) {
		return this.message === other.message;
	}
	toDOM() {
		const element = document.createElement('div');
		element.className = 'cm-frontmatter-error';
		element.setAttribute('role', 'alert');
		element.textContent = `Frontmatter error: ${this.message}`;
		return element;
	}
}

function decorations(state: EditorState): DecorationSet {
	const parsed = readFrontmatter(state.doc.toString());
	if (parsed.error)
		return Decoration.set([
			Decoration.widget({ widget: new ErrorWidget(parsed.error), block: true }).range(0)
		]);
	const range = parsed.range;
	if (!range || state.selection.ranges.some((selection) => selection.from < range.to))
		return Decoration.none;
	return Decoration.set([
		Decoration.replace({
			block: true,
			widget: new FrontmatterSummary(
				propertyText(parsed.values?.title) || 'Untitled',
				summaryDetail(parsed.values ?? {})
			)
		}).range(0, range.to)
	]);
}

const frontmatterField = StateField.define<DecorationSet>({
	create: decorations,
	update(value, transaction) {
		return transaction.docChanged || transaction.selection !== transaction.startState.selection
			? decorations(transaction.state)
			: value;
	},
	provide: (field) => EditorView.decorations.from(field)
});

export const frontmatterExtension = [frontmatterField];

export const frontmatterTheme = EditorView.baseTheme({
	// CodeMirror measures block widget height without external margins. Keep spacing inside the widget.
	'.cm-frontmatter-summary': { display: 'grid', gap: 'var(--s-2)', paddingBottom: 'var(--s0)' },
	'.cm-frontmatter-h1': { margin: '0' },
	'.cm-frontmatter-open': {
		background: 'transparent',
		border: '0',
		color: 'var(--content)',
		cursor: 'pointer',
		display: 'grid',
		gap: 'var(--s-2)',
		padding: '0',
		textAlign: 'left',
		width: '100%'
	},
	'.cm-frontmatter-title': {
		fontSize: 'var(--s3)',
		fontWeight: '760',
		letterSpacing: '-0.035em',
		lineHeight: '1.08'
	},
	'.cm-frontmatter-detail': { color: 'var(--content-1)', fontSize: 'var(--s-1)' },
	'.cm-frontmatter-error': { color: 'var(--error)', paddingBottom: 'var(--s0)' }
});
