import { command } from '$app/server';
import * as v from 'valibot';
import { auth } from '$lib/server/auth';
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

const PagePayloadSchema = v.pipe(
	v.object({
		id: SafeIdSchema,
		slug: v.pipe(v.string(), v.nonEmpty(), v.maxLength(240)),
		title: v.pipe(v.string(), v.maxLength(500)),
		tags: v.pipe(v.array(v.pipe(v.string(), v.maxLength(100))), v.maxLength(200)),
		createdAt: v.pipe(v.string(), v.isoTimestamp()),
		updatedAt: v.pipe(v.string(), v.isoTimestamp()),
		mutationId: MutationIdSchema,
		markdown: v.optional(v.pipe(v.string(), v.maxLength(MAX_NOTE_BODY_LENGTH))),
		contentJson: v.optional(v.pipe(v.string(), v.maxLength(MAX_NOTE_BODY_LENGTH))),
		propertiesJson: v.optional(v.pipe(v.string(), v.maxLength(1_000_000))),
		frontmatterJson: v.optional(v.pipe(v.string(), v.maxLength(1_000_000)))
	}),
	v.check(
		(page) => typeof page.markdown === 'string' || typeof page.contentJson === 'string',
		'A page body is required.'
	)
);

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
		const { user } = auth({ required: true });
		const results: SyncPushResult['results'] = [];
		const needsBlob: string[] = [];

		for (const page of pages) {
			results.push({ id: page.id, status: await pushPageLww(user.id, page) });
		}
		for (const asset of assets) {
			const result = await pushAssetLww(user.id, asset);
			results.push({ id: asset.id, status: result.status });
			if (result.needsBlob) needsBlob.push(asset.id);
		}
		for (const tombstone of tombstones) {
			results.push({ id: tombstone.id, status: await pushTombstoneLww(user.id, tombstone) });
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
		const { user } = auth({ required: true });
		return pullSince(user.id, since, limit);
	}
);
