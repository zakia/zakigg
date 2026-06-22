import { Extension, mergeAttributes, Node, type Editor, type JSONContent } from '@tiptap/core';
import {
	addColumnAfter,
	addRowAfter,
	deleteTable,
	goToNextCell,
	isInTable,
	tableEditing
} from 'prosemirror-tables';
import type { Command } from '@tiptap/pm/state';

const TABLE_CELL_ATTRS = {
	colspan: {
		default: 1,
		parseHTML: (element: HTMLElement) => Number(element.getAttribute('colspan') || 1),
		renderHTML: (attrs: Record<string, unknown>) =>
			Number(attrs.colspan ?? 1) === 1 ? {} : { colspan: attrs.colspan }
	},
	rowspan: {
		default: 1,
		parseHTML: (element: HTMLElement) => Number(element.getAttribute('rowspan') || 1),
		renderHTML: (attrs: Record<string, unknown>) =>
			Number(attrs.rowspan ?? 1) === 1 ? {} : { rowspan: attrs.rowspan }
	},
	colwidth: {
		default: null,
		parseHTML: parseColwidth,
		renderHTML: (attrs: Record<string, unknown>) =>
			Array.isArray(attrs.colwidth) && attrs.colwidth.length
				? { 'data-colwidth': attrs.colwidth.join(',') }
				: {}
	}
};

const TABLE_ROLES = {
	table: 'table',
	table_row: 'row',
	table_cell: 'cell',
	table_header: 'header_cell'
} as const;

export const Table = Node.create({
	name: 'table',
	group: 'block',
	content: 'table_row+',
	isolating: true,

	parseHTML() {
		return [{ tag: 'table' }];
	},

	renderHTML() {
		return ['table', ['tbody', 0]];
	}
});

export const TableRow = Node.create({
	name: 'table_row',
	content: '(table_cell | table_header)*',

	parseHTML() {
		return [{ tag: 'tr' }];
	},

	renderHTML() {
		return ['tr', 0];
	}
});

export const TableCell = Node.create({
	name: 'table_cell',
	content: 'block+',
	isolating: true,

	addAttributes() {
		return TABLE_CELL_ATTRS;
	},

	parseHTML() {
		return [{ tag: 'td' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['td', mergeAttributes(HTMLAttributes), 0];
	}
});

export const TableHeader = Node.create({
	name: 'table_header',
	content: 'block+',
	isolating: true,

	addAttributes() {
		return TABLE_CELL_ATTRS;
	},

	parseHTML() {
		return [{ tag: 'th' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['th', mergeAttributes(HTMLAttributes), 0];
	}
});

export const TableKit = Extension.create({
	name: 'tableKit',

	extendNodeSchema(extension) {
		const role = TABLE_ROLES[extension.name as keyof typeof TABLE_ROLES];
		return role ? { tableRole: role } : {};
	},

	addKeyboardShortcuts() {
		return {
			Tab: () => runTableCommand(this.editor, goToNextCell(1)),
			'Shift-Tab': () => runTableCommand(this.editor, goToNextCell(-1))
		};
	},

	addProseMirrorPlugins() {
		return [tableEditing({ allowTableNodeSelection: true })];
	}
});

export function insertTable(editor: Editor, rows = 3, cols = 2) {
	const content = createTableContent(rows, cols);
	editor.chain().focus().insertContent(content).run();
}

export function addTableRowAfter(editor: Editor) {
	return runTableCommand(editor, addRowAfter);
}

export function addTableColumnAfter(editor: Editor) {
	return runTableCommand(editor, addColumnAfter);
}

export function removeTable(editor: Editor) {
	return runTableCommand(editor, deleteTable);
}

export function canAddTableRowAfter(editor: Editor) {
	return canRunTableCommand(editor, addRowAfter);
}

export function canAddTableColumnAfter(editor: Editor) {
	return canRunTableCommand(editor, addColumnAfter);
}

export function canRemoveTable(editor: Editor) {
	return canRunTableCommand(editor, deleteTable);
}

export function editorIsInTable(editor: Editor) {
	return isInTable(editor.state);
}

function createTableContent(rows: number, cols: number): JSONContent {
	const rowCount = Math.max(1, rows);
	const colCount = Math.max(1, cols);

	return {
		type: 'table',
		content: Array.from({ length: rowCount }, (_, rowIndex) => ({
			type: 'table_row',
			content: Array.from({ length: colCount }, () => ({
				type: rowIndex === 0 ? 'table_header' : 'table_cell',
				attrs: createCellAttrs(),
				content: [{ type: 'paragraph' }]
			}))
		}))
	};
}

function createCellAttrs() {
	return {
		colspan: 1,
		rowspan: 1,
		colwidth: null
	};
}

function runTableCommand(editor: Editor, command: Command) {
	editor.view.focus();
	return command(editor.state, editor.view.dispatch);
}

function canRunTableCommand(editor: Editor, command: Command) {
	return command(editor.state);
}

function parseColwidth(element: HTMLElement) {
	const widthAttr = element.getAttribute('data-colwidth');
	const colspan = Number(element.getAttribute('colspan') || 1);
	const widths = widthAttr?.match(/^\d+(,\d+)*$/)
		? widthAttr.split(',').map((value) => Number(value))
		: null;

	return widths?.length === colspan ? widths : null;
}
