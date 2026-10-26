import { applyTagColors } from '#lib/components/tag.js';
import { getReferencedAssetIds, toStoredPage, type Page } from '#lib/editor/Page.js';
import { loadNoteAsset } from '#lib/editor/document/persistence/storage.js';
import {
	deleteRepositoryCraft,
	listRepositoryCrafts,
	saveRepositoryCraft
} from './repository.remote';

export async function refreshRepositoryCrafts() {
	await listRepositoryCrafts().refresh();
}

export async function commitRepositoryCraft(page: Page, expectedSha: string | null) {
	await uploadReferencedAssets(page);
	const result = await saveRepositoryCraft({
		pageJson: JSON.stringify(toStoredPage(page)),
		expectedSha
	});
	applyTagColors(result.tags);
	return result;
}

export async function removeRepositoryCraft(id: string) {
	await deleteRepositoryCraft(id);
}

async function uploadReferencedAssets(page: Page) {
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
