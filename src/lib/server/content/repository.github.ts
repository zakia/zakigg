import {
	assignTagColors,
	readTagRegistry,
	writeTagRegistry,
	tagRegistryPath,
	type TagRegistry
} from '$lib/crafts/tags';
import { createHash, createSign } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Page } from '$lib/editor/Page';
import {
	RepositoryConflict,
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
		async tags() {
			return readTags(config);
		},
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
		async save(page, expectedSha) {
			return savePage(config, page, expectedSha);
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

async function readTags(config: GithubConfig, ref = config.branch): Promise<TagRegistry> {
	const metadata = await getPathMetadata(config, tagRegistryPath, ref);
	if (!metadata) return {};
	const blob = await githubFetch<GithubBlob>(
		config,
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/blobs/${metadata.sha}`
	);
	if (!blob || blob.encoding !== 'base64') throw new Error('GitHub did not return tag colors');
	return readTagRegistry(Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf8'));
}

async function savePage(
	config: GithubConfig,
	page: Page,
	expectedSha: string | null
): Promise<RepositoryDocument & { tags: TagRegistry }> {
	const path = repositoryPath(page.id);
	const base = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
	const branch = encodeURIComponent(config.branch);
	const head = await githubFetch<{ object: { sha: string } }>(
		config,
		`${base}/git/ref/heads/${branch}`
	);
	if (!head) throw new Error('GitHub did not return the branch head');
	const parent = head.object.sha;
	// Pin both files to one revision so the commit cannot combine inconsistent reads.
	const [current, registry, commit] = await Promise.all([
		getPathMetadata(config, path, parent),
		readTags(config, parent),
		githubFetch<{ tree: { sha: string } }>(config, `${base}/git/commits/${parent}`)
	]);
	if ((current?.sha ?? null) !== expectedSha) throw new RepositoryConflict();
	if (!commit) throw new Error('GitHub did not return the parent commit');
	const tags = assignTagColors(registry, page.tags);
	const entries = [{ path, mode: '100644', type: 'blob', content: page.markdown }];
	if (writeTagRegistry(tags) !== writeTagRegistry(registry)) {
		entries.push({
			path: tagRegistryPath,
			mode: '100644',
			type: 'blob',
			content: writeTagRegistry(tags)
		});
	}
	const tree = await githubFetch<{ sha: string }>(config, `${base}/git/trees`, {
		method: 'POST',
		body: { base_tree: commit.tree.sha, tree: entries }
	});
	if (!tree) throw new Error('GitHub did not return the saved tree');
	const saved = await githubFetch<{ sha: string }>(config, `${base}/git/commits`, {
		method: 'POST',
		body: {
			message: `${current ? 'Update' : 'Create'} ${page.title}`,
			tree: tree.sha,
			parents: [parent]
		}
	});
	if (!saved) throw new Error('GitHub did not return the saved commit');
	try {
		await githubFetch(config, `${base}/git/refs/heads/${branch}`, {
			method: 'PATCH',
			body: { sha: saved.sha, force: false }
		});
	} catch (cause) {
		// A moved branch rejects this commit, including its registry update. Never force or retry.
		if (cause instanceof GithubApiError && [409, 422].includes(cause.status))
			throw new RepositoryConflict();
		throw cause;
	}
	const content = Buffer.from(page.markdown, 'utf8');
	const sha = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
	return { page, path, sha, tags };
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

async function getPathMetadata(config: GithubConfig, path: string, ref = config.branch) {
	return githubFetch<GithubContent>(
		config,
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}?ref=${encodeURIComponent(ref)}`,
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
		method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE';
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
