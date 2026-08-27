import { Document } from '@tiptap/extension-document';
import { Placeholder } from '@tiptap/extension-placeholder';
import { StarterKit } from '@tiptap/starter-kit';
import { ComponentEmbed, type ComponentEmbedRegistry } from '$lib/editor/core/embeds';
import { CodeBlock } from './code-block';
import { MediaBlock, type MediaBlockAssetResolver } from './media-block';
import { EditorLink, MarkdownLinkInput } from './links/extension';
import { ListContinuity, ListMarkerInput } from './lists/extensions';
import { Table, TableCell, TableHeader, TableKit, TableRow } from './tables';

export function createEditorExtensions(
	componentEmbedRegistry?: ComponentEmbedRegistry,
	resolveMediaAssetSrc?: MediaBlockAssetResolver
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
		Placeholder.configure({
			placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Start writing...')
		})
	];
}
