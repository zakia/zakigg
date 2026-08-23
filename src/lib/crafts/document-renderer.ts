import type { JSONContent } from '@tiptap/core';
import { normalizeMediaBlockAttrs } from '$lib/editor/core/media-block/config';
import { normalizeCraftDocumentContent } from './document-content';

type Mark = NonNullable<JSONContent['marks']>[number];

const LANGUAGE_CLASS_RE = /^[a-z0-9_+#.-]+$/i;

function escapeHtml(value: unknown) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeAttribute(value: unknown) {
	return escapeHtml(value).replace(/'/g, '&#39;');
}

function renderChildren(node: JSONContent) {
	return (node.content ?? []).map(renderNode).join('');
}

function renderText(node: JSONContent) {
	const text = escapeHtml(node.text ?? '');

	return (node.marks ?? []).reduce((html, mark) => renderMark(mark, html), text);
}

function renderMark(mark: Mark, html: string) {
	switch (mark.type) {
		case 'bold':
			return `<strong>${html}</strong>`;
		case 'italic':
			return `<em>${html}</em>`;
		case 'strike':
			return `<s>${html}</s>`;
		case 'code':
			return `<code>${html}</code>`;
		case 'link': {
			const href = escapeAttribute(mark.attrs?.href ?? '');

			return href ? `<a href="${href}" rel="noopener noreferrer">${html}</a>` : html;
		}
		default:
			return html;
	}
}

function renderListItem(node: JSONContent) {
	const children = node.content ?? [];
	const onlyTextBlocks = children.every((child) => child.type === 'paragraph');
	const html = children
		.map((child) => {
			if (onlyTextBlocks && child.type === 'paragraph') return renderChildren(child);
			return renderNode(child);
		})
		.join('');

	return `<li>${html}</li>`;
}

function renderCodeBlock(node: JSONContent) {
	const language = String(node.attrs?.language ?? '').trim();
	const title = String(node.attrs?.title ?? '').trim();
	const className =
		LANGUAGE_CLASS_RE.test(language) && language !== 'plaintext'
			? ` class="language-${escapeAttribute(language)}"`
			: '';
	const dataTitle = title ? ` data-title="${escapeAttribute(title)}"` : '';

	return `<pre${dataTitle}><code${className}>${escapeHtml(node.content?.[0]?.text ?? '')}</code></pre>`;
}

function renderMediaBlock(node: JSONContent) {
	const attrs = normalizeMediaBlockAttrs(node.attrs);
	const caption = attrs.caption
		? `<figcaption class="media-block-caption">${escapeHtml(attrs.caption)}</figcaption>`
		: '';
	const figureAttrs = renderMediaBlockFigureAttributes(attrs);

	if (!attrs.src) {
		return `<figure ${figureAttrs}><div class="media-block-missing">Media unavailable</div></figure>`;
	}

	const title = attrs.title ? ` title="${escapeAttribute(attrs.title)}"` : '';
	const media =
		attrs.kind === 'video'
			? `<video class="media-block-media" src="${escapeAttribute(attrs.src)}"${title}${attrs.controls ? ' controls' : ''}${attrs.autoplay ? ' autoplay' : ''}${attrs.loop ? ' loop' : ''}${attrs.muted ? ' muted' : ''} playsinline></video>`
			: `<img class="media-block-media" src="${escapeAttribute(attrs.src)}" alt="${escapeAttribute(attrs.alt)}"${title} loading="lazy" decoding="async">`;

	return `<figure ${figureAttrs}>${media}${caption}</figure>`;
}

function renderMediaBlockFigureAttributes(attrs: ReturnType<typeof normalizeMediaBlockAttrs>) {
	const widthAttrs =
		attrs.width < 100
			? ` data-media-width="${escapeAttribute(attrs.width)}" style="width: ${escapeAttribute(attrs.width)}%; ${renderMediaBlockAlignmentStyle(attrs.align)}"`
			: '';

	return `class="media-block" data-media-block data-media-kind="${escapeAttribute(attrs.kind)}" data-media-align="${escapeAttribute(attrs.align)}"${widthAttrs}`;
}

function renderMediaBlockAlignmentStyle(
	align: ReturnType<typeof normalizeMediaBlockAttrs>['align']
) {
	if (align === 'left') return 'margin-inline-start: 0; margin-inline-end: auto;';
	if (align === 'right') return 'margin-inline-start: auto; margin-inline-end: 0;';

	return 'margin-inline: auto;';
}

function renderTable(node: JSONContent) {
	const rows = node.content ?? [];
	const headerRows = rows.filter(isHeaderRow);
	const bodyRows = rows.slice(headerRows.length);
	const thead = headerRows.length ? `<thead>${headerRows.map(renderNode).join('')}</thead>` : '';
	const tbody = bodyRows.length ? `<tbody>${bodyRows.map(renderNode).join('')}</tbody>` : '';

	return `<table>${thead}${tbody}</table>`;
}

function isHeaderRow(node: JSONContent) {
	return (
		node.type === 'table_row' &&
		Boolean(node.content?.length) &&
		node.content?.every((cell) => cell.type === 'table_header')
	);
}

function renderTableCell(node: JSONContent, tag: 'td' | 'th') {
	const attrs = renderCellAttributes(node);

	return `<${tag}${attrs}>${renderChildren(node)}</${tag}>`;
}

function renderCellAttributes(node: JSONContent) {
	const attrs = [];
	const colspan = Number(node.attrs?.colspan ?? 1);
	const rowspan = Number(node.attrs?.rowspan ?? 1);

	if (colspan > 1) attrs.push(`colspan="${escapeAttribute(colspan)}"`);
	if (rowspan > 1) attrs.push(`rowspan="${escapeAttribute(rowspan)}"`);

	return attrs.length ? ` ${attrs.join(' ')}` : '';
}

export function renderNode(node: JSONContent): string {
	switch (node.type) {
		case 'doc':
			return renderChildren(node);
		case 'text':
			return renderText(node);
		case 'paragraph':
			return `<p>${renderChildren(node)}</p>`;
		case 'heading': {
			const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6);

			return `<h${level}>${renderChildren(node)}</h${level}>`;
		}
		case 'bulletList':
			return `<ul>${renderChildren(node)}</ul>`;
		case 'orderedList':
			return `<ol>${renderChildren(node)}</ol>`;
		case 'listItem':
			return renderListItem(node);
		case 'blockquote':
			return `<blockquote>${renderChildren(node)}</blockquote>`;
		case 'codeBlock':
			return renderCodeBlock(node);
		case 'mediaBlock':
			return renderMediaBlock(node);
		case 'metadataBlock':
			return '';
		case 'table':
			return renderTable(node);
		case 'table_row':
			return `<tr>${renderChildren(node)}</tr>`;
		case 'table_cell':
			return renderTableCell(node, 'td');
		case 'table_header':
			return renderTableCell(node, 'th');
		case 'hardBreak':
			return '<br>';
		case 'horizontalRule':
			return '<hr>';
		default:
			return renderChildren(node);
	}
}

export function renderCraftDocumentHtml(content: JSONContent) {
	return renderNode(normalizeCraftDocumentContent(content));
}
