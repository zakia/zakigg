import type { Bucket } from '@google-cloud/storage';
import { assertAssetId, type AttachmentStore, type TextStore } from './types';

function missing(cause: unknown) {
	return (cause as { code?: number }).code === 404;
}
export function createGcsTextStore(bucket: Bucket): TextStore {
	return {
		async get(key) {
			try {
				const [data] = await bucket.file(key).download();
				return data.toString('utf8');
			} catch (cause) {
				if (missing(cause)) return null;
				throw cause;
			}
		},
		async put(key, value) {
			await bucket
				.file(key)
				.save(value, { resumable: false, contentType: 'text/plain; charset=utf-8' });
		},
		async list(prefix) {
			const [files] = await bucket.getFiles({ prefix });
			return files.map((file) => file.name).sort();
		},
		async delete(key) {
			try {
				await bucket.file(key).delete();
			} catch (cause) {
				if (!missing(cause)) throw cause;
			}
		}
	};
}
export function createGcsAttachmentStore(bucket: Bucket): AttachmentStore {
	return {
		async read(id) {
			assertAssetId(id);
			try {
				const file = bucket.file(`assets/${id}`);
				const [metadata] = await file.getMetadata();
				const [data] = await file.download();
				return {
					data: new Uint8Array(data),
					contentType: metadata.contentType || 'application/octet-stream',
					fileName: String(metadata.metadata?.fileName || '')
				};
			} catch (cause) {
				if (missing(cause)) return null;
				throw cause;
			}
		},
		async write(id, asset) {
			assertAssetId(id);
			await bucket.file(`assets/${id}`).save(Buffer.from(asset.data), {
				resumable: false,
				contentType: asset.contentType,
				metadata: {
					cacheControl: 'public, max-age=31536000, immutable',
					metadata: { fileName: asset.fileName }
				}
			});
		}
	};
}
