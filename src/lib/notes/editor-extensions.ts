import { Markdown } from '@tiptap/markdown';
import { Document } from '@tiptap/extension-document';
import { Placeholder } from '@tiptap/extension-placeholder';
import { StarterKit } from '@tiptap/starter-kit';
import { BlockHandle, type BlockHandleTarget } from '$lib/editor/block-handle';
import { ComponentEmbed, type ComponentEmbedRegistry } from '$lib/editor/component-embeds';
import { CodeBlock } from '../editor/code-block';
import { MediaBlock, type MediaBlockAssetResolver } from '../editor/media-block';
import { EditorLink, MarkdownLinkInput } from './links';
import { ListContinuity, ListMarkerInput } from './lists';
import { Table, TableCell, TableHeader, TableKit, TableRow } from './tables';

export type EditorExtensionOptions = {
	onBlockHandleTargetChange?: (target: BlockHandleTarget | null) => void;
	// Resolves the DOM element the block-drag-handle positions and drags. It is
	// owned by the Svelte layer and read once, when ProseMirror plugins init.
	getBlockHandleElement?: () => HTMLElement | null;
};

export function createEditorExtensions(
	componentEmbedRegistry?: ComponentEmbedRegistry,
	resolveMediaAssetSrc?: MediaBlockAssetResolver,
	options: EditorExtensionOptions = {}
) {
	return [
		// Metadata lives alongside the document as page state (see
		// MetadataPanel), not as a node, so the document schema is plain block+.
		Document,
		StarterKit.configure({
			document: false,
			codeBlock: false,
			link: false,
			heading: {
				levels: [1, 2, 3]
			}
		}),
		CodeBlock,
		MediaBlock.configure({
			resolveAssetSrc: resolveMediaAssetSrc
		}),
		ComponentEmbed.configure({
			registry: componentEmbedRegistry
		}),
		BlockHandle.configure({
			registry: componentEmbedRegistry,
			getElement: options.getBlockHandleElement,
			onTargetChange: options.onBlockHandleTargetChange
		}),
		Table,
		TableRow,
		TableCell,
		TableHeader,
		TableKit,
		EditorLink.configure({
			openOnClick: false,
			enableClickSelection: false,
			linkOnPaste: true,
			autolink: true,
			defaultProtocol: 'https',
			HTMLAttributes: {
				target: null,
				rel: 'noopener noreferrer'
			}
		}),
		MarkdownLinkInput,
		ListMarkerInput,
		ListContinuity,
		Markdown.configure({
			indentation: {
				style: 'space',
				size: 2
			}
		}),
		Placeholder.configure({
			placeholder: ({ node }) =>
				node.type.name === 'heading' && Number(node.attrs.level) === 1
					? 'Untitled'
					: 'Start writing...'
		})
	];
}
