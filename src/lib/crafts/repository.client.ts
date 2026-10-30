import { getReferencedAssetIds, type StoredPage } from '#lib/crafts/Page.js';
import { loadNoteAsset } from '#lib/editor/document/persistence/storage.js';
import { saveRepositoryCraft } from './repository.remote';

export async function commitRepositoryCraft(page: StoredPage) {
	await uploadReferencedAssets(page);
	return saveRepositoryCraft({
		pageJson: JSON.stringify(page)
	});
}

async function uploadReferencedAssets(page: StoredPage) {
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
