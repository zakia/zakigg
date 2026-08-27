import { describe, expect, it, vi } from 'vitest';
import type { Node as ProseNode, NodeType } from '@milkdown/kit/prose/model';
import {
	createColumnSchema,
	createColumnsMarkdownNode,
	createColumnsSchema,
	normalizeColumnChildren,
	readColumnsWidths
} from './columns';
import { parseColumnWidths, serializeColumnWidths } from './column-widths';

describe('Milkdown Columns feature', () => {
	it('normalizes readable column ratios and enforces usable minimums', () => {
		expect(parseColumnWidths('62:38')).toEqual([62, 38]);
		expect(parseColumnWidths('9:1')).toEqual([80, 20]);
		expect(parseColumnWidths('invalid')).toEqual([50, 50]);
		expect(serializeColumnWidths(61.6)).toBe('62:38');
	});

	it('parses a Columns component and its nested content', () => {
		const markdownNode = createColumnsMarkdownNode('60:40', [
			{ type: 'mdxJsxFlowElement', name: 'Column', attributes: [], children: [] },
			{ type: 'mdxJsxFlowElement', name: 'Column', attributes: [], children: [] }
		]);
		const schema = createRunnerState();
		const columnsSchema = createColumnsSchema();

		expect(readColumnsWidths(markdownNode)).toBe('60:40');
		expect(columnsSchema.parseMarkdown.match(markdownNode)).toBe(true);
		columnsSchema.parseMarkdown.runner(schema as never, markdownNode, {} as NodeType);
		expect(schema.openNode).toHaveBeenCalledWith(expect.anything(), {
			widths: '60:40',
			gap: 'medium'
		});
		expect(schema.next).toHaveBeenCalledWith(markdownNode.children);
	});

	it('serializes columns and column children back to MDX containers', () => {
		const columnsState = createRunnerState();
		const columnsNode = {
			type: { name: 'columns' },
			attrs: { widths: '65:35', gap: 'large' },
			content: { size: 2 }
		} as unknown as ProseNode;

		createColumnsSchema().toMarkdown.runner(columnsState as never, columnsNode);
		expect(columnsState.openNode).toHaveBeenCalledWith('mdxJsxFlowElement', undefined, {
			name: 'Columns',
			attributes: [{ type: 'mdxJsxAttribute', name: 'gap', value: 'large' }]
		});

		const columnState = createRunnerState();
		const columnNode = {
			type: { name: 'column' },
			attrs: { width: '65' },
			content: { size: 1 }
		} as unknown as ProseNode;
		createColumnSchema().toMarkdown.runner(columnState as never, columnNode);
		expect(columnState.openNode).toHaveBeenCalledWith('mdxJsxFlowElement', undefined, {
			name: 'Column',
			attributes: [
				{
					type: 'mdxJsxAttribute',
					name: 'width',
					value: { type: 'mdxJsxAttributeValueExpression', value: '65' }
				}
			]
		});
	});

	it('ignores expression-valued widths and unrelated components', () => {
		expect(
			readColumnsWidths({
				type: 'mdxJsxFlowElement',
				name: 'Columns',
				attributes: [
					{ type: 'mdxJsxAttribute', name: 'widths', value: { value: 'window.innerWidth' } }
				]
			})
		).toBe('50:50');
		expect(readColumnsWidths({ type: 'mdxJsxFlowElement', name: 'Grid' })).toBeNull();
	});

	it('restores an empty editable paragraph from MDX empty-column markup', () => {
		expect(
			normalizeColumnChildren([
				{ type: 'mdxJsxFlowElement', name: 'br', attributes: [], children: [] }
			])
		).toEqual([{ type: 'paragraph', children: [] }]);
	});
});

function createRunnerState() {
	const state = {
		openNode: vi.fn(),
		next: vi.fn(),
		closeNode: vi.fn()
	};
	state.openNode.mockReturnValue(state);
	state.next.mockReturnValue(state);
	state.closeNode.mockReturnValue(state);
	return state;
}
