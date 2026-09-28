import { tagColor } from '$lib/components/tag';
import type { EditorState } from '@codemirror/state';
import { feature, touches } from '../feature';
import { Decoration, EditorView, WidgetType, type KeyBinding } from '@codemirror/view';
import { readFrontmatter, type FrontmatterRange } from './source';

export const preview = feature({
	find(state) {
		const parsed = readFrontmatter(state.doc.toString());
		// The closing fence belongs to the widget; the body and separating newline do not.
		return [{ ...parsed, from: 0, to: parsed.range?.fenceTo ?? 0 }];
	},
	active: touches,
	render,
	edit: (state, source) => (source.error ? render(state, source) : [])
});

export const keys: KeyBinding[] = [
	{ key: 'Mod-;', run: open },
	{ key: 'ArrowUp', run: enterFromBody }
];

export const theme = EditorView.baseTheme({
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
	'.cm-frontmatter-tags': { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
	'.cm-frontmatter-error': { color: 'var(--error)', paddingBottom: 'var(--s0)' }
});

function propertyText(value: unknown) {
	return String(value ?? '');
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

export function open(view: EditorView) {
	const source = view.state.doc.toString();
	const range = readFrontmatter(source).range;
	if (!range) return false;
	view.dispatch({ selection: { anchor: titlePosition(source, range) }, scrollIntoView: true });
	view.focus();
	return true;
}

export function enterFromBody(view: EditorView) {
	const range = readFrontmatter(view.state.doc.toString()).range;
	if (!range || !view.state.selection.main.empty) return false;
	const position = view.state.selection.main.head;
	if (position < range.bodyFrom) return false;
	const line = view.state.doc.lineAt(position);
	if (line.number !== view.state.doc.lineAt(range.bodyFrom).number) return false;
	if (
		view.state.doc.lineAt(view.moveVertically(view.state.selection.main, false).head).number ===
		line.number
	)
		return false;
	// Enter on the separator line before the body. This keeps Up and Down
	// symmetric when the summary expands.
	view.dispatch({
		selection: { anchor: view.state.doc.lineAt(range.bodyFrom - 1).from },
		scrollIntoView: true
	});
	view.focus();
	return true;
}

class FrontmatterSummary extends WidgetType {
	constructor(
		readonly title: string,
		readonly detail: string,
		readonly tags: string[]
	) {
		super();
	}
	eq(other: FrontmatterSummary) {
		return (
			this.title === other.title &&
			this.detail === other.detail &&
			this.tags.join('\0') === other.tags.join('\0')
		);
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
		button.addEventListener('click', () => open(view));
		heading.append(button);
		const detail = document.createElement('span');
		detail.className = 'cm-frontmatter-detail';
		detail.textContent = this.detail;
		root.append(heading, detail);
		if (this.tags.length) {
			const tags = document.createElement('div');
			tags.className = 'cm-frontmatter-tags';
			for (const name of this.tags) {
				const tag = document.createElement('span');
				tag.className = 'tag-badge';
				tag.style.setProperty('--tag-color', tagColor(name));
				tag.textContent = name;
				tags.append(tag);
			}
			root.append(tags);
		}
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

type Frontmatter = ReturnType<typeof readFrontmatter> & { from: number; to: number };

function render(_state: EditorState, source: Frontmatter) {
	if (source.error)
		return [Decoration.widget({ widget: new ErrorWidget(source.error), block: true }).range(0)];
	return [
		Decoration.replace({
			block: true,
			widget: new FrontmatterSummary(
				propertyText(source.values?.title) || 'Untitled',
				formatDate(propertyText(source.values?.date)),
				Array.isArray(source.values?.tags) ? source.values.tags.map(String).filter(Boolean) : []
			)
		}).range(source.from, source.to)
	];
}
