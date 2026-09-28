import { saveNoteAsset } from '$lib/editor/document/persistence/storage';
import {
	altTextFromFile,
	escapeAlt,
	mediaKindForFile,
	mediaUrlForAsset,
	type MediaKind
} from './source';

export type MediaInsert = {
	markdown: string;
	url: string;
	alt: string;
	kind: MediaKind;
};

/**
 * Save a dropped/pasted file to the local object store and describe it as a
 * standard markdown image reference. The URL stays stable: it resolves to the
 * local blob while editing and to GCS after commit. The renderer detects the
 * media kind from the URL's file extension.
 */
export async function createMediaMarkdown(file: File): Promise<MediaInsert> {
	const asset = await saveNoteAsset(file);
	const url = mediaUrlForAsset(asset.id, file.name, file.type);
	const alt = altTextFromFile(file);

	return {
		markdown: `![${escapeAlt(alt)}](${url})`,
		url,
		alt,
		kind: mediaKindForFile(file)
	};
}
