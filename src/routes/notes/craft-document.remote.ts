import { dev } from '$app/environment';
import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import * as v from 'valibot';
import { craftComponentEmbeds } from '$lib/crafts/component-embeds';
import {
	isCraftDocumentContent,
	normalizeCraftDocumentContent
} from '$lib/crafts/document-content';
import type { CraftDocument } from '$lib/crafts/types';

const CRAFTS_DIR = 'src/lib/crafts';
const CRAFT_ASSETS_DIR = 'static/craft-assets';
const SLUG_RE = /^[a-z0-9-]+$/i;
const MEDIA_TYPE_RE = /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm|quicktime|x-m4v))$/i;
const MAX_ASSET_BYTES = 50 * 1024 * 1024;

const CraftDocumentSchema = v.object({
	version: v.literal(1),
	editor: v.literal('tiptap'),
	content: v.any(),
	updatedAt: v.optional(v.string())
});

const CraftAssetSchema = v.object({
	fileName: v.pipe(v.string(), v.minLength(1)),
	mediaType: v.pipe(v.string(), v.regex(MEDIA_TYPE_RE)),
	data: v.pipe(v.string(), v.minLength(1))
});

function assertDev() {
	if (!dev) error(403, 'Craft publishing is only available in development');
}

export const publishCraftDocument = command(
	v.object({
		slug: v.pipe(v.string(), v.regex(SLUG_RE)),
		document: CraftDocumentSchema
	}),
	async ({ slug, document }) => {
		assertDev();

		if (!isCraftDocumentContent(document.content)) {
			error(400, 'Invalid document content');
		}

		const content = normalizeCraftDocumentContent(document.content);
		const embedIssues = craftComponentEmbeds.validateDocument(content);

		if (embedIssues.length) {
			error(400, `Invalid component embed at ${embedIssues[0].path}: ${embedIssues[0].message}`);
		}

		const nextDocument: CraftDocument = {
			version: 1,
			editor: 'tiptap',
			content,
			updatedAt: new Date().toISOString()
		};

		await writeFile(
			join(CRAFTS_DIR, slug, 'content.json'),
			`${JSON.stringify(nextDocument, null, 2)}\n`,
			'utf8'
		);

		return nextDocument;
	}
);

export const uploadCraftAsset = command(
	v.object({
		slug: v.pipe(v.string(), v.regex(SLUG_RE)),
		asset: CraftAssetSchema
	}),
	async ({ slug, asset }) => {
		assertDev();

		const buffer = Buffer.from(asset.data, 'base64');

		if (!buffer.byteLength || buffer.byteLength > MAX_ASSET_BYTES) {
			error(400, 'Invalid media size');
		}

		const fileName = createAssetFileName(asset.fileName, asset.mediaType);
		const assetDir = join(CRAFT_ASSETS_DIR, slug);

		await mkdir(assetDir, { recursive: true });
		await writeFile(join(assetDir, fileName), buffer);

		return {
			src: `/craft-assets/${slug}/${fileName}`,
			fileName,
			mediaType: asset.mediaType
		};
	}
);

function createAssetFileName(fileName: string, mediaType: string) {
	const originalExtension = extname(fileName).toLowerCase();
	const extension = getAssetExtension(originalExtension, mediaType);
	const name = basename(fileName, originalExtension)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const stem = name || 'media';
	const suffix = randomUUID().slice(0, 8);

	return `${stem}-${suffix}${extension}`;
}

function getAssetExtension(originalExtension: string, mediaType: string) {
	const extensions = getAllowedExtensions(mediaType);

	if (extensions.includes(originalExtension)) return originalExtension;

	return extensions[0];
}

function getAllowedExtensions(mediaType: string) {
	switch (mediaType.toLowerCase()) {
		case 'image/png':
			return ['.png'];
		case 'image/jpeg':
		case 'image/jpg':
			return ['.jpg', '.jpeg'];
		case 'image/webp':
			return ['.webp'];
		case 'image/gif':
			return ['.gif'];
		case 'image/avif':
			return ['.avif'];
		case 'video/webm':
			return ['.webm'];
		case 'video/quicktime':
			return ['.mov'];
		case 'video/x-m4v':
			return ['.m4v'];
		default:
			return ['.mp4'];
	}
}
