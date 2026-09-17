export type SaveState = 'loading' | 'saving' | 'saved' | 'error';

export type CommitStatus = 'disabled' | 'idle' | 'pending' | 'committing' | 'committed' | 'error';

export function formatSaveLabel(
	saveState: SaveState,
	lastSavedAt?: string,
	commitStatus: CommitStatus = 'disabled'
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

	if (commitStatus === 'disabled' || commitStatus === 'idle') return `${savedLabel} locally`;
	if (commitStatus === 'committing') return `${savedLabel} · Committing...`;
	if (commitStatus === 'pending') return `${savedLabel} · Git changes pending`;
	if (commitStatus === 'error') return `${savedLabel} · Git commit failed`;

	return `${savedLabel} · Committed`;
}
