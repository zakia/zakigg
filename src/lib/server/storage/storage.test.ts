import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Bucket } from '@google-cloud/storage';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileAttachmentStore, createFileTextStore } from './files';
import { createGcsAttachmentStore, createGcsTextStore } from './gcs';
import type { Attachment } from './types';

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
	);
});
// In-process Bucket stand-in exercises adapter behavior; it does not verify GCS HTTP/auth.
function bucketStandIn(): Bucket {
	const objects = new Map<
		string,
		{ data: Buffer; options: { contentType?: string; metadata?: unknown } }
	>();
	return {
		async getFiles({ prefix }: { prefix: string }) {
			return [
				[...objects.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name }))
			];
		},
		file(key: string) {
			const read = () => {
				const value = objects.get(key);
				if (!value) throw Object.assign(new Error('Not found'), { code: 404 });
				return value;
			};
			return {
				async download() {
					return [read().data];
				},
				async getMetadata() {
					const value = read();
					return [
						{ contentType: value.options.contentType, ...(value.options.metadata as object) }
					];
				},
				async save(data: string | Buffer, options: { contentType?: string; metadata?: unknown }) {
					objects.set(key, { data: Buffer.from(data), options });
				},
				async delete() {
					read();
					objects.delete(key);
				}
			};
		}
	} as unknown as Bucket;
}
for (const provider of ['filesystem', 'gcs stand-in'] as const) {
	describe(`${provider} persistence contract`, () => {
		async function setup() {
			const root = await mkdtemp(join(tmpdir(), 'zakigg-store-'));
			directories.push(root);
			const bucket = bucketStandIn();
			return {
				text: provider === 'filesystem' ? createFileTextStore() : createGcsTextStore(bucket),
				assets:
					provider === 'filesystem'
						? createFileAttachmentStore(root)
						: createGcsAttachmentStore(bucket),
				prefix: provider === 'filesystem' ? root + '/' : 'notes/'
			};
		}
		it('stores exact source, lists keys, replaces values, and deletes', async () => {
			const { text, prefix } = await setup();
			const key = prefix + 'note.md';
			expect(await text.get(key)).toBeNull();
			const source = '---\r\n# comment\r\ntitle: Note\r\n---\r\n\r\nBody  \r\n';
			await text.put(key, source);
			expect(await text.get(key)).toBe(source);
			expect(await text.list(prefix)).toEqual([key]);
			await text.put(key, 'Last save');
			expect(await text.get(key)).toBe('Last save');
			await text.delete(key);
			await text.delete(key);
			expect(await text.get(key)).toBeNull();
		});
		it('preserves attachment bytes and serving metadata separately', async () => {
			const { assets } = await setup();
			expect(await assets.read('asset_missing')).toBeNull();
			const asset: Attachment = {
				data: new Uint8Array([0, 255, 42, 8]),
				contentType: 'image/png',
				fileName: 'Photo.png'
			};
			await assets.write('asset_photo', asset);
			expect(await assets.read('asset_photo')).toEqual(asset);
			await expect(assets.read('../escape')).rejects.toThrow('Invalid attachment ID');
		});
	});
}
