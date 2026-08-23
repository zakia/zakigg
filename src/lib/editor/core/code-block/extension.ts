import { mergeAttributes, Node, textblockTypeInputRule } from '@tiptap/core';
import {
	DEFAULT_LANGUAGE,
	DEFAULT_TAB_SIZE,
	normalizeCodeBlockAttrs,
	normalizeLanguage
} from './config';
import { createCodeBlockHighlightPlugin } from './highlighting';
import { createCodeBlockKeyboardShortcuts } from './keyboard';
import { createTextContent, escapeMarkdownInfo, parseCodeFenceInfo } from './markdown';
import { createVSCodeCodeBlockPastePlugin } from './paste';
import { createCodeBlockNodeView } from './view';

const BACKTICK_INPUT_REGEX = /^```([a-zA-Z0-9_+#.-]+)?\s+$/;
const TILDE_INPUT_REGEX = /^~~~([a-zA-Z0-9_+#.-]+)?\s+$/;

export const CodeBlock = Node.create({
	name: 'codeBlock',

	addOptions() {
		return {
			languageClassPrefix: 'language-',
			exitOnTripleEnter: true,
			exitOnArrowDown: true,
			enableTabIndentation: true,
			tabSize: DEFAULT_TAB_SIZE,
			HTMLAttributes: {}
		};
	},

	content: 'text*',
	marks: '',
	group: 'block',
	code: true,
	defining: true,

	addAttributes() {
		return {
			language: {
				default: DEFAULT_LANGUAGE,
				parseHTML: (element: HTMLElement) => {
					const code =
						element.tagName.toLowerCase() === 'code' ? element : element.querySelector('code');
					const languageClass = [...(code?.classList ?? [])].find((className) =>
						className.startsWith('language-')
					);

					return normalizeLanguage(languageClass?.replace('language-', ''));
				},
				rendered: false
			},
			title: {
				default: '',
				parseHTML: (element: HTMLElement) =>
					element.getAttribute('data-title') ??
					element.closest('figure')?.getAttribute('data-title') ??
					'',
				rendered: false
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'figure[data-code-block] pre',
				preserveWhitespace: 'full'
			},
			{
				tag: 'pre',
				preserveWhitespace: 'full'
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const language = normalizeLanguage(node.attrs.language);
		const title = node.attrs.title ?? '';

		return [
			'pre',
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				'data-title': title || null
			}),
			[
				'code',
				{
					class:
						language === DEFAULT_LANGUAGE ? null : `${this.options.languageClassPrefix}${language}`
				},
				0
			]
		];
	},

	markdownTokenName: 'code',

	parseMarkdown: (token, helpers) => {
		if (
			token.raw?.startsWith('```') === false &&
			token.raw?.startsWith('~~~') === false &&
			token.codeBlockStyle !== 'indented'
		) {
			return [];
		}

		const attrs = parseCodeFenceInfo(token.lang);

		return helpers.createNode('codeBlock', attrs, createTextContent(token.text ?? '', helpers));
	},

	renderMarkdown: (node, h) => {
		const language = normalizeLanguage(node.attrs?.language);
		const title = String(node.attrs?.title ?? '').trim();
		const info = [
			language === DEFAULT_LANGUAGE ? '' : language,
			title ? `title="${escapeMarkdownInfo(title)}"` : ''
		]
			.filter(Boolean)
			.join(' ');
		const openingFence = `\`\`\`${info}`;

		if (!node.content) {
			return `${openingFence}\n\n\`\`\``;
		}

		return [openingFence, h.renderChildren(node.content), '```'].join('\n');
	},

	addCommands() {
		return {
			setCodeBlock:
				(attributes) =>
				({ commands }) =>
					commands.setNode(this.name, normalizeCodeBlockAttrs(attributes)),

			toggleCodeBlock:
				(attributes) =>
				({ commands }) =>
					commands.toggleNode(this.name, 'paragraph', normalizeCodeBlockAttrs(attributes))
		};
	},

	addKeyboardShortcuts() {
		return createCodeBlockKeyboardShortcuts({
			editor: this.editor,
			name: this.name,
			type: this.type,
			options: this.options
		});
	},

	addInputRules() {
		return [
			textblockTypeInputRule({
				find: BACKTICK_INPUT_REGEX,
				type: this.type,
				getAttributes: (match) => ({
					language: normalizeLanguage(match[1]),
					title: ''
				})
			}),
			textblockTypeInputRule({
				find: TILDE_INPUT_REGEX,
				type: this.type,
				getAttributes: (match) => ({
					language: normalizeLanguage(match[1]),
					title: ''
				})
			})
		];
	},

	addProseMirrorPlugins() {
		return [
			createCodeBlockHighlightPlugin(),
			createVSCodeCodeBlockPastePlugin(this.editor, this.type)
		];
	},

	addNodeView() {
		return createCodeBlockNodeView(this.editor);
	}
});
