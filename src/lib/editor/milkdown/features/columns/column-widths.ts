export const MIN_COLUMN_WIDTH = 20;
export const DEFAULT_COLUMN_WIDTHS = '50:50';

export function clampColumnWidth(value: number) {
	return Math.min(100 - MIN_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, value));
}

export function parseColumnWidths(value: unknown): [number, number] {
	if (typeof value !== 'string') return [50, 50];

	const [leftValue, rightValue, ...rest] = value.split(':').map(Number);
	if (rest.length || !Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
		return [50, 50];
	}

	const total = leftValue + rightValue;
	if (total <= 0) return [50, 50];

	const left = clampColumnWidth(Math.round((leftValue / total) * 100));
	return [left, 100 - left];
}

export function serializeColumnWidths(left: number) {
	const normalizedLeft = Math.round(clampColumnWidth(left));
	return `${normalizedLeft}:${100 - normalizedLeft}`;
}
