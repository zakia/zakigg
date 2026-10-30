import { GCS_BUCKET } from '$app/env/private';
import { Storage, type Bucket } from '@google-cloud/storage';

let bucket: Bucket | null = null;

export function getAssetBucket(): Bucket {
	if (bucket) return bucket;
	if (!GCS_BUCKET) throw new Error('GCS_BUCKET is not configured');

	bucket = new Storage().bucket(GCS_BUCKET);

	return bucket;
}
