import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extension-placeholder';
import { StarterKit } from '@tiptap/starter-kit';
import { ComponentEmbed, type ComponentEmbedRegistry } from '$lib/editor/component-embeds';
import { CodeBlock } from '../editor/code-block';
import { MediaBlock, type MediaBlockAssetResolver } from '../editor/media-block';
import { EditorLink, MarkdownLinkInput } from './links';
import { ListMarkerInput } from './lists';
import { Table, TableCell, TableHeader, TableKit, TableRow } from './tables';

export function createEditorExtensions(
	componentEmbedRegistry?: ComponentEmbedRegistry,
	resolveMediaAssetSrc?: MediaBlockAssetResolver
) {
	return [
		StarterKit.configure({
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
		Markdown.configure({
			indentation: {
				style: 'space',
				size: 2
			}
		}),
		Placeholder.configure({
			placeholder: 'Start writing...'
		})
	];
}
