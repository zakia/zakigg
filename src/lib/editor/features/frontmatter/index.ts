import { tagColor } from '#lib/components/tag.js';
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

export const theme = [];

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
	const line = view.state.doc.lineAt(position);
	const fenceLine = view.state.doc.lineAt(range.fenceTo);
	const bodyLine = view.state.doc.lineAt(range.bodyFrom);

	if (line.number <= fenceLine.number || line.number > bodyLine.number) return false;

	if (
		line.number === bodyLine.number &&
		view.state.doc.lineAt(view.moveVertically(view.state.selection.main, false).head).number ===
			line.number
	) {
		return false;
	}

	if (line.number > fenceLine.number && line.number < bodyLine.number) {
		view.dispatch({
			selection: { anchor: fenceLine.from },
			scrollIntoView: true
		});
		view.focus();
		return true;
	}

	if (line.number === bodyLine.number) {
		const targetLine =
			line.number > fenceLine.number + 1
				? view.state.doc.lineAt(range.bodyFrom - 1)
				: fenceLine;
		view.dispatch({
			selection: { anchor: targetLine.from },
			scrollIntoView: true
		});
		view.focus();
		return true;
	}

	return false;
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
		root.className = 'article-header';
		root.contentEditable = 'false';
		const heading = document.createElement('h1');
		heading.className = 'title';
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'frontmatter-open';
		button.setAttribute('aria-label', 'Edit frontmatter YAML');
		button.textContent = this.title;
		button.addEventListener('click', () => open(view));
		heading.append(button);
		const detail = document.createElement('p');
		detail.className = 'meta';
		detail.textContent = this.detail;
		root.append(heading, detail);
		if (this.tags.length) {
			const tags = document.createElement('div');
			tags.className = 'article-tags';
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
		element.className = 'frontmatter-error';
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
