import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertAssetId, type Attachment, type AttachmentStore, type TextStore } from './types';

async function optionalRead(path: string) {
	try {
		return await readFile(path);
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw cause;
	}
}
async function atomicWrite(path: string, data: string | Uint8Array) {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.${crypto.randomUUID()}.tmp`;
	try {
		await writeFile(temporary, data);
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
}
export function createFileTextStore(): TextStore {
	return {
		async get(key) {
			const data = await optionalRead(key);
			return data?.toString('utf8') ?? null;
		},
		put: atomicWrite,
		async list(prefix) {
			try {
				return (await readdir(prefix)).sort().map((name) => join(prefix, name));
			} catch (cause) {
				if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
				throw cause;
			}
		},
		async delete(key) {
			await rm(key, { force: true });
		}
	};
}
export function createFileAttachmentStore(root = resolve('.data/assets')): AttachmentStore {
	return {
		async read(id) {
			assertAssetId(id);
			const record = await optionalRead(join(root, `${id}.json`));
			if (!record) return null;
			const parsed = JSON.parse(record.toString('utf8')) as {
				data: string;
				contentType: string;
				fileName: string;
			};
			return { ...parsed, data: new Uint8Array(Buffer.from(parsed.data, 'base64')) };
		},
		async write(id, asset: Attachment) {
			assertAssetId(id);
			// One atomic record keeps bytes and serving metadata together if a write fails.
			await atomicWrite(
				join(root, `${id}.json`),
				JSON.stringify({ ...asset, data: Buffer.from(asset.data).toString('base64') })
			);
		}
	};
}
