import type { JSONContent } from '@tiptap/core';
import type { ComponentEmbedRegistry } from '$lib/editor/core/embeds';
import { normalizeMediaBlockAttrs } from '$lib/editor/core/media-block/config';
import { importNotesFromZip, isNotesArchiveFile } from './import';
import { parseEditorMarkdown, isMarkdownFile } from '../markdown';
import { createLocalAssetSrc, getAltTextForFile, getMediaKindForFile, isMediaFile } from './assets';
import { normalizeMetadataEntries } from '../metadata';
import { createNotePageRecord, saveNoteAsset, saveNotePage } from './storage';
import { getFirstLevelOneHeadingText, titleFromSlug, type NotePageV1 } from '../model';

const TEXT_FILE_RE =
	/\.(?:txt|text|csv|json|ya?ml|xml|html?|css|[cm]?js|[cm]?ts|jsx|tsx|svelte|svx)$/i;

export type DocumentFileImportResult = {
	pages: NotePageV1[];
	failed: File[];
};

export async function importDocumentFiles(
	files: File[],
	embeds: ComponentEmbedRegistry
): Promise<DocumentFileImportResult> {
	const pages: NotePageV1[] = [];
	const failed: File[] = [];

	for (const file of files) {
		try {
			if (isNotesArchiveFile(file)) {
				try {
					pages.push(...(await importNotesFromZip(file)).pages);
				} catch {
					pages.push(await importAttachmentDocument(file));
				}
			} else if (isMarkdownFile(file) || isTextFile(file)) {
				pages.push(await importTextDocument(file, embeds));
			} else if (isMediaFile(file)) {
				pages.push(await importMediaDocument(file));
			} else {
				pages.push(await importAttachmentDocument(file));
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

async function importTextDocument(file: File, embeds: ComponentEmbedRegistry) {
	const parsed = parseEditorMarkdown(await file.text(), embeds);
	const fallbackTitle = titleFromFile(file);
	const title =
		parsed.frontmatter?.title || getFirstLevelOneHeadingText(parsed.content) || fallbackTitle;

	return createNotePageRecord({
		title,
		properties: normalizeMetadataEntries(parsed.properties),
		content: parsed.content
	});
}

async function importMediaDocument(file: File) {
	const title = titleFromFile(file);
	const page = await createNotePageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const content: JSONContent = {
		type: 'doc',
		content: [
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

async function importAttachmentDocument(file: File) {
	const title = titleFromFile(file);
	const page = await createNotePageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const content: JSONContent = {
		type: 'doc',
		content: [
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
function titleFromFile(file: File) {
	return titleFromSlug(file.name.replace(/\.[^.]+$/, ''));
}
