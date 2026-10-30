import { dev } from '$app/env';
import { GCS_BUCKET } from '$app/env/private';
import { resolve, sep } from 'node:path';
import { tagRegistryPath, readTagRegistry } from '#lib/crafts/tags.js';
import tagsJson from '#lib/crafts/tags.json?raw';
import { readPage } from '#lib/crafts/Page.js';
import { createHash } from 'node:crypto';
import { getAssetBucket } from '../assets/gcs';
import { createFileAttachmentStore, createFileTextStore } from './files';
import { createGcsAttachmentStore, createGcsTextStore } from './gcs';
import type { RepositoryOptions } from '../content/repository';

// Application composition: one choice selects both document and attachment persistence.
const bundled = import.meta.glob('/content/crafts/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;
function createStorage() {
	if (!dev && GCS_BUCKET) {
		const bucket = getAssetBucket();
		const seedDocuments = Object.entries(bundled).map(([path, markdown]) => {
			const id = path.split('/').pop()!.replace(/\.md$/, '');
			const page = readPage(markdown, { id });
			return {
				page,
				path: `content/crafts/${id}.md`,
				sha: createHash('sha256').update(markdown).digest('hex')
			};
		});
		return {
			text: createGcsTextStore(bucket),
			attachments: createGcsAttachmentStore(bucket),
			content: { seedDocuments, seedTags: readTagRegistry(tagsJson) } satisfies RepositoryOptions
		};
	}
	return {
		text: createFileTextStore(),
		attachments: createFileAttachmentStore(),
		content: {
			prefix: resolve('content/crafts') + sep,
			tagsKey: resolve(tagRegistryPath)
		} satisfies RepositoryOptions
	};
}
let storage: ReturnType<typeof createStorage> | undefined;
export function getStorage() {
	return (storage ??= createStorage());
}
