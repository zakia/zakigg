import { env } from '$env/dynamic/private';
import { Storage, type Bucket } from '@google-cloud/storage';

let bucket: Bucket | null = null;

export function getAssetBucket(): Bucket {
	if (bucket) return bucket;
	if (!env.GCS_BUCKET) throw new Error('GCS_BUCKET is not configured');
	bucket = new Storage(env.GCP_PROJECT_ID ? { projectId: env.GCP_PROJECT_ID } : undefined).bucket(
		env.GCS_BUCKET
	);
	return bucket;
}

export function assetObjectPath(id: string) {
	if (!/^asset_[A-Za-z0-9_-]{1,180}$/.test(id)) throw new Error('Invalid asset ID');
	return `assets/${id}`;
}

export async function saveAssetBlob(id: string, data: Buffer, contentType: string, fileName = '') {
	await getAssetBucket()
		.file(assetObjectPath(id))
		.save(data, {
			contentType: contentType || 'application/octet-stream',
			resumable: false,
			metadata: {
				cacheControl: 'public, max-age=31536000, immutable',
				metadata: fileName ? { fileName } : undefined
			}
		});
}

export async function readAssetBlob(id: string) {
	const file = getAssetBucket().file(assetObjectPath(id));
	try {
		const [metadata] = await file.getMetadata();
		const [data] = await file.download();
		return {
			data,
			contentType: metadata.contentType || 'application/octet-stream',
			fileName: metadata.metadata?.fileName || ''
		};
	} catch (cause) {
		if ((cause as { code?: number }).code === 404) return null;
		throw cause;
	}
}
