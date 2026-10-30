import { Facet } from '@codemirror/state';
import type { ComponentEmbedAttrs } from './components/registry';

/** Host integration. Markdown features never choose routes, storage, or an embed catalog. */
export type EditorOptions = {
	resolveWikiLink?: (target: string) => string;
	resolveAttachment?: (source: string) => Promise<string>;
	insertFile?: (file: File) => Promise<{ markdown: string }>;
	renderEmbed?: (target: HTMLElement, attrs: ComponentEmbedAttrs) => () => void;
	tagColor?: (tag: string) => string;
};
export const editorOptions = Facet.define<EditorOptions, EditorOptions>({
	combine: (values) => Object.assign({}, ...values)
});
