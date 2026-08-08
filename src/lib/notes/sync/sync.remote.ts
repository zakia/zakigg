import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { assertAuthUser } from '$lib/server/auth/session';
import {
	pullSince,
	pushAssetLww,
	pushPageLww,
	pushTombstoneLww,
	type PushStatus
} from '$lib/server/notes-sync/firestore';

const MAX_NOTE_BODY_LENGTH = 8_000_000;
const SafeIdSchema = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.maxLength(180),
	v.regex(/^[a-zA-Z0-9_-]+$/)
);
const MutationIdSchema = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.maxLength(180),
	v.regex(/^[a-zA-Z0-9_-]+$/)
);

const PagePayloadSchema = v.object({
	id: SafeIdSchema,
	slug: v.pipe(v.string(), v.nonEmpty(), v.maxLength(240)),
	title: v.pipe(v.string(), v.maxLength(500)),
	tags: v.pipe(v.array(v.pipe(v.string(), v.maxLength(100))), v.maxLength(200)),
	createdAt: v.pipe(v.string(), v.isoTimestamp()),
	updatedAt: v.pipe(v.string(), v.isoTimestamp()),
	mutationId: MutationIdSchema,
	contentJson: v.pipe(v.string(), v.maxLength(MAX_NOTE_BODY_LENGTH)),
	propertiesJson: v.pipe(v.string(), v.maxLength(1_000_000)),
	frontmatterJson: v.optional(v.pipe(v.string(), v.maxLength(1_000_000)))
});

const AssetPayloadSchema = v.object({
	id: SafeIdSchema,
	mediaType: v.pipe(v.string(), v.maxLength(200)),
	name: v.pipe(v.string(), v.maxLength(500)),
	size: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20_000_000)),
	pageIds: v.pipe(v.array(SafeIdSchema), v.maxLength(1_000)),
	createdAt: v.pipe(v.string(), v.isoTimestamp()),
	updatedAt: v.pipe(v.string(), v.isoTimestamp()),
	mutationId: MutationIdSchema
});

const TombstonePayloadSchema = v.object({
	id: SafeIdSchema,
	kind: v.picklist(['page', 'asset']),
	deletedAt: v.pipe(v.string(), v.isoTimestamp()),
	mutationId: MutationIdSchema
});

export type SyncPushResult = {
	results: { id: string; status: PushStatus }[];
	needsBlob: string[];
};

export const pushChanges = command(
	v.object({
		pages: v.pipe(v.array(PagePayloadSchema), v.maxLength(100)),
		assets: v.pipe(v.array(AssetPayloadSchema), v.maxLength(100)),
		tombstones: v.pipe(v.array(TombstonePayloadSchema), v.maxLength(100))
	}),
	async ({ pages, assets, tombstones }): Promise<SyncPushResult> => {
		const user = assertAuthUser(getRequestEvent().locals);
		const results: SyncPushResult['results'] = [];
		const needsBlob: string[] = [];

		for (const page of pages) {
			results.push({ id: page.id, status: await pushPageLww(user.sub, page) });
		}
		for (const asset of assets) {
			const result = await pushAssetLww(user.sub, asset);
			results.push({ id: asset.id, status: result.status });
			if (result.needsBlob) needsBlob.push(asset.id);
		}
		for (const tombstone of tombstones) {
			results.push({ id: tombstone.id, status: await pushTombstoneLww(user.sub, tombstone) });
		}

		return { results, needsBlob };
	}
);

export const pullChanges = command(
	v.object({
		since: v.nullable(v.pipe(v.string(), v.maxLength(1_000))),
		limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))
	}),
	async ({ since, limit }) => {
		const user = assertAuthUser(getRequestEvent().locals);
		return pullSince(user.sub, since, limit);
	}
);
