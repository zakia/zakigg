import { createSign } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { NotePage } from '$lib/editor/document/model';
import {
	parseRepositoryMarkdown,
	repositoryPath,
	type ContentRepository,
	type RepositoryDocument
} from './repository';

type GithubConfig = {
	clientId: string;
	installationId: string;
	privateKey: string;
	owner: string;
	repo: string;
	branch: string;
};

type GithubContent = {
	type: 'file' | 'dir';
	name: string;
	path: string;
	sha: string;
};

type GithubBlob = { content: string; encoding: 'base64' };

let installationToken: { value: string; expiresAt: number } | null = null;

export function createGithubContentRepository(): ContentRepository {
	const config = readConfig();
	return {
		async list() {
			const entries = await listDirectory(config);
			return Promise.all(
				entries
					.filter((entry) => entry.type === 'file' && entry.name.endsWith('.md'))
					.map((entry) => readPath(config, entry.path, entry.sha))
			);
		},
		async readBySlug(slug) {
			const documents = await this.list();
			return documents.find((document) => document.page.slug === slug) ?? null;
		},
		async save(page) {
			return savePage(config, page);
		},
		async delete(id) {
			await deletePage(config, id);
		}
	};
}

function readConfig(): GithubConfig {
	const config = {
		clientId: env.GITHUB_CLIENT_ID,
		installationId: env.GITHUB_INSTALLATION_ID,
		privateKey: env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n'),
		owner: env.GITHUB_OWNER,
		repo: env.GITHUB_REPO,
		branch: env.GITHUB_BRANCH || 'main'
	};
	const missing = Object.entries(config)
		.filter(([, value]) => !value)
		.map(([key]) => key);
	if (missing.length)
		throw new Error(`GitHub content repository is not configured: ${missing.join(', ')}`);
	return config as GithubConfig;
}

async function listDirectory(config: GithubConfig): Promise<GithubContent[]> {
	const response = await githubFetch<GithubContent[] | GithubContent>(
		config,
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/content/crafts?ref=${encodeURIComponent(config.branch)}`,
		{ allowNotFound: true }
	);
	if (!response) return [];
	return Array.isArray(response) ? response : [response];
}

async function readPath(
	config: GithubConfig,
	path: string,
	knownSha?: string
): Promise<RepositoryDocument> {
	const sha = knownSha ?? (await getPathMetadata(config, path))?.sha;
	if (!sha) throw new Error(`GitHub did not return a blob SHA for ${path}`);
	const blob = await githubFetch<GithubBlob>(
		config,
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/blobs/${encodeURIComponent(sha)}`
	);
	if (!blob || blob.encoding !== 'base64' || !blob.content) {
		throw new Error(`GitHub did not return Markdown content for ${path}`);
	}
	const markdown = Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf8');
	return { page: parseRepositoryMarkdown(markdown), path, sha };
}

async function savePage(config: GithubConfig, page: NotePage): Promise<RepositoryDocument> {
	const path = repositoryPath(page.id);
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const current = await getPathMetadata(config, path);
		try {
			const result = await githubFetch<{ content: GithubContent }>(
				config,
				`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`,
				{
					method: 'PUT',
					body: {
						message: `${current ? 'Update' : 'Create'} ${page.title}`,
						content: Buffer.from(page.markdown, 'utf8').toString('base64'),
						branch: config.branch,
						...(current ? { sha: current.sha } : {})
					}
				}
			);
			if (!result) throw new Error('GitHub returned an empty save response');
			return { page, path, sha: result.content.sha };
		} catch (cause) {
			if (!(cause instanceof GithubApiError) || cause.status !== 409 || attempt > 0) throw cause;
		}
	}
	throw new Error('GitHub save failed');
}

async function deletePage(config: GithubConfig, id: string) {
	const path = repositoryPath(id);
	const current = await getPathMetadata(config, path);
	if (!current) return;
	await githubFetch(
		config,
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`,
		{
			method: 'DELETE',
			body: { message: `Delete ${id}`, sha: current.sha, branch: config.branch }
		}
	);
}

async function getPathMetadata(config: GithubConfig, path: string) {
	return githubFetch<GithubContent>(
		config,
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}?ref=${encodeURIComponent(config.branch)}`,
		{ allowNotFound: true }
	);
}

class GithubApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'GithubApiError';
	}
}

async function githubFetch<T>(
	config: GithubConfig,
	path: string,
	options: {
		method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
		body?: unknown;
		allowNotFound?: boolean;
	} = {}
): Promise<T | null> {
	const token = await getInstallationToken(config);
	const response = await fetch(`https://api.github.com${path}`, {
		method: options.method ?? 'GET',
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			...(options.body ? { 'Content-Type': 'application/json' } : {})
		},
		...(options.body ? { body: JSON.stringify(options.body) } : {})
	});
	if (response.status === 404 && options.allowNotFound) return null;
	if (!response.ok) {
		const detail = await response.text();
		throw new GithubApiError(
			response.status,
			`GitHub request failed (${response.status}): ${detail}`
		);
	}
	if (response.status === 204) return null;
	return (await response.json()) as T;
}

async function getInstallationToken(config: GithubConfig) {
	if (installationToken && installationToken.expiresAt > Date.now() + 60_000) {
		return installationToken.value;
	}
	const jwt = createAppJwt(config);
	const response = await fetch(
		`https://api.github.com/app/installations/${encodeURIComponent(config.installationId)}/access_tokens`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${jwt}`,
				'X-GitHub-Api-Version': '2022-11-28'
			}
		}
	);
	if (!response.ok)
		throw new Error(`GitHub installation authentication failed (${response.status})`);
	const payload = (await response.json()) as { token: string; expires_at: string };
	installationToken = { value: payload.token, expiresAt: Date.parse(payload.expires_at) };
	return installationToken.value;
}

function createAppJwt(config: GithubConfig) {
	const now = Math.floor(Date.now() / 1000);
	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const payload = base64url(
		JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: config.clientId })
	);
	const unsigned = `${header}.${payload}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(config.privateKey);
	return `${unsigned}.${base64url(signature)}`;
}

function base64url(value: string | Buffer) {
	return Buffer.from(value).toString('base64url');
}
