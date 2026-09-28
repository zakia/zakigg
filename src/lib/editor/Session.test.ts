import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from './Session.svelte';
import { createPage, type Page } from './Page';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
const sessions: Session[] = [];
function setup(saved = true) {
	const page = createPage({ id: 'page_session', title: 'Session' }, 'Original');
	const backup = vi.fn(async (page: Page) => page);
	const save = vi.fn<(page: Page) => Promise<unknown>>(async () => undefined);
	const session = new Session({ page, saved, backup, save });
	sessions.push(session);
	return { page, backup, save, session };
}
beforeEach(() => {
	vi.stubGlobal('window', globalThis);
	vi.useFakeTimers();
});
afterEach(() => {
	sessions.splice(0).forEach((session) => session.destroy());
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('save lifecycle', () => {
	it('reserves a save before the browser backup and shares concurrent requests', async () => {
		const { page, session, backup, save } = setup(false);
		const pending = deferred<Page>();
		backup.mockReturnValueOnce(pending.promise);
		const first = session.save();
		expect(session.save()).toBe(first);
		expect(session.saving).toBe(true);
		await Promise.resolve();
		expect(save).not.toHaveBeenCalled();
		pending.resolve(page);
		await first;
		expect(save).toHaveBeenCalledTimes(1);
		expect(session.dirty).toBe(false);
	});

	it('keeps typing during a Git save dirty and commits it on the next save', async () => {
		const { session, save } = setup();
		const pending = deferred<unknown>();
		save.mockReturnValueOnce(pending.promise);
		session.update(session.markdown + '\nFirst');
		const firstSource = session.markdown;
		const first = session.save();
		await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		session.update(session.markdown + '\nSecond');
		expect(session.save()).toBe(first);
		pending.resolve(undefined);
		await first;
		expect(save.mock.calls[0][0].markdown).toBe(firstSource);
		expect(session.dirty).toBe(true);
		expect(session.status.label).not.toBe('Saved to Git');
		await session.save();
		expect(save.mock.calls[1][0].markdown).toBe(session.markdown);
		expect(session.status.label).toBe('Saved to Git');
	});

	it('serializes local writes and never reports newer text backed up early', async () => {
		const { session, backup } = setup();
		const pending = deferred<Page>();
		backup.mockReturnValueOnce(pending.promise);
		session.update(session.markdown + '\nFirst');
		const page = session.page;
		const first = session.backup();
		session.update(session.markdown + '\nSecond');
		const second = session.backup();
		await Promise.resolve();
		expect(backup).toHaveBeenCalledTimes(1);
		expect(session.backupPending).toBe(true);
		pending.resolve(page);
		await first;
		await second;
		expect(backup.mock.calls[1][0].markdown).toBe(session.markdown);
		expect(session.backupPending).toBe(false);
	});

	it('preserves text on Git failure and allows retry', async () => {
		const { session, save } = setup(false);
		save.mockRejectedValueOnce(new Error('Git changed. Reload to review.'));
		expect(await session.save()).toBeNull();
		expect(session.error).toContain('Git changed');
		expect(session.dirty).toBe(true);
		await session.save();
		expect(session.error).toBe('');
		expect(session.dirty).toBe(false);
	});

	it('backs up incomplete YAML but prevents invalid or changed IDs from being committed', async () => {
		const { session, save, backup } = setup();
		session.update('---\ntitle: [broken\n---\n');
		await session.backup();
		await session.save();
		expect(backup.mock.calls[0][0].markdown).toBe(session.markdown);
		expect(save).not.toHaveBeenCalled();
		session.update(createPage({ id: 'page_other' }).markdown);
		await session.save();
		expect(session.error).toContain('id must match');
		expect(save).not.toHaveBeenCalled();
	});

	it('can save to Git when browser persistence fails', async () => {
		const { session, backup, save } = setup(false);
		backup.mockRejectedValueOnce(new Error('Quota exceeded'));
		await session.save();
		expect(save).toHaveBeenCalledTimes(1);
		expect(session.dirty).toBe(false);
		expect(session.backupError).toBe(true);
	});

	it('recognizes undo back to the Git version and avoids an empty commit', async () => {
		const { session, page, save } = setup();
		session.update(page.markdown + 'Edit');
		session.update(page.markdown);
		await session.save();
		expect(session.dirty).toBe(false);
		expect(save).not.toHaveBeenCalled();
	});
});
