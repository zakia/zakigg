export function legacyEditorContentToMarkdown(document) {
	if (!document || typeof document !== 'object') {
		throw new Error('Legacy editor content must be an object');
	}
	const nodes = document.type === 'doc' ? (document.content ?? []) : [document];
	const markdown = renderBlocks(nodes).trim();
	return markdown ? `${markdown}\n` : '';
}

function renderBlocks(nodes) {
	return nodes
		.map(renderBlock)
		.filter((block) => block.trim())
		.join('\n\n');
}

function renderBlock(node) {
	switch (node?.type) {
		case 'paragraph':
			return renderInlineChildren(node).trimEnd();
		case 'heading':
			return `${'#'.repeat(clampHeadingLevel(node.attrs?.level))} ${renderInlineChildren(node).trimEnd()}`;
		case 'blockquote':
			return prefixLines(renderBlocks(node.content ?? []), '> ');
		case 'bulletList':
			return renderList(node, false);
		case 'orderedList':
			return renderList(node, true);
		case 'listItem':
			return renderBlocks(node.content ?? []);
		case 'codeBlock':
			return renderCodeBlock(node);
		case 'mediaBlock':
			return renderMediaBlock(node);
		case 'componentEmbed':
			return renderComponent(node);
		case 'table':
			return renderTable(node);
		case 'horizontalRule':
			return '---';
		default:
			return renderInlineChildren(node) || renderBlocks(node?.content ?? []);
	}
}

function renderInlineChildren(node) {
	return (node?.content ?? []).map(renderInline).join('');
}

function renderInline(node) {
	if (node?.type === 'text') {
		const marks = node.marks ?? [];
		const hasCodeMark = marks.some((mark) => mark.type === 'code');
		return applyMarks(hasCodeMark ? (node.text ?? '') : escapeMarkdownText(node.text ?? ''), marks);
	}
	if (node?.type === 'hardBreak') return '  \n';
	if (node?.type === 'mediaBlock') return renderMediaBlock(node);
	return renderInlineChildren(node);
}

function applyMarks(text, marks) {
	return marks.reduce((value, mark) => {
		switch (mark.type) {
			case 'bold':
				return `**${value}**`;
			case 'italic':
				return `_${value}_`;
			case 'strike':
				return `~~${value}~~`;
			case 'code': {
				const fence = value.includes('`') ? '``' : '`';
				const pad = value.includes('`') ? ' ' : '';
				return `${fence}${pad}${value}${pad}${fence}`;
			}
			case 'link': {
				const href = String(mark.attrs?.href ?? '').trim();
				return href ? `[${value}](${href})` : value;
			}
			default:
				return value;
		}
	}, text);
}

function renderList(node, ordered) {
	const start = Number(node.attrs?.start ?? 1);
	return (node.content ?? [])
		.map((item, index) => {
			const marker = ordered ? `${start + index}. ` : '- ';
			const rendered = renderBlock(item);
			const [firstLine = '', ...rest] = rendered.split('\n');
			const padding = ' '.repeat(marker.length);
			return `${marker}${firstLine}${rest.length ? `\n${rest.map((line) => `${padding}${line}`).join('\n')}` : ''}`;
		})
		.join('\n');
}

function renderCodeBlock(node) {
	const language = String(node.attrs?.language ?? '').trim();
	const title = String(node.attrs?.title ?? '').trim();
	const meta = [language, title].filter(Boolean).join(' ');
	const code = getTextContent(node);
	const fence = code.includes('```') ? '````' : '```';
	return `${fence}${meta}\n${code}\n${fence}`;
}

function renderMediaBlock(node) {
	const attrs = normalizeMediaAttrs(node.attrs);
	const src = attrs.src || (attrs.assetId ? `local-asset://${attrs.assetId}` : '');
	if (!src) return '';

	if (attrs.kind === 'image' && !attrs.caption && attrs.width === 100 && attrs.align === 'center') {
		const title = attrs.title ? ` "${escapeMarkdownTitle(attrs.title)}"` : '';
		return `![${escapeMarkdownLabel(attrs.alt)}](${src}${title})`;
	}

	return renderJsxComponent(attrs.kind === 'video' ? 'Video' : 'Image', {
		...attrs,
		src,
		assetId: attrs.assetId || undefined
	});
}

function normalizeMediaAttrs(value) {
	const attrs = value && typeof value === 'object' ? value : {};
	const src = normalizeString(attrs.src);
	const kind =
		attrs.kind === 'video' || /\.(mp4|m4v|mov|webm)(?:[?#].*)?$/i.test(src) ? 'video' : 'image';
	const parsedWidth = Number.parseFloat(String(attrs.width ?? 100));
	return {
		kind,
		src,
		assetId: normalizeString(attrs.assetId),
		alt: normalizeString(attrs.alt),
		title: normalizeString(attrs.title),
		caption: normalizeString(attrs.caption),
		width: Number.isFinite(parsedWidth) ? Math.min(Math.max(parsedWidth, 24), 100) : 100,
		align: attrs.align === 'left' || attrs.align === 'right' ? attrs.align : 'center',
		controls: typeof attrs.controls === 'boolean' ? attrs.controls : kind === 'video',
		autoplay: attrs.autoplay === true,
		loop: attrs.loop === true,
		muted: attrs.muted === true
	};
}

function renderComponent(node) {
	const attrs = node.attrs ?? {};
	const name = String(attrs.markdownName ?? componentNameFromId(attrs.component)).trim();
	if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return '';
	const props =
		attrs.props && typeof attrs.props === 'object' && !Array.isArray(attrs.props)
			? attrs.props
			: {};
	if (name === 'Columns') return renderColumns(props);
	if (name === 'Callout') return renderCallout(props);
	const children = typeof attrs.childrenMarkdown === 'string' ? attrs.childrenMarkdown.trim() : '';
	return renderJsxComponent(name, props, children);
}

function renderCallout(props) {
	const allowedKinds = new Set(['note', 'tip', 'important', 'warning', 'caution']);
	const requestedKind = String(props.kind ?? 'note').toLowerCase();
	const kind = allowedKinds.has(requestedKind) ? requestedKind : 'note';
	const markdown = String(props.markdown ?? '').trim();
	return prefixLines(`[!${kind.toUpperCase()}]${markdown ? `\n${markdown}` : ''}`, '> ');
}

function renderColumns(props) {
	const columns = Array.isArray(props.columns) ? props.columns : [];
	const containerProps = { ...props };
	delete containerProps.columns;
	const openingAttributes = renderJsxAttributes(containerProps);
	const children = columns
		.map((column) => {
			const value =
				column && typeof column === 'object' && !Array.isArray(column)
					? column
					: { markdown: String(column ?? '') };
			const width = value.width === undefined ? '' : renderJsxAttribute('width', value.width);
			return `<Column${width}>\n${String(value.markdown ?? '').trim()}\n</Column>`;
		})
		.join('\n');
	return `<Columns${openingAttributes}>\n${children}\n</Columns>`;
}

function renderJsxComponent(name, props, children = '') {
	const attributes = renderJsxAttributes(props);
	return children ? `<${name}${attributes}>\n${children}\n</${name}>` : `<${name}${attributes} />`;
}

function renderJsxAttributes(props) {
	return Object.entries(props)
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => renderJsxAttribute(key, value))
		.join('');
}

function renderJsxAttribute(name, value) {
	if (value === true) return ` ${name}`;
	if (typeof value === 'string') return ` ${name}="${escapeJsxString(value)}"`;
	return ` ${name}={${JSON.stringify(value)}}`;
}

function renderTable(node) {
	const rows = node.content ?? [];
	if (!rows.length) return '';
	const cells = rows.map((row) =>
		(row.content ?? []).map((cell) =>
			renderInlineChildren(cell.content?.[0] ?? cell).replace(/\|/g, '\\|')
		)
	);
	const width = Math.max(...cells.map((row) => row.length));
	const normalized = cells.map((row) => [
		...row,
		...Array(Math.max(0, width - row.length)).fill('')
	]);
	const [head = [], ...body] = normalized;
	const renderRow = (row) => `| ${row.join(' | ')} |`;
	return [renderRow(head), renderRow(Array(width).fill('---')), ...body.map(renderRow)].join('\n');
}

function componentNameFromId(value) {
	const parts = String(value ?? '')
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
	const lastIsPascal = parts.at(-1)?.match(/^[A-Z][A-Za-z0-9]*$/)?.[0];
	if (String(value).startsWith('core.') && lastIsPascal) return lastIsPascal;
	return (
		parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('') || 'Component'
	);
}

function clampHeadingLevel(value) {
	const level = Number(value);
	return Number.isFinite(level) ? Math.min(Math.max(Math.round(level), 1), 6) : 2;
}

function getTextContent(node) {
	if (node.text) return node.text;
	return (node.content ?? []).map(getTextContent).join('');
}

function prefixLines(value, prefix) {
	return value
		.split('\n')
		.map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
		.join('\n');
}

function normalizeString(value) {
	return typeof value === 'string' ? value.trim() : '';
}

function escapeMarkdownText(value) {
	return value.replace(/([\\*_~[\]])/g, '\\$1');
}

function escapeMarkdownLabel(value) {
	return value.replace(/([\\[\]<>])/g, '\\$1');
}

function escapeMarkdownTitle(value) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeJsxString(value) {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
