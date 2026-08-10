import { command, query } from '$app/server';
import * as v from 'valibot';
import { parseStoredPage } from '$lib/notes/types';
import { auth } from '$lib/server/auth';
import {
	getNoteCraftPublication,
	publishNoteCraft as publishStoredNoteCraft,
	unpublishNoteCraft as unpublishStoredNoteCraft
} from '$lib/server/crafts/publication';

const PageIdSchema = v.pipe(v.string(), v.nonEmpty(), v.maxLength(180));

export const getCraftPublication = query(PageIdSchema, async (pageId) => {
	const { user } = auth({ required: true });
	return getNoteCraftPublication(user.id, pageId);
});

export const publishNoteCraft = command(
	v.object({ pageJson: v.pipe(v.string(), v.nonEmpty(), v.maxLength(8_000_000)) }),
	async ({ pageJson }) => {
		const { user } = auth({ required: true });
		const page = parseStoredPage(JSON.parse(pageJson));
		if (!page) throw new Error('Invalid note page');

		const published = await publishStoredNoteCraft(user.id, page);
		getCraftPublication(page.id).set(published);
		return published;
	}
);

export const unpublishNoteCraft = command(PageIdSchema, async (pageId) => {
	const { user } = auth({ required: true });
	await unpublishStoredNoteCraft(user.id, pageId);
	getCraftPublication(pageId).set(null);
});
