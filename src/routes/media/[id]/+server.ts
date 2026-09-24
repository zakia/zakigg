import { error, type RequestHandler } from '@sveltejs/kit';
import { readAssetBlob } from '$lib/server/assets/gcs';

export const GET: RequestHandler = async ({ params, url, request }) => {
	const id = params.id ?? '';
	if (!/^asset_[A-Za-z0-9_-]{1,180}$/.test(id)) throw error(404, 'Asset not found');

	// Hotlink protection: only serve assets to requests originating from this
	// site. Direct navigation (no Referer/Origin) is allowed; foreign origins 403.
	if (
		isForeignOrigin(request.headers.get('referer'), url) ||
		isForeignOrigin(request.headers.get('origin'), url)
	) {
		throw error(403, 'Hotlinking is not allowed');
	}

	const asset = await readAssetBlob(id);
	if (!asset) throw error(404, 'Asset not found');

	return new Response(new Uint8Array(asset.data), {
		headers: {
			'Content-Type': asset.contentType,
			'Cache-Control': 'public, max-age=31536000, immutable',
			...(asset.fileName
				? { 'Content-Disposition': `inline; filename="${safeFileName(String(asset.fileName))}"` }
				: {})
		}
	});
};

function safeFileName(value: string) {
	return value.replace(/["\\\r\n]/g, '_').slice(0, 180);
}

function isForeignOrigin(value: string | null, url: URL): boolean {
	if (!value) return false;
	try {
		return new URL(value).origin !== url.origin;
	} catch {
		return false;
	}
}
