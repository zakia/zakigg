import { mount, unmount } from 'svelte';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import { paragraphSchema } from '@milkdown/kit/preset/commonmark';
import type { NodeSchema } from '@milkdown/kit/transformer';
import { $command, $node, $view } from '@milkdown/kit/utils';
import ColumnsView from './ColumnsView.svelte';
import { DEFAULT_COLUMN_WIDTHS, parseColumnWidths } from './column-widths';
import { ColumnsViewState } from './columns-view-state.svelte';
import { readAttribute, readStringAttribute, type MarkdownAstNode, type MdxAttribute } from './mdx';

function isMdxComponent(node: MarkdownAstNode, name: string) {
	return node.type === 'mdxJsxFlowElement' && node.name === name;
}

export function normalizeColumnChildren(children: MarkdownAstNode[] = []) {
	return children.map((child) =>
		isMdxComponent(child, 'br') ? { type: 'paragraph', children: [] } : child
	);
}

export function readColumnsWidths(node: MarkdownAstNode) {
	if (!isMdxComponent(node, 'Columns')) return null;
	const legacyValue = readStringAttribute(node, 'widths');
	const columnWidths = (node.children ?? [])
		.filter((child) => isMdxComponent(child, 'Column'))
		.map((child) => Number(readAttribute(child, 'width')));
	const value =
		legacyValue ??
		(columnWidths.length === 2 && columnWidths.every(Number.isFinite)
			? `${columnWidths[0]}:${columnWidths[1]}`
			: DEFAULT_COLUMN_WIDTHS);
	const [left, right] = parseColumnWidths(value);
	return `${left}:${right}`;
}

export function readColumnsGap(node: MarkdownAstNode) {
	if (!isMdxComponent(node, 'Columns')) return null;
	const gap = readStringAttribute(node, 'gap');
	return ['small', 'medium', 'large'].includes(gap ?? '') ? gap : 'medium';
}

export function createColumnsMarkdownNode(
	widths: string,
	children: MarkdownAstNode[] = [],
	gap = 'medium'
) {
	const [left, right] = parseColumnWidths(widths);
	const normalizedChildren = children.map((child, index) =>
		isMdxComponent(child, 'Column')
			? {
					...child,
					attributes: [
						...(child.attributes ?? []).filter((attribute) => attribute.name !== 'width'),
						createNumberAttribute('width', index === 0 ? left : right)
					]
				}
			: child
	);

	return {
		type: 'mdxJsxFlowElement',
		name: 'Columns',
		attributes: [{ type: 'mdxJsxAttribute', name: 'gap', value: gap }],
		children: normalizedChildren
	};
}

export function createColumnsSchema(): NodeSchema {
	return {
		group: 'block',
		content: 'column column',
		defining: true,
		isolating: true,
		selectable: true,
		attrs: {
			widths: { default: DEFAULT_COLUMN_WIDTHS, validate: 'string' },
			gap: { default: 'medium', validate: 'string' }
		},
		parseDOM: [
			{
				tag: '[data-columns]',
				getAttrs: (dom) => ({
					widths:
						dom instanceof HTMLElement
							? (dom.dataset.columnWidths ?? DEFAULT_COLUMN_WIDTHS)
							: DEFAULT_COLUMN_WIDTHS,
					gap: dom instanceof HTMLElement ? (dom.dataset.columnGap ?? 'medium') : 'medium'
				})
			}
		],
		toDOM: (node) => [
			'div',
			{
				'data-columns': '',
				'data-column-widths': String(node.attrs.widths),
				'data-column-gap': String(node.attrs.gap)
			},
			0
		],
		parseMarkdown: {
			match: (node) => readColumnsWidths(node as MarkdownAstNode) !== null,
			runner: (state, node, type) => {
				const widths = readColumnsWidths(node as MarkdownAstNode) ?? DEFAULT_COLUMN_WIDTHS;
				const gap = readColumnsGap(node as MarkdownAstNode) ?? 'medium';
				state.openNode(type, { widths, gap }).next(node.children).closeNode();
			}
		},
		toMarkdown: {
			match: (node) => node.type.name === 'columns',
			runner: (state, node) => {
				const markdownNode = createColumnsMarkdownNode(
					String(node.attrs.widths),
					[],
					String(node.attrs.gap ?? 'medium')
				);
				state
					.openNode(markdownNode.type, undefined, {
						name: markdownNode.name,
						attributes: markdownNode.attributes
					})
					.next(node.content)
					.closeNode();
			}
		}
	};
}

export function createColumnSchema(): NodeSchema {
	return {
		group: 'column',
		content: 'block+',
		defining: true,
		attrs: { width: { default: '50', validate: 'string' } },
		parseDOM: [{ tag: '[data-column]' }],
		toDOM: () => ['section', { 'data-column': '' }, 0],
		parseMarkdown: {
			match: (node) => isMdxComponent(node as MarkdownAstNode, 'Column'),
			runner: (state, node, type) => {
				const width = Number(readAttribute(node as MarkdownAstNode, 'width'));
				state
					.openNode(type, { width: Number.isFinite(width) ? String(width) : '50' })
					.next(normalizeColumnChildren(node.children as MarkdownAstNode[] | undefined))
					.closeNode();
			}
		},
		toMarkdown: {
			match: (node) => node.type.name === 'column',
			runner: (state, node) => {
				const width = Number(node.attrs.width);
				state
					.openNode('mdxJsxFlowElement', undefined, {
						name: 'Column',
						attributes: [createNumberAttribute('width', Number.isFinite(width) ? width : 50)]
					})
					.next(node.content)
					.closeNode();
			}
		}
	};
}

export const columnsNode = $node('columns', createColumnsSchema);
export const columnNode = $node('column', createColumnSchema);

export const insertColumnsCommand = $command<void, 'InsertColumns'>(
	'InsertColumns',
	(ctx) => () => (state, dispatch) => {
		const paragraph = paragraphSchema.type(ctx).createAndFill();
		if (!paragraph) return false;

		const columnType = columnNode.type(ctx);
		const columns = columnsNode
			.type(ctx)
			.create({ widths: DEFAULT_COLUMN_WIDTHS }, [
				columnType.create({ width: '50' }, paragraph),
				columnType.create({ width: '50' }, paragraph)
			]);
		if (!dispatch) return true;

		const from = state.selection.from;
		let transaction = state.tr.replaceSelectionWith(columns);
		const nextPosition = Math.min(transaction.doc.content.size, from + 2);
		transaction = transaction.setSelection(
			TextSelection.near(transaction.doc.resolve(nextPosition))
		);
		dispatch(transaction.scrollIntoView());
		return true;
	}
);

function createColumnsNodeView(): NodeViewConstructor {
	return (node: ProseNode, editorView, getPos): NodeView => {
		const dom = document.createElement('div');
		dom.className = 'milkdown-columns-node';
		dom.dataset.columns = '';
		dom.dataset.columnWidths = String(node.attrs.widths);
		dom.dataset.columnGap = String(node.attrs.gap);

		const shell = document.createElement('div');
		shell.className = 'columns-shell';
		const contentDOM = document.createElement('div');
		contentDOM.className = 'columns-content';
		shell.append(contentDOM);
		dom.append(shell);

		const viewState = new ColumnsViewState(String(node.attrs.widths));
		const component = mount(ColumnsView, {
			target: shell,
			props: {
				contentDOM,
				shell,
				viewState,
				onCommit: (widths: string) => {
					const position = getPos();
					if (typeof position !== 'number') return;
					const currentNode = editorView.state.doc.nodeAt(position);
					if (
						!currentNode ||
						currentNode.type.name !== 'columns' ||
						currentNode.attrs.widths === widths
					)
						return;

					const [left, right] = parseColumnWidths(widths);
					const firstColumnPosition = position + 1;
					const secondColumnPosition = firstColumnPosition + currentNode.child(0).nodeSize;
					const transaction = editorView.state.tr.setNodeMarkup(position, undefined, {
						...currentNode.attrs,
						widths
					});
					transaction.setNodeMarkup(firstColumnPosition, undefined, {
						...currentNode.child(0).attrs,
						width: String(left)
					});
					transaction.setNodeMarkup(secondColumnPosition, undefined, {
						...currentNode.child(1).attrs,
						width: String(right)
					});
					editorView.dispatch(transaction);
				}
			}
		});

		return {
			dom,
			contentDOM,
			update: (nextNode: ProseNode) => {
				if (nextNode.type.name !== 'columns') return false;
				viewState.value = String(nextNode.attrs.widths);
				dom.dataset.columnWidths = viewState.value;
				dom.dataset.columnGap = String(nextNode.attrs.gap);
				return true;
			},
			selectNode: () => dom.classList.add('is-selected'),
			deselectNode: () => dom.classList.remove('is-selected'),
			stopEvent: (event) =>
				event.target instanceof Element && Boolean(event.target.closest('.columns-divider')),
			ignoreMutation: (mutation) => {
				if (mutation.type === 'selection') return false;
				if (mutation.type === 'attributes' && mutation.target === contentDOM) return true;
				return mutation.target !== contentDOM && !contentDOM.contains(mutation.target);
			},
			destroy: () => {
				void unmount(component);
				dom.remove();
			}
		};
	};
}

export const columnsView = $view(columnsNode, createColumnsNodeView);

export const columnsFeature = [columnsNode, columnNode, insertColumnsCommand, columnsView];

function createNumberAttribute(name: string, value: number): MdxAttribute {
	return {
		type: 'mdxJsxAttribute',
		name,
		value: { type: 'mdxJsxAttributeValueExpression', value: JSON.stringify(value) }
	};
}
