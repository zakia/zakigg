export type SaveState = 'loading' | 'saving' | 'saved' | 'error';

export function formatSaveLabel(saveState: SaveState, lastSavedAt?: string) {
	if (saveState === 'loading') return 'Loading';
	if (saveState === 'saving') return 'Saving...';
	if (saveState === 'error') return 'Save failed';
	if (!lastSavedAt) return 'Saved locally';

	return `Saved locally ${new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(lastSavedAt))}`;
}
