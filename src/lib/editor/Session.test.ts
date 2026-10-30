import { describe, expect, it, vi } from 'vitest';
import { Session } from './Session.svelte';
import { createPage } from '#lib/crafts/Page.js';
function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
function setup() {
	const page = createPage({ id: 'page_session', title: 'Session' }, 'Original');
	const save = vi.fn<(page: { id: string; markdown: string }) => Promise<void>>(async () => {});
	const session = new Session({ page, saved: true, save });
	return { page, save, session };
}
describe('explicit Save', () => {
	it('does not write while typing and saves plain Markdown on request', async () => {
		const { session, save } = setup();
		session.update('Plain Markdown');
		expect(save).not.toHaveBeenCalled();
		await session.save();
		expect(save).toHaveBeenCalledWith({ id: 'page_session', markdown: 'Plain Markdown' });
		expect(session.dirty).toBe(false);
	});
});

it('validates on Save and retains invalid source for correction', async () => {
	const { session, save } = setup();
	const source = '---\ntitle: [broken\n---\n\nBody';
	session.update(source);
	await session.save();
	expect(save).not.toHaveBeenCalled();
	expect(session.error).toContain('Line 2');
	expect(session.markdown).toBe(source);
	session.update('# Fixed');
	await session.save();
	expect(session.error).toBe('');
	expect(session.dirty).toBe(false);
});
it('keeps typing during a pending Save unsaved', async () => {
	const { session, save } = setup();
	const pending = deferred();
	save.mockImplementationOnce(() => pending.promise);
	session.update('First');
	const operation = session.save();
	await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
	session.update('Second');
	pending.resolve();
	await operation;
	expect(session.dirty).toBe(true);
	expect(session.markdown).toBe('Second');
	expect(save).toHaveBeenCalledTimes(1);
});
it('serializes explicit requests while retaining later unsaved typing', async () => {
	const { session, save } = setup();
	const pending = deferred();
	save.mockImplementationOnce(() => pending.promise);
	session.update('First');
	const first = session.save();
	await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
	session.update('Second');
	expect(session.save()).toBe(first);
	session.update('Third, not requested');
	pending.resolve();
	await first;
	expect(save.mock.calls.map(([page]) => page.markdown)).toEqual(['First', 'Second']);
	expect(session.dirty).toBe(true);
});
it('retains text after failure and retries explicitly', async () => {
	const { session, save } = setup();
	session.update('Unsaved');
	save.mockRejectedValueOnce(new Error('Disk full'));
	expect(await session.save()).toBeNull();
	expect(session.markdown).toBe('Unsaved');
	expect(session.error).toBe('Disk full');
	await session.save();
	expect(session.dirty).toBe(false);
	expect(session.status.state).toBe('saved');
});
it('recognizes undo back to the saved source without another write', async () => {
	const { session, save, page } = setup();
	session.update('Edit');
	session.update(page.markdown);
	await session.save();
	expect(save).not.toHaveBeenCalled();
	expect(session.dirty).toBe(false);
});
