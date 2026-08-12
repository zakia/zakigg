import type { JSONContent } from '@tiptap/core';
import { normalizeMediaBlockAttrs } from '$lib/editor/media-block/config';
import { importNotesFromZip, isNotesArchiveFile } from './import';
import { parseEditorMarkdown, isMarkdownFile } from './markdown';
import { createLocalAssetSrc, getAltTextForFile, getMediaKindForFile, isMediaFile } from './media';
import { normalizeMetadataEntries } from './metadata-block';
import { createNotePageRecord, saveNoteAsset, saveNotePage } from './storage';
import { getFirstLevelOneHeadingText, titleFromSlug, type NotePageV1 } from './types';

const TEXT_FILE_RE =
	/\.(?:txt|text|csv|json|ya?ml|xml|html?|css|[cm]?js|[cm]?ts|jsx|tsx|svelte|svx)$/i;

export type CraftFileImportResult = {
	pages: NotePageV1[];
	failed: File[];
};

export async function importCraftFiles(files: File[]): Promise<CraftFileImportResult> {
	const pages: NotePageV1[] = [];
	const failed: File[] = [];

	for (const file of files) {
		try {
			if (isNotesArchiveFile(file)) {
				try {
					pages.push(...(await importNotesFromZip(file)).pages);
				} catch {
					pages.push(await importAttachmentCraft(file));
				}
			} else if (isMarkdownFile(file) || isTextFile(file)) {
				pages.push(await importTextCraft(file));
			} else if (isMediaFile(file)) {
				pages.push(await importMediaCraft(file));
			} else {
				pages.push(await importAttachmentCraft(file));
			}
		} catch (error) {
			console.error(`Could not import ${file.name}`, error);
			failed.push(file);
		}
	}

	return { pages, failed };
}

function isTextFile(file: File) {
	return (
		file.type.startsWith('text/') ||
		file.type === 'application/json' ||
		TEXT_FILE_RE.test(file.name)
	);
}

async function importTextCraft(file: File) {
	const parsed = parseEditorMarkdown(await file.text());
	const fallbackTitle = titleFromFile(file);
	const title =
		parsed.frontmatter?.title || getFirstLevelOneHeadingText(parsed.content) || fallbackTitle;

	return createNotePageRecord({
		title,
		properties: normalizeMetadataEntries(parsed.properties),
		content: withLeadingTitle(parsed.content, title)
	});
}

async function importMediaCraft(file: File) {
	const title = titleFromFile(file);
	const page = await createNotePageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const content: JSONContent = {
		type: 'doc',
		content: [
			headingNode(title),
			{
				type: 'mediaBlock',
				attrs: normalizeMediaBlockAttrs({
					kind: getMediaKindForFile(file),
					src: createLocalAssetSrc(asset.id),
					assetId: asset.id,
					alt: getAltTextForFile(file),
					title
				})
			}
		]
	};

	return saveNotePage({ ...page, content });
}

async function importAttachmentCraft(file: File) {
	const title = titleFromFile(file);
	const page = await createNotePageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const content: JSONContent = {
		type: 'doc',
		content: [
			headingNode(title),
			{
				type: 'componentEmbed',
				attrs: {
					component: 'core.Attachment',
					props: {
						src: createLocalAssetSrc(asset.id),
						name: file.name,
						mediaType: file.type || 'application/octet-stream',
						size: file.size
					}
				}
			}
		]
	};

	return saveNotePage({ ...page, content });
}

function withLeadingTitle(content: JSONContent, title: string): JSONContent {
	const nodes = [...(content.content ?? [])];
	const first = nodes[0];

	if (first?.type === 'heading' && Number(first.attrs?.level) === 1) {
		nodes[0] = headingNode(title);
	} else {
		nodes.unshift(headingNode(title));
	}

	return { ...content, type: 'doc', content: nodes };
}

function headingNode(title: string): JSONContent {
	return {
		type: 'heading',
		attrs: { level: 1 },
		content: [{ type: 'text', text: title }]
	};
}

function titleFromFile(file: File) {
	return titleFromSlug(file.name.replace(/\.[^.]+$/, ''));
}
