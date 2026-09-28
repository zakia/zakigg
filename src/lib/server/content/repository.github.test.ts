import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPage } from '$lib/editor/Page';
import { createGithubContentRepository } from './repository.github';

vi.mock('$env/dynamic/private', async () => {
	const { generateKeyPairSync } = await import('node:crypto');
	const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	return {
		env: {
			GITHUB_CLIENT_ID: 'test',
			GITHUB_INSTALLATION_ID: 'test',
			GITHUB_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
			GITHUB_OWNER: 'test',
			GITHUB_REPO: 'test',
			GITHUB_BRANCH: 'test'
		}
	};
});
afterEach(() => vi.unstubAllGlobals());

function server(
	currentSha: string | null,
	conflict = false,
	registry: Record<string, string> = {}
) {
	const fetch = vi.fn(async (url: string, options?: RequestInit) => {
		if (url.endsWith('/access_tokens'))
			return Response.json({ token: 'test-token', expires_at: '2099-01-01T00:00:00Z' });
		if (url.endsWith('/git/ref/heads/test')) return Response.json({ object: { sha: 'head' } });
		if (url.endsWith('/git/commits/head')) return Response.json({ tree: { sha: 'base-tree' } });
		if (url.includes('/contents/src/lib/crafts/tags.json?ref=head'))
			return Response.json({ sha: 'tags-blob' });
		if (url.endsWith('/git/blobs/tags-blob'))
			return Response.json({
				encoding: 'base64',
				content: Buffer.from(JSON.stringify(registry)).toString('base64')
			});
		if (url.includes('/contents/content/crafts/') && url.endsWith('?ref=head'))
			return currentSha ? Response.json({ sha: currentSha }) : new Response('', { status: 404 });
		if (url.endsWith('/git/trees') && options?.method === 'POST')
			return Response.json({ sha: 'new-tree' });
		if (url.endsWith('/git/commits') && options?.method === 'POST')
			return Response.json({ sha: 'new-commit' });
		if (url.endsWith('/git/refs/heads/test') && options?.method === 'PATCH')
			return conflict
				? new Response('Reference update failed', { status: 422 })
				: Response.json({ object: { sha: 'new-commit' } });
		throw new Error(`Unexpected GitHub request: ${options?.method ?? 'GET'} ${url}`);
	});
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

describe('GitHub atomic content saves', () => {
	it('rejects stale content before writing any Git objects', async () => {
		const fetch = server('newer-sha');
		await expect(createGithubContentRepository().save(createPage(), 'old-sha')).rejects.toThrow(
			'Git changed'
		);
		expect(
			fetch.mock.calls.filter(
				([url, options]) => !url.endsWith('/access_tokens') && options?.method !== 'GET'
			)
		).toHaveLength(0);
	});
	it('never retries or forces a conflicting branch update', async () => {
		const fetch = server('loaded-sha', true);
		await expect(
			createGithubContentRepository().save(createPage({ tags: ['new'] }), 'loaded-sha')
		).rejects.toThrow('Git changed');
		const updates = fetch.mock.calls.filter(([, options]) => options?.method === 'PATCH');
		expect(updates).toHaveLength(1);
		expect(JSON.parse(String(updates[0][1]?.body))).toEqual({ sha: 'new-commit', force: false });
	});
	it('commits the document and new assignments together on the loaded branch snapshot', async () => {
		const fetch = server('loaded-sha', false, { existing: 'blue', unused: 'violet' });
		const page = createPage({ published: true, tags: ['existing', 'new'] }, 'Body');
		const result = await createGithubContentRepository().save(page, 'loaded-sha');
		const body = (suffix: string) =>
			JSON.parse(
				String(
					fetch.mock.calls.find(
						([url, options]) => url.endsWith(suffix) && options?.method === 'POST'
					)?.[1]?.body
				)
			);
		expect(body('/git/trees')).toEqual({
			base_tree: 'base-tree',
			tree: [
				{
					path: `content/crafts/${page.id}.md`,
					mode: '100644',
					type: 'blob',
					content: page.markdown
				},
				{
					path: 'src/lib/crafts/tags.json',
					mode: '100644',
					type: 'blob',
					content: expect.any(String)
				}
			]
		});
		expect(JSON.parse(body('/git/trees').tree[1].content)).toEqual({
			existing: 'blue',
			unused: 'violet',
			new: 'rose'
		});
		expect(body('/git/commits')).toMatchObject({ tree: 'new-tree', parents: ['head'] });
		const { createHash } = await import('node:crypto');
		expect(result.sha).toBe(
			createHash('sha1')
				.update(`blob ${Buffer.byteLength(page.markdown)}\0${page.markdown}`)
				.digest('hex')
		);
		expect(result.tags).toEqual({ existing: 'blue', unused: 'violet', new: 'rose' });
	});
	it('leaves the registry out of the commit when all tags already have colors', async () => {
		const fetch = server(null, false, { existing: 'blue' });
		await createGithubContentRepository().save(createPage({ tags: ['existing'] }), null);
		const options = fetch.mock.calls.find(([url]) => url.endsWith('/git/trees'))?.[1];
		expect(JSON.parse(String(options?.body)).tree).toHaveLength(1);
	});
});
