export type TextOffsets = { from: number; to: number };

/** Returns the visible range that should receive a Markdown link mark. */
export function trimLinkText(text: string): TextOffsets | null {
	const leadingWhitespace = text.length - text.trimStart().length;
	const trailingWhitespace = text.length - text.trimEnd().length;
	const from = leadingWhitespace;
	const to = text.length - trailingWhitespace;
	return from < to ? { from, to } : null;
}
