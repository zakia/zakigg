import {
	getReferencedAssetIds,
	parseStoredPage,
	toStoredNotePage,
	type NotePage
} from '$lib/editor/document/model';
import { loadNoteAsset } from '$lib/editor/document/persistence/storage';
import {
	deleteRepositoryCraft,
	getRepositoryCraft,
	listRepositoryCrafts,
	saveRepositoryCraft
} from './repository.remote';

export async function loadRepositoryCraft(slug: string) {
	return parseStoredPage(await getRepositoryCraft(slug));
}

export async function loadRepositoryCrafts() {
	return (await listRepositoryCrafts()).map(parseStoredPage).filter(isNotePage);
}

export async function commitRepositoryCraft(page: NotePage) {
	await uploadReferencedAssets(page);
	return saveRepositoryCraft({ pageJson: JSON.stringify(toStoredNotePage(page)) });
}

export async function removeRepositoryCraft(id: string) {
	await deleteRepositoryCraft(id);
}

async function uploadReferencedAssets(page: NotePage) {
	for (const id of getReferencedAssetIds(page.markdown)) {
		const asset = await loadNoteAsset(id);
		if (!asset) continue;
		const response = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
			method: 'PUT',
			body: asset.blob,
			headers: {
				'Content-Type': asset.mediaType || 'application/octet-stream',
				'X-File-Name': encodeURIComponent(asset.name)
			}
		});
		if (!response.ok) throw new Error(`Asset upload failed (${response.status})`);
	}
}

function isNotePage(page: NotePage | null): page is NotePage {
	return Boolean(page);
}
