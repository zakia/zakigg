import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { assertSyncUser } from '$lib/server/notes-sync/auth';
import {
	getAssetDoc,
	markAssetBlobUploaded,
	readAssetBlob,
	saveAssetBlob
} from '$lib/server/notes-sync/firestore';

// Asset blobs are proxied through the server rather than via signed URLs: one
// origin, no GCS CORS setup, auth via the same session cookie. Cloud Run caps
// request bodies at 32 MB, which bounds the supported asset size.
export const GET: RequestHandler = async ({ locals, params }) => {
	assertSyncUser(locals);

	const id = params.id ?? '';
	const blob = await readAssetBlob(id);

	if (!blob) throw error(404, 'Asset blob not found');

	const meta = await getAssetDoc(id);

	return new Response(new Uint8Array(blob.data), {
		headers: {
			'Content-Type': meta?.mediaType || blob.contentType || 'application/octet-stream',
			'Cache-Control': 'private, no-store'
		}
	});
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	assertSyncUser(locals);

	const id = params.id ?? '';
	const meta = await getAssetDoc(id);

	// Blob uploads are only accepted for assets whose metadata was pushed first.
	if (!meta) throw error(404, 'Asset metadata not found');

	const data = Buffer.from(await request.arrayBuffer());

	if (!data.length) throw error(400, 'Empty asset body');

	await saveAssetBlob(id, data, request.headers.get('content-type') || meta.mediaType);
	await markAssetBlobUploaded(id);

	return new Response(null, { status: 204 });
};
