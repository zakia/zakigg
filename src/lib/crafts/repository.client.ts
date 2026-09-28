import { applyTagColors } from '$lib/components/tag';
import { getReferencedAssetIds, parseStoredPage, toStoredPage, type Page } from '$lib/editor/Page';
import { loadNoteAsset, markRepositorySaved } from '$lib/editor/document/persistence/storage';
import {
	deleteRepositoryCraft,
	getRepositoryCraft,
	listRepositoryCrafts,
	saveRepositoryCraft
} from './repository.remote';

export async function loadRepositoryCraft(slug: string) {
	const request = getRepositoryCraft(slug);
	await request.refresh();
	const document = await request;
	if (document) applyTagColors(document.tags);
	const page = document && parseStoredPage(document.page);
	return document && page ? { page, sha: document.sha } : null;
}

export async function loadRepositoryCrafts() {
	const request = listRepositoryCrafts();
	await request.refresh();
	const { documents, tags } = await request;
	applyTagColors(tags);
	return documents.map(({ page }) => parseStoredPage(page)).filter(isPage);
}

export async function commitRepositoryCraft(page: Page, expectedSha: string | null) {
	await uploadReferencedAssets(page);
	const result = await saveRepositoryCraft({
		pageJson: JSON.stringify(toStoredPage(page)),
		expectedSha
	});
	applyTagColors(result.tags);
	// The Git commit has succeeded even if the browser can no longer store its baseline.
	try {
		await markRepositorySaved(page);
	} catch (cause) {
		console.warn('Could not cache the Git baseline', cause);
	}
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

function isPage(page: Page | null): page is Page {
	return Boolean(page);
}
