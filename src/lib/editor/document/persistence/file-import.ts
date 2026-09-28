import type { ComponentEmbedRegistry } from '$lib/editor/components/registry';
import { importNotesFromZip, isNotesArchiveFile } from './import';
import { parseEditorMarkdown, isMarkdownFile } from '../markdown';
import { isMediaFile } from './assets';
import { altTextFromFile, escapeAlt, mediaUrlForAsset } from '$lib/editor/features/media/source';
import { createPageRecord, saveNoteAsset, savePage } from './storage';
import { getFirstMarkdownHeading } from '../markdown-ast';
import type { MetadataProperties } from '../metadata';
import { titleFromSlug, readPage, type Page } from '../../Page';

const TEXT_FILE_RE =
	/\.(?:txt|text|csv|json|ya?ml|xml|html?|css|[cm]?js|[cm]?ts|jsx|tsx|svelte|svx)$/i;

export type DocumentFileImportResult = {
	pages: Page[];
	failed: File[];
};

export async function importDocumentFiles(
	files: File[],
	embeds: ComponentEmbedRegistry
): Promise<DocumentFileImportResult> {
	const pages: Page[] = [];
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

	const properties: MetadataProperties = { ...parsed.properties, title };
	delete properties.id;
	return createPageRecord(properties, parsed.markdown);
}

async function importMediaDocument(file: File) {
	const title = titleFromFile(file);
	const page = await createPageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const markdown = `![${escapeAlt(altTextFromFile(file))}](${mediaUrlForAsset(asset.id, file.name, file.type)})`;
	return savePage(readPage(`${page.markdown}\n${markdown}\n`, page));
}

async function importAttachmentDocument(file: File) {
	const title = titleFromFile(file);
	const page = await createPageRecord({ title });
	const asset = await saveNoteAsset(file, page.id);
	const markdown = `![${escapeAlt(altTextFromFile(file))}](${mediaUrlForAsset(asset.id, file.name, file.type)})`;
	return savePage(readPage(`${page.markdown}\n${markdown}\n`, page));
}

function titleFromFile(file: File) {
	return titleFromSlug(file.name.replace(/\.[^.]+$/, ''));
}
