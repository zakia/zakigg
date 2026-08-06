import { command, getRequestEvent, query } from '$app/server';
import * as v from 'valibot';
import {
	SESSION_COOKIE_NAME,
	SESSION_TTL_SECONDS,
	assertSyncUser,
	createSessionCookieValue,
	verifyGoogleCredential
} from '$lib/server/notes-sync/auth';
import {
	pullSince,
	pushAssetLww,
	pushPageLww,
	pushTombstoneLww,
	type PushStatus
} from '$lib/server/notes-sync/firestore';

// Firestore docs are capped at 1 MiB; leave headroom for the other fields.
const MAX_CONTENT_JSON_LENGTH = 900_000;

const PagePayloadSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty()),
	slug: v.pipe(v.string(), v.nonEmpty()),
	title: v.string(),
	tags: v.array(v.string()),
	createdAt: v.pipe(v.string(), v.isoTimestamp()),
	updatedAt: v.pipe(v.string(), v.isoTimestamp()),
	contentJson: v.pipe(v.string(), v.maxLength(MAX_CONTENT_JSON_LENGTH)),
	frontmatterJson: v.optional(v.string())
});

const AssetPayloadSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty()),
	mediaType: v.string(),
	name: v.string(),
	size: v.number(),
	pageIds: v.array(v.string()),
	createdAt: v.pipe(v.string(), v.isoTimestamp()),
	updatedAt: v.pipe(v.string(), v.isoTimestamp())
});

const TombstonePayloadSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty()),
	kind: v.picklist(['page', 'asset']),
	deletedAt: v.pipe(v.string(), v.isoTimestamp())
});

export type SyncPushResult = {
	results: { id: string; status: PushStatus }[];
	needsBlob: string[];
};

export const getSyncUser = query(async () => {
	const { locals } = getRequestEvent();

	return locals.syncUser;
});

export const signIn = command(
	v.object({ credential: v.pipe(v.string(), v.nonEmpty()) }),
	async ({ credential }) => {
		const event = getRequestEvent();
		const email = await verifyGoogleCredential(credential);

		event.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(email), {
			path: '/',
			httpOnly: true,
			secure: !event.url.hostname.includes('localhost'),
			sameSite: 'lax',
			maxAge: SESSION_TTL_SECONDS
		});

		return { email };
	}
);

export const signOut = command(async () => {
	const event = getRequestEvent();

	event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });

	return null;
});

export const pushChanges = command(
	v.object({
		pages: v.array(PagePayloadSchema),
		assets: v.array(AssetPayloadSchema),
		tombstones: v.array(TombstonePayloadSchema)
	}),
	async ({ pages, assets, tombstones }): Promise<SyncPushResult> => {
		assertSyncUser(getRequestEvent().locals);

		const results: SyncPushResult['results'] = [];
		const needsBlob: string[] = [];

		for (const page of pages) {
			results.push({ id: page.id, status: await pushPageLww(page) });
		}

		for (const asset of assets) {
			const { status, needsBlob: missing } = await pushAssetLww(asset);
			results.push({ id: asset.id, status });
			if (missing) needsBlob.push(asset.id);
		}

		for (const tombstone of tombstones) {
			results.push({ id: tombstone.id, status: await pushTombstoneLww(tombstone) });
		}

		return { results, needsBlob };
	}
);

export const pullChanges = command(
	v.object({
		since: v.nullable(v.string()),
		limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500))
	}),
	async ({ since, limit }) => {
		assertSyncUser(getRequestEvent().locals);

		return pullSince(since, limit);
	}
);
