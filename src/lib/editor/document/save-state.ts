export type SaveState = 'loading' | 'saving' | 'saved' | 'error';

export type SyncLabelStatus = 'disabled' | 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

export function formatSaveLabel(
	saveState: SaveState,
	lastSavedAt?: string,
	syncStatus: SyncLabelStatus = 'disabled'
) {
	if (saveState === 'loading') return 'Loading';
	if (saveState === 'saving') return 'Saving...';
	if (saveState === 'error') return 'Save failed';

	const savedLabel = lastSavedAt
		? `Saved ${new Intl.DateTimeFormat(undefined, {
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date(lastSavedAt))}`
		: 'Saved';

	if (syncStatus === 'disabled' || syncStatus === 'idle') return `${savedLabel} locally`;
	if (syncStatus === 'syncing') return `${savedLabel} · Syncing...`;
	if (syncStatus === 'pending') return `${savedLabel} · Sync pending`;
	if (syncStatus === 'error') return `${savedLabel} · Sync error`;

	return `${savedLabel} · Synced`;
}
