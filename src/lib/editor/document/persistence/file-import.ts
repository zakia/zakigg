import type { ComponentEmbedRegistry } from '$lib/editor/components/registry';
import { importNotesFromZip, isNotesArchiveFile } from './import';
import { parseEditorMarkdown, isMarkdownFile } from '../markdown';
import { createLocalAssetSrc, getAltTextForFile, getMediaKindForFile, isMediaFile } from './assets';
import { normalizeMetadataEntries } from '../metadata';
import { createNotePageRecord, saveNoteAsset, saveNotePage } from './storage';
import { getFirstMarkdownHeading } from '../markdown-ast';
import { titleFromSlug, type NotePage } from '../model';

const TEXT_FILE_RE =
	/\.(?:txt|text|csv|json|ya?ml|xml|html?|css|[cm]?js|[cm]?ts|jsx|tsx|svelte|svx)$/i;

export type DocumentFileImportResult = {
	pages: NotePage[];
	failed: File[];
};

export async function importDocumentFiles(
	files: File[],
	embeds: ComponentEmbedRegistry
): Promise<DocumentFileImportResult> {
	const pages: NotePage[] = [];
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
		parsed.frontmatter?.title || getFirstMarkdownHeading(parsed.markdown) || fallbackTitle;

	return createNotePageRecord({
		title,
		properties: normalizeMetadataEntries(parsed.properties),
		markdown: parsed.markdown
	});
}

async function importMediaDocument(file: File) {
	const title = titleFromFile(file);
	const page = await createNotePageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const component = getMediaKindForFile(file) === 'video' ? 'Video' : 'Image';
	const markdown = `<${component} src="${createLocalAssetSrc(asset.id)}" assetId="${asset.id}" alt="${escapeAttribute(getAltTextForFile(file))}" title="${escapeAttribute(title)}" />`;
	return saveNotePage({ ...page, markdown });
}

async function importAttachmentDocument(file: File) {
	const title = titleFromFile(file);
	const page = await createNotePageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const markdown = `<Attachment src="${createLocalAssetSrc(asset.id)}" name="${escapeAttribute(file.name)}" mediaType="${escapeAttribute(file.type || 'application/octet-stream')}" size={${file.size}} />`;
	return saveNotePage({ ...page, markdown });
}

function escapeAttribute(value: string) {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function titleFromFile(file: File) {
	return titleFromSlug(file.name.replace(/\.[^.]+$/, ''));
}
