import { error, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { saveAssetBlob } from '$lib/server/assets/gcs';

const MAX_ASSET_BYTES = 20_000_000;

export const PUT: RequestHandler = async ({ params, request }) => {
	auth({ required: true });
	const id = params.id ?? '';
	if (!/^asset_[A-Za-z0-9_-]{1,180}$/.test(id)) throw error(400, 'Invalid asset ID');

	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) throw error(403, 'Invalid request origin');

	const data = Buffer.from(await request.arrayBuffer());
	if (!data.length) throw error(400, 'Empty asset body');
	if (data.length > MAX_ASSET_BYTES) throw error(413, 'Asset exceeds the 20 MB upload limit');

	await saveAssetBlob(
		id,
		data,
		request.headers.get('content-type') || 'application/octet-stream',
		decodeFileName(request.headers.get('x-file-name') || '')
	);
	return new Response(null, { status: 204 });
};

function decodeFileName(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
