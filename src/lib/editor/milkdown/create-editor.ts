import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core';
import {
	configureLinkTooltip,
	linkTooltipConfig,
	linkTooltipPlugin
} from '@milkdown/kit/component/link-tooltip';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { history } from '@milkdown/kit/plugin/history';
import { indent, indentConfig } from '@milkdown/kit/plugin/indent';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { ComponentEmbedRegistry } from '../components/registry';
import { componentEmbedFeature, componentRegistryCtx } from './features/component/component-embed';
import { codeBlockFeature } from './features/code-block/code-block';
import { columnsFeature } from './features/columns/columns';
import { linkNavigationFeature } from './features/link/link-navigation';
import { selectionToolbarFeature } from './features/selection-toolbar/selection-toolbar';
import { configureSlashMenu, markdownSlashMenu } from './features/slash-menu/slash-menu';
import { youtubeEmbedFeature } from './features/youtube/youtube-embed';
import { paragraphMdxSchema } from './syntax/paragraph-mdx';
import { restoreWikiLinkSyntax, wikiLinkFeature } from './syntax/wiki-links';

export type MarkdownEditorOptions = {
	host: HTMLElement;
	markdown: string;
	embeds: ComponentEmbedRegistry;
	ariaLabel: string;
	autofocus?: boolean;
	onMarkdownChange?: (markdown: string) => void;
};

/**
 * The complete product editor recipe. Syntax, interaction plugins, and custom
 * node views are composed here so UI shells never assemble partial editors.
 */
export function createMarkdownEditor(options: MarkdownEditorOptions) {
	return Editor.make()
		.config((ctx) => {
			ctx.set(rootCtx, options.host);
			ctx.set(defaultValueCtx, options.markdown);
			ctx.set(componentRegistryCtx.key, options.embeds);
			ctx.update(indentConfig.key, (value) => ({ ...value, size: 4 }));
			ctx.update(editorViewOptionsCtx, (current) => ({
				...current,
				autofocus: options.autofocus ?? false,
				attributes: {
					...current.attributes,
					class: 'markdown-editor-content editor-prose',
					'aria-label': options.ariaLabel,
					'aria-multiline': 'true'
				}
			}));
		})
		.config(configureSlashMenu)
		.config(configureLinkTooltip)
		.config((ctx) => {
			ctx.update(linkTooltipConfig.key, (current) => ({
				...current,
				linkIcon: 'Copy',
				editButton: 'Edit',
				removeButton: 'Remove',
				confirmButton: 'Save',
				inputPlaceholder: 'Paste a link…'
			}));
		})
		.config((ctx) => {
			ctx
				.get(listenerCtx)
				.markdownUpdated((_ctx, markdown) =>
					options.onMarkdownChange?.(restoreWikiLinkSyntax(markdown))
				);
		})
		.use(wikiLinkFeature)
		.use(commonmark)
		.use(gfm)
		.use(paragraphMdxSchema)
		.use(listener)
		.use(history)
		.use(indent)
		.use(trailing)
		.use(clipboard)
		.use(linkTooltipPlugin)
		.use(linkNavigationFeature)
		.use(markdownSlashMenu)
		.use(selectionToolbarFeature)
		.use(codeBlockFeature)
		.use(componentEmbedFeature)
		.use(youtubeEmbedFeature)
		.use(columnsFeature);
}
