import { mergeAttributes, Node } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';
import {
	inferMediaKindFromSource,
	normalizeMediaBlockAttrs,
	normalizeMediaAlign,
	normalizeMediaKind,
	normalizeMediaWidthPercent,
	type MediaBlockAlign,
	type MediaBlockAssetResolver,
	type MediaBlockAttrs
} from './config';
import { createMediaBlockNodeView } from './view';

type MediaBlockOptions = {
	resolveAssetSrc?: MediaBlockAssetResolver;
};

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		mediaBlock: {
			insertMediaBlock: (attrs: Partial<MediaBlockAttrs>) => ReturnType;
		};
	}
}

export const MediaBlock = Node.create<MediaBlockOptions>({
	name: 'mediaBlock',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,

	addOptions() {
		return {
			resolveAssetSrc: undefined
		};
	},

	addAttributes() {
		return {
			kind: {
				default: 'image'
			},
			src: {
				default: ''
			},
			assetId: {
				default: ''
			},
			alt: {
				default: ''
			},
			title: {
				default: ''
			},
			caption: {
				default: ''
			},
			width: {
				default: 100
			},
			align: {
				default: 'center'
			},
			controls: {
				default: true
			},
			autoplay: {
				default: false
			},
			loop: {
				default: false
			},
			muted: {
				default: false
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'figure[data-media-block]',
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) return false;

					const media = element.querySelector('video[src], img[src]');
					if (!media) return false;

					const kind = normalizeMediaKind(
						media.tagName.toLowerCase() === 'video' ? 'video' : 'image'
					);

					return normalizeMediaBlockAttrs({
						kind,
						src: media.getAttribute('src') ?? '',
						assetId: element.dataset.mediaAssetId ?? '',
						alt: media.getAttribute('alt') ?? '',
						title: media.getAttribute('title') ?? '',
						caption: element.querySelector('figcaption')?.textContent ?? '',
						width: getElementMediaWidth(element),
						align: getElementMediaAlign(element),
						controls: media.hasAttribute('controls'),
						autoplay: media.hasAttribute('autoplay'),
						loop: media.hasAttribute('loop'),
						muted: media.hasAttribute('muted')
					});
				}
			},
			{
				tag: 'img[src]',
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) return false;

					return normalizeMediaBlockAttrs({
						kind: 'image',
						src: element.getAttribute('src') ?? '',
						assetId: element.dataset.mediaAssetId ?? '',
						alt: element.getAttribute('alt') ?? '',
						title: element.getAttribute('title') ?? '',
						width: getElementMediaWidth(element),
						align: getElementMediaAlign(element)
					});
				}
			},
			{
				tag: 'video[src]',
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) return false;

					return normalizeMediaBlockAttrs({
						kind: 'video',
						src: element.getAttribute('src') ?? '',
						assetId: element.dataset.mediaAssetId ?? '',
						title: element.getAttribute('title') ?? '',
						width: getElementMediaWidth(element),
						align: getElementMediaAlign(element),
						controls: element.hasAttribute('controls'),
						autoplay: element.hasAttribute('autoplay'),
						loop: element.hasAttribute('loop'),
						muted: element.hasAttribute('muted')
					});
				}
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const attrs = normalizeMediaBlockAttrs(node.attrs);

		return renderMediaBlockHtml(attrs, HTMLAttributes);
	},

	renderMarkdown: (node) => {
		const attrs = normalizeMediaBlockAttrs(node.attrs);

		if (
			attrs.kind === 'image' &&
			!attrs.caption &&
			attrs.width === 100 &&
			attrs.align === 'center'
		) {
			const title = attrs.title ? ` "${escapeMarkdownTitle(attrs.title)}"` : '';

			return `![${escapeMarkdownLabel(attrs.alt)}](${attrs.src}${title})`;
		}

		return renderMediaBlockMarkdown(attrs);
	},

	addCommands() {
		return {
			insertMediaBlock:
				(attrs) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: normalizeMediaBlockAttrs({
							...attrs,
							kind: attrs.kind ?? inferMediaKindFromSource(String(attrs.src ?? ''))
						})
					})
		};
	},

	addNodeView() {
		return createMediaBlockNodeView(this.editor, this.options.resolveAssetSrc);
	}
});

function renderMediaBlockHtml(
	attrs: MediaBlockAttrs,
	HTMLAttributes: Record<string, unknown>
): DOMOutputSpec {
	const figureAttrs = mergeAttributes(HTMLAttributes, {
		class: 'media-block',
		'data-media-block': '',
		'data-media-kind': attrs.kind,
		'data-media-asset-id': attrs.assetId || null,
		'data-media-width': attrs.width < 100 ? String(attrs.width) : null,
		'data-media-align': attrs.align,
		style: getMediaBlockWidthStyle(attrs) || null
	});
	const media: DOMOutputSpec =
		attrs.kind === 'video'
			? [
					'video',
					{
						class: 'media-block-media',
						src: attrs.src,
						title: attrs.title || null,
						controls: attrs.controls ? '' : null,
						autoplay: attrs.autoplay ? '' : null,
						loop: attrs.loop ? '' : null,
						muted: attrs.muted ? '' : null,
						playsinline: ''
					}
				]
			: [
					'img',
					{
						class: 'media-block-media',
						src: attrs.src,
						alt: attrs.alt,
						title: attrs.title || null,
						loading: 'lazy',
						decoding: 'async'
					}
				];
	const children: DOMOutputSpec[] = attrs.caption
		? [media, ['figcaption', { class: 'media-block-caption' }, attrs.caption]]
		: [media];

	return ['figure', figureAttrs, ...children] as DOMOutputSpec;
}

function renderMediaBlockMarkdown(attrs: MediaBlockAttrs) {
	const media =
		attrs.kind === 'video'
			? `<video ${renderHtmlAttributes({
					src: attrs.src,
					title: attrs.title,
					controls: attrs.controls,
					autoplay: attrs.autoplay,
					loop: attrs.loop,
					muted: attrs.muted,
					playsinline: true
				})}></video>`
			: `<img ${renderHtmlAttributes({
					src: attrs.src,
					alt: attrs.alt,
					title: attrs.title,
					loading: 'lazy',
					decoding: 'async'
				})}>`;
	const caption = attrs.caption
		? `\n<figcaption class="media-block-caption">${escapeHtml(attrs.caption)}</figcaption>`
		: '';

	return `<figure ${renderHtmlAttributes({
		class: 'media-block',
		'data-media-block': true,
		'data-media-kind': attrs.kind,
		'data-media-width': attrs.width < 100 ? String(attrs.width) : '',
		'data-media-align': attrs.align,
		style: getMediaBlockWidthStyle(attrs)
	})}>\n${media}${caption}\n</figure>`;
}

function getElementMediaWidth(element: HTMLElement) {
	const styleWidth = element.style.width;

	return normalizeMediaWidthPercent(
		element.dataset.mediaWidth || (styleWidth.endsWith('%') ? styleWidth : '')
	);
}

function getElementMediaAlign(element: HTMLElement) {
	return normalizeMediaAlign(element.dataset.mediaAlign || inferMediaAlignFromStyle(element));
}

function inferMediaAlignFromStyle(element: HTMLElement): MediaBlockAlign {
	const start = element.style.marginInlineStart || element.style.marginLeft;
	const end = element.style.marginInlineEnd || element.style.marginRight;

	if (start === 'auto' && end !== 'auto') return 'right';
	if (start !== 'auto' && end === 'auto') return 'left';

	return 'center';
}

function getMediaBlockWidthStyle(attrs: MediaBlockAttrs) {
	if (attrs.width >= 100) return '';

	return `width: ${attrs.width}%; ${getMediaBlockAlignmentStyle(attrs.align)}`;
}

function getMediaBlockAlignmentStyle(align: MediaBlockAlign) {
	if (align === 'left') return 'margin-inline-start: 0; margin-inline-end: auto;';
	if (align === 'right') return 'margin-inline-start: auto; margin-inline-end: 0;';

	return 'margin-inline: auto;';
}

function renderHtmlAttributes(attrs: Record<string, string | boolean>) {
	return Object.entries(attrs)
		.flatMap(([name, value]) => {
			if (value === false || value === '') return [];
			if (value === true) return [name];

			return [`${name}="${escapeHtml(value)}"`];
		})
		.join(' ');
}

function escapeMarkdownLabel(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

function escapeMarkdownTitle(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
