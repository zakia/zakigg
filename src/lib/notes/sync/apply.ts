import {
	applyRemoteAssetMeta,
	applyRemoteDelete,
	applyRemotePage,
	getAvailablePageSlug,
	getSyncStateRow,
	getSyncTombstone,
	loadNoteAsset,
	loadNotePageById
} from '../storage';
import {
	payloadToAssetMeta,
	payloadToPage,
	remoteWins,
	type RemoteAssetDoc,
	type RemotePageDoc,
	type RemoteTombstoneDoc
} from './protocol';

export type PullBatch = {
	pages: RemotePageDoc[];
	assets: RemoteAssetDoc[];
	tombstones: RemoteTombstoneDoc[];
};

export async function applyPullBatch(
	batch: PullBatch,
	downloadBlob: (assetId: string) => Promise<Blob | null>
): Promise<void> {
	for (const doc of batch.pages) await applyPulledPage(doc);
	for (const doc of batch.assets) await applyPulledAsset(doc, downloadBlob);
	for (const tombstone of batch.tombstones) await applyPulledTombstone(tombstone);
}

async function applyPulledPage(doc: RemotePageDoc): Promise<void> {
	const incoming = payloadToPage(doc);
	if (!incoming) return;

	if (!(await remoteRecordWins(incoming.id, incoming.updatedAt, 'page'))) return;

	// A remote slug may collide with a *different* local page on the unique
	// by-slug index; dedupe before writing. The rename stays local-only (the
	// deduped copy pushes as stale) which is fine — slugs only need to be
	// unique locally, and the next real edit re-derives and converges them.
	const slug = await getAvailablePageSlug(incoming.slug, incoming.id);

	await applyRemotePage({ ...incoming, slug });
}

async function applyPulledAsset(
	doc: RemoteAssetDoc,
	downloadBlob: (assetId: string) => Promise<Blob | null>
): Promise<void> {
	if (!(await remoteRecordWins(doc.id, doc.updatedAt, 'asset'))) return;

	const local = await loadNoteAsset(doc.id);
	let blob: Blob | undefined;

	if (!local) {
		// Blob not uploaded yet by the other device; the meta re-arrives on a
		// later pull (its syncedAt advances when blobUploaded flips).
		if (!doc.blobUploaded) return;

		const downloaded = await downloadBlob(doc.id);
		if (!downloaded) return;
		blob = downloaded;
	}

	await applyRemoteAssetMeta(payloadToAssetMeta(doc), blob);
}

async function applyPulledTombstone(tombstone: RemoteTombstoneDoc): Promise<void> {
	const local =
		tombstone.kind === 'page'
			? await loadNotePageById(tombstone.id)
			: await loadNoteAsset(tombstone.id);

	if (local) {
		const state = await getSyncStateRow(tombstone.id);
		// A dirty local edit newer than the delete survives; the next push
		// resurrects the record (symmetric with the server-side rule).
		if (state?.dirty && Date.parse(local.updatedAt) > Date.parse(tombstone.deletedAt)) return;
	}

	// Also clears any matching local tombstone — the server already has it.
	await applyRemoteDelete(tombstone.id, tombstone.kind);
}

// Shared LWW gate for pulled records: apply unless a dirty local copy or a
// local tombstone is newer than the remote version.
async function remoteRecordWins(
	id: string,
	remoteUpdatedAt: string,
	kind: 'page' | 'asset'
): Promise<boolean> {
	const local = kind === 'page' ? await loadNotePageById(id) : await loadNoteAsset(id);

	if (local) {
		const state = await getSyncStateRow(id);
		if (!state?.dirty) return true;

		return remoteWins(remoteUpdatedAt, id, local.updatedAt, id);
	}

	const tombstone = await getSyncTombstone(id);
	if (tombstone && Date.parse(tombstone.deletedAt) >= Date.parse(remoteUpdatedAt)) return false;

	return true;
}
