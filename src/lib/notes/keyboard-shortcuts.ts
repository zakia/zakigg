export type ShortcutKey = 'Alt' | 'B' | 'E' | 'I' | 'K' | 'Mod' | 'S' | 'Shift' | '/' | 'Tab';

export type EditorShortcutId =
	| 'bold'
	| 'inlineCode'
	| 'italic'
	| 'link'
	| 'listIndent'
	| 'listOutdent'
	| 'openShortcuts'
	| 'strike'
	| 'tableNextCell'
	| 'tablePreviousCell';

export type EditorShortcut = {
	id: EditorShortcutId;
	title: string;
	description?: string;
	icon: string;
	keys: ShortcutKey[];
};

export type EditorShortcutGroup = {
	title: string;
	shortcuts: EditorShortcut[];
};

export const EDITOR_SHORTCUT_GROUPS: EditorShortcutGroup[] = [
	{
		title: 'General',
		shortcuts: [
			{
				id: 'openShortcuts',
				title: 'Keyboard Shortcuts',
				description: 'Open this panel',
				icon: 'mdi:keyboard-outline',
				keys: ['Mod', '/']
			}
		]
	},
	{
		title: 'Formatting',
		shortcuts: [
			{
				id: 'bold',
				title: 'Bold',
				icon: 'mdi:format-bold',
				keys: ['Mod', 'B']
			},
			{
				id: 'italic',
				title: 'Italic',
				icon: 'mdi:format-italic',
				keys: ['Mod', 'I']
			},
			{
				id: 'strike',
				title: 'Strikethrough',
				icon: 'mdi:format-strikethrough',
				keys: ['Mod', 'Shift', 'S']
			},
			{
				id: 'inlineCode',
				title: 'Inline Code',
				icon: 'mdi:code-tags',
				keys: ['Mod', 'E']
			},
			{
				id: 'link',
				title: 'Link',
				icon: 'mdi:link-variant',
				keys: ['Mod', 'K']
			}
		]
	},
	{
		title: 'Lists',
		shortcuts: [
			{
				id: 'listIndent',
				title: 'Indent List Item',
				description: 'Use the toolbar on phone keyboards',
				icon: 'mdi:format-indent-increase',
				keys: ['Tab']
			},
			{
				id: 'listOutdent',
				title: 'Outdent List Item',
				description: 'Use the toolbar on phone keyboards',
				icon: 'mdi:format-indent-decrease',
				keys: ['Shift', 'Tab']
			}
		]
	},
	{
		title: 'Tables',
		shortcuts: [
			{
				id: 'tableNextCell',
				title: 'Next Cell',
				icon: 'mdi:table-arrow-right',
				keys: ['Tab']
			},
			{
				id: 'tablePreviousCell',
				title: 'Previous Cell',
				icon: 'mdi:table-arrow-left',
				keys: ['Shift', 'Tab']
			}
		]
	}
];

const EDITOR_SHORTCUTS = new Map(
	EDITOR_SHORTCUT_GROUPS.flatMap((group) => group.shortcuts).map((shortcut) => [
		shortcut.id,
		shortcut
	])
);

export function getEditorShortcut(id: EditorShortcutId | undefined) {
	return id ? EDITOR_SHORTCUTS.get(id) : undefined;
}

export function isAppleShortcutPlatform() {
	if (typeof navigator === 'undefined') return false;

	return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function formatShortcut(keys: ShortcutKey[], useAppleKeys = false) {
	return keys.map((key) => formatShortcutKey(key, useAppleKeys)).join(useAppleKeys ? '' : '+');
}

export function formatShortcutKey(key: ShortcutKey, useAppleKeys = false) {
	if (key === 'Mod') return useAppleKeys ? '⌘' : 'Ctrl';
	if (key === 'Shift') return useAppleKeys ? '⇧' : 'Shift';
	if (key === 'Alt') return useAppleKeys ? '⌥' : 'Alt';

	return key;
}

export function shortcutTitle(
	title: string,
	shortcut: EditorShortcut | undefined,
	useAppleKeys = false
) {
	if (!shortcut) return title;

	return `${title} (${formatShortcut(shortcut.keys, useAppleKeys)})`;
}

export function isOpenShortcutsShortcut(event: KeyboardEvent) {
	return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === '/';
}
