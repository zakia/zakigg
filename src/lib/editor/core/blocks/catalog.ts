import type { Editor, Range } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
	insertRegisteredComponentEmbed,
	type ComponentEmbedRegistry
} from '$lib/editor/core/embeds';
import type { MediaBlockKind } from '$lib/editor/core/media-block';

export type BlockDescriptor = {
	label: string;
	icon: string;
	editLabel?: string;
};

export type BlockPaletteItem = BlockDescriptor & {
	id: string;
	description: string;
};

export type BlockTurnTarget =
	| 'paragraph'
	| 'heading-1'
	| 'heading-2'
	| 'heading-3'
	| 'bullet-list'
	| 'ordered-list'
	| 'quote'
	| 'code';

export type BlockInsertServices = {
	insertTable: () => void;
	requestMedia: (kind: MediaBlockKind) => void;
};

export type BlockInsertContext = {
	editor: Editor;
	range?: Range;
	services: BlockInsertServices;
};

type BlockDefinition = BlockPaletteItem & {
	insertable?: boolean;
	matches: (node: ProseMirrorNode) => boolean;
	insert?: (context: Omit<BlockInsertContext, 'range'>) => boolean | void;
	turn?: (editor: Editor) => boolean;
};

const CORE_BLOCKS: BlockDefinition[] = [
	{
		id: 'paragraph',
		label: 'Text',
		description: 'Plain paragraph',
		icon: 'mdi:format-text',
		matches: (node) => node.type.name === 'paragraph',
		insert: ({ editor }) => editor.chain().focus().setParagraph().run(),
		turn: (editor) => editor.chain().focus().setParagraph().run()
	},
	...([1, 2, 3] as const).map(
		(level): BlockDefinition => ({
			id: `heading-${level}`,
			label: `Heading ${level}`,
			description: `${level === 1 ? 'Large' : level === 2 ? 'Medium' : 'Small'} section heading`,
			icon: `mdi:format-header-${level}`,
			matches: (node) => node.type.name === 'heading' && Number(node.attrs.level) === level,
			insert: ({ editor }) => editor.chain().focus().setHeading({ level }).run(),
			turn: (editor) => editor.chain().focus().setHeading({ level }).run()
		})
	),
	{
		id: 'bullet-list',
		label: 'Bullet list',
		description: 'Create a bulleted list',
		icon: 'mdi:format-list-bulleted',
		matches: (node) => node.type.name === 'bulletList',
		insert: ({ editor }) => editor.chain().focus().toggleBulletList().run(),
		turn: (editor) => editor.chain().focus().setParagraph().toggleBulletList().run()
	},
	{
		id: 'ordered-list',
		label: 'Numbered list',
		description: 'Create a numbered list',
		icon: 'mdi:format-list-numbered',
		matches: (node) => node.type.name === 'orderedList',
		insert: ({ editor }) => editor.chain().focus().toggleOrderedList().run(),
		turn: (editor) => editor.chain().focus().setParagraph().toggleOrderedList().run()
	},
	{
		id: 'list-item',
		label: 'List item',
		description: 'Item in a list',
		icon: 'mdi:drag-vertical',
		insertable: false,
		matches: (node) => node.type.name === 'listItem'
	},
	{
		id: 'quote',
		label: 'Quote',
		description: 'Emphasize a quotation',
		icon: 'mdi:format-quote-close',
		matches: (node) => node.type.name === 'blockquote',
		insert: ({ editor }) => editor.chain().focus().toggleBlockquote().run(),
		turn: (editor) => editor.chain().focus().setParagraph().toggleBlockquote().run()
	},
	{
		id: 'code',
		label: 'Code block',
		description: 'Code with syntax highlighting',
		icon: 'mdi:code-tags',
		matches: (node) => node.type.name === 'codeBlock',
		insert: ({ editor }) => editor.chain().focus().toggleCodeBlock().run(),
		turn: (editor) => editor.chain().focus().toggleCodeBlock().run()
	},
	{
		id: 'divider',
		label: 'Divider',
		description: 'Separate sections',
		icon: 'mdi:minus',
		matches: (node) => node.type.name === 'horizontalRule',
		insert: ({ editor }) => editor.chain().focus().setHorizontalRule().run()
	},
	{
		id: 'table',
		label: 'Table',
		description: 'Insert a 3 × 2 table',
		icon: 'mdi:table',
		matches: (node) => node.type.name === 'table',
		insert: ({ services }) => services.insertTable()
	},
	{
		id: 'image',
		label: 'Image',
		description: 'Upload one or more images',
		icon: 'mdi:image-outline',
		matches: (node) => node.type.name === 'mediaBlock' && node.attrs.kind !== 'video',
		insert: ({ services }) => services.requestMedia('image')
	},
	{
		id: 'video',
		label: 'Video',
		description: 'Upload one or more videos',
		icon: 'mdi:video-outline',
		matches: (node) => node.type.name === 'mediaBlock' && node.attrs.kind === 'video',
		insert: ({ services }) => services.requestMedia('video')
	}
];

const EXCLUDED_BLOCK_TYPES = new Set(['metadataBlock']);
const TURNABLE_SOURCE_TYPES = new Set(['paragraph', 'heading', 'codeBlock']);

export const BLOCK_TURN_TARGETS = CORE_BLOCKS.filter(
	(block): block is BlockDefinition & { id: BlockTurnTarget } => Boolean(block.turn)
).map(({ id, label, icon }) => ({ id, label, icon }));

const TURN_BLOCKS = new Map(
	CORE_BLOCKS.filter(
		(
			block
		): block is BlockDefinition & { id: BlockTurnTarget; turn: (editor: Editor) => boolean } =>
			Boolean(block.turn)
	).map((block) => [block.id, block])
);

export type BlockCatalog = ReturnType<typeof createBlockCatalog>;

export function createBlockCatalog(componentRegistry?: ComponentEmbedRegistry) {
	const componentBlocks: BlockDefinition[] = (componentRegistry?.insertable() ?? []).map(
		(entry) => ({
			id: `component:${entry.id}`,
			label: entry.label,
			description: 'Interactive component',
			icon: entry.icon ?? 'mdi:application-braces-outline',
			editLabel: entry.editLabel,
			matches: (node) =>
				node.type.name === 'componentEmbed' && String(node.attrs.component ?? '') === entry.id,
			insert: ({ editor }) =>
				insertRegisteredComponentEmbed(editor, componentRegistry!, entry.id).ok
		})
	);
	const definitions = [...CORE_BLOCKS, ...componentBlocks];
	const byId = new Map(definitions.map((definition) => [definition.id, definition]));

	return {
		insertable: () =>
			definitions
				.filter((definition) => definition.insertable !== false && definition.insert)
				.map(toPaletteItem),
		describe(node: ProseMirrorNode): BlockDescriptor {
			const definition = definitions.find((candidate) => candidate.matches(node));

			return definition
				? toDescriptor(definition)
				: { label: node.type.name, icon: 'mdi:shape-outline' };
		},
		isExcluded: (node: ProseMirrorNode) => EXCLUDED_BLOCK_TYPES.has(node.type.name),
		canTurn: (node: ProseMirrorNode) => TURNABLE_SOURCE_TYPES.has(node.type.name),
		insert(id: string, context: BlockInsertContext) {
			const definition = byId.get(id);
			if (!definition?.insert) return false;

			if (context.range) {
				context.editor.chain().focus().deleteRange(context.range).run();
			}

			return definition.insert({ editor: context.editor, services: context.services }) !== false;
		}
	};
}

export function runBlockTurn(editor: Editor, target: BlockTurnTarget) {
	return TURN_BLOCKS.get(target)?.turn(editor) ?? false;
}

function toPaletteItem(definition: BlockDefinition): BlockPaletteItem {
	return {
		id: definition.id,
		label: definition.label,
		description: definition.description,
		icon: definition.icon,
		...(definition.editLabel ? { editLabel: definition.editLabel } : {})
	};
}

function toDescriptor(definition: BlockDefinition): BlockDescriptor {
	return {
		label: definition.label,
		icon: definition.icon,
		...(definition.editLabel ? { editLabel: definition.editLabel } : {})
	};
}
