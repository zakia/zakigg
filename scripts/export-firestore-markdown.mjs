import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { GoogleAuth } from 'google-auth-library';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { legacyEditorContentToMarkdown } from './legacy-editor-markdown.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');

const discovered = discoverCloudConfiguration();
const projectId = process.env.GCP_PROJECT_ID || discovered.projectId;
const bucketName = process.env.GCS_BUCKET || discovered.environment.GCS_BUCKET;
const databaseId =
	process.env.FIRESTORE_DATABASE_ID || discovered.environment.FIRESTORE_DATABASE_ID || '(default)';

if (!projectId || !bucketName) {
	throw new Error(
		'Could not discover GCP_PROJECT_ID and GCS_BUCKET. Set them in the environment or deploy the configured Cloud Run service.'
	);
}

const auth = new GoogleAuth({
	scopes: [
		'https://www.googleapis.com/auth/datastore',
		'https://www.googleapis.com/auth/devstorage.read_write'
	]
});
let client;
try {
	client = await auth.getClient();
} catch (cause) {
	throw new Error(
		'Google Application Default Credentials are unavailable. Run: gcloud auth application-default login',
		{ cause }
	);
}
const outputDirectory = resolve('content/crafts');

console.log(`Export source: ${projectId}/${databaseId}, bucket ${bucketName}`);

const [pageDocuments, publicationDocuments] = await Promise.all([
	runCollectionGroupQuery('pages'),
	runCollectionGroupQuery('published_crafts')
]);
const publishedIds = new Set(
	publicationDocuments.map((document) =>
		String(decodeFields(document.fields).pageId || document.id)
	)
);
const seenIds = new Set();
const seenSlugs = new Set();
const assets = new Map();

await mkdir(outputDirectory, { recursive: true });

for (const document of pageDocuments) {
	const fields = decodeFields(document.fields);
	const id = String(fields.id || document.id);
	const userId = ownerIdFromPageName(document.name);
	if (!safeId(id) || !userId) throw new Error(`Invalid page identity in ${document.name}`);
	if (seenIds.has(id)) throw new Error(`Duplicate page id: ${id}`);

	const bodyObject = String(fields.bodyObject || '');
	const bodyHash = String(fields.bodyHash || '');
	if (!bodyObject || !bodyHash) throw new Error(`Page ${id} has no Markdown body object`);
	const bodyData = await downloadObject(bodyObject);
	const actualHash = createHash('sha256').update(bodyData).digest('hex');
	if (actualHash !== bodyHash) throw new Error(`Body hash mismatch for ${id}`);

	const body = JSON.parse(bodyData.toString('utf8'));
	const { frontmatter, markdownBody } = decodeStoredBody(body, id);
	const slug = String(frontmatter.slug || fields.slug || id);
	if (seenSlugs.has(slug)) throw new Error(`Duplicate page slug: ${slug}`);

	const metadata = {
		...frontmatter,
		id,
		title: String(frontmatter.title || fields.title || 'Untitled'),
		slug,
		tags: normalizeTags(frontmatter.tags ?? fields.tags),
		date: normalizeDate(frontmatter.date || fields.createdAt),
		draft: !publishedIds.has(id)
	};
	const markdown = `---\n${stringifyYaml(metadata, { lineWidth: 0, nullStr: '' }).trimEnd()}\n---${markdownBody.trim() ? `\n\n${markdownBody.trim()}\n` : '\n'}`;

	await writeFile(resolve(outputDirectory, `${id}.md`), markdown, 'utf8');
	seenIds.add(id);
	seenSlugs.add(slug);

	for (const assetId of referencedAssetIds(markdown)) {
		assets.set(assetId, userId);
	}
}

let copiedAssets = 0;
for (const [assetId, userId] of assets) {
	const destination = `assets/${assetId}`;
	if (await objectExists(destination)) continue;
	await copyObject(`users/${userId}/assets/${assetId}`, destination);
	copiedAssets += 1;
}

console.log(`Exported ${seenIds.size} Markdown files to content/crafts.`);
console.log(`Referenced ${assets.size} assets; copied ${copiedAssets} into assets/.`);

async function runCollectionGroupQuery(collectionId) {
	const database = encodeURIComponent(databaseId);
	const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${database}/documents:runQuery`;
	const response = await client.request({
		url,
		method: 'POST',
		data: {
			structuredQuery: {
				from: [{ collectionId, allDescendants: true }]
			}
		}
	});
	return (Array.isArray(response.data) ? response.data : [])
		.map((result) => result.document)
		.filter(Boolean)
		.map((document) => ({
			...document,
			id: document.name.split('/').at(-1)
		}));
}

function decodeFields(fields = {}) {
	return Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
	);
}

function decodeValue(value) {
	if (!value || typeof value !== 'object') return undefined;
	if ('nullValue' in value) return null;
	if ('stringValue' in value) return value.stringValue;
	if ('booleanValue' in value) return value.booleanValue;
	if ('integerValue' in value) return Number(value.integerValue);
	if ('doubleValue' in value) return value.doubleValue;
	if ('timestampValue' in value) return value.timestampValue;
	if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
	if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
	return undefined;
}

function splitFrontmatter(markdown) {
	const match = markdown.match(
		/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n(?:\r?\n)?|$)/
	);
	if (!match) return { frontmatter: {}, markdownBody: markdown };
	const parsed = parseYaml(match[1] || '');
	if (parsed && (typeof parsed !== 'object' || Array.isArray(parsed))) {
		throw new Error('Markdown frontmatter must be an object');
	}
	return { frontmatter: parsed || {}, markdownBody: markdown.slice(match[0].length) };
}

function decodeStoredBody(body, id) {
	if (typeof body?.markdown === 'string') return splitFrontmatter(body.markdown);
	if (typeof body?.contentJson !== 'string') {
		const shape = body && typeof body === 'object' ? Object.keys(body).join(', ') : typeof body;
		throw new Error(`Page ${id} has an unsupported body shape (fields: ${shape || 'none'})`);
	}

	const content = JSON.parse(body.contentJson);
	const properties = parseLegacyMetadata(body.propertiesJson, true);
	const legacyFrontmatter = parseLegacyMetadata(body.frontmatterJson, false);
	return {
		frontmatter: { ...legacyFrontmatter, ...properties },
		markdownBody: legacyEditorContentToMarkdown(content)
	};
}

function parseLegacyMetadata(value, entries) {
	if (typeof value !== 'string' || !value.trim()) return {};
	const parsed = JSON.parse(value);
	if (!parsed || typeof parsed !== 'object') return {};
	if (!entries) return Array.isArray(parsed) ? {} : parsed;
	if (!Array.isArray(parsed)) return parsed;
	return Object.fromEntries(
		parsed
			.filter((entry) => entry && typeof entry.key === 'string')
			.map((entry) => [entry.key, entry.value])
	);
}

function ownerIdFromPageName(name) {
	const match = name.match(/\/documents\/notes_users\/([^/]+)\/pages\//);
	return match?.[1] || '';
}

function referencedAssetIds(markdown) {
	return new Set(
		[...markdown.matchAll(/local-asset:\/\/([^\s"')}>]+)/g)].map((match) => {
			try {
				return decodeURIComponent(match[1]);
			} catch {
				return match[1];
			}
		})
	);
}

function normalizeTags(value) {
	const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	return [
		...new Set(
			tags.map((tag) => String(tag).trim().replace(/^#+/, '').toLowerCase()).filter(Boolean)
		)
	];
}

function normalizeDate(value) {
	const time = Date.parse(String(value || ''));
	return Number.isFinite(time)
		? new Date(time).toISOString().slice(0, 10)
		: new Date().toISOString().slice(0, 10);
}

function safeId(value) {
	return /^[A-Za-z0-9_-]{1,180}$/.test(value);
}

async function downloadObject(name) {
	const response = await client.request({
		url: `${objectUrl(name)}?alt=media`,
		method: 'GET',
		responseType: 'arraybuffer'
	});
	return Buffer.from(response.data);
}

async function objectExists(name) {
	try {
		await client.request({ url: objectUrl(name), method: 'GET' });
		return true;
	} catch (cause) {
		if (cause?.response?.status === 404) return false;
		throw cause;
	}
}

async function copyObject(source, destination) {
	const base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(source)}/rewriteTo/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(destination)}`;
	let rewriteToken = '';
	do {
		const response = await client.request({
			url: rewriteToken ? `${base}?rewriteToken=${encodeURIComponent(rewriteToken)}` : base,
			method: 'POST'
		});
		if (response.data.done) return;
		rewriteToken = String(response.data.rewriteToken || '');
		if (!rewriteToken) throw new Error(`GCS did not finish copying ${source}`);
	} while (rewriteToken);
}

function objectUrl(name) {
	return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(name)}`;
}

function discoverCloudConfiguration() {
	const configuredProject = runGcloud(['config', 'get-value', 'project', '--quiet']);
	const projectId =
		process.env.GCP_PROJECT_ID ||
		(configuredProject && configuredProject !== '(unset)' ? configuredProject : '');
	if (!projectId) return { projectId: '', environment: {} };

	const service = process.env.CLOUD_RUN_SERVICE || 'zakigg';
	const regions = [
		process.env.GCP_REGION,
		process.env.ACTIVE_REGION,
		'us-east1',
		'northamerica-northeast2'
	].filter((region, index, values) => region && values.indexOf(region) === index);

	for (const region of regions) {
		const raw = runGcloud([
			'run',
			'services',
			'describe',
			service,
			'--region',
			region,
			'--project',
			projectId,
			'--format=json'
		]);
		if (!raw) continue;
		try {
			const serviceConfig = JSON.parse(raw);
			const entries = serviceConfig.spec?.template?.spec?.containers?.[0]?.env ?? [];
			const environment = Object.fromEntries(
				entries
					.filter((entry) => typeof entry.value === 'string')
					.map((entry) => [entry.name, entry.value])
			);
			if (environment.GCS_BUCKET) return { projectId, environment };
		} catch {
			// Try the next configured region.
		}
	}

	return { projectId, environment: {} };
}

function runGcloud(args) {
	const result = spawnSync('gcloud', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
	return result.status === 0 ? result.stdout.trim() : '';
}
