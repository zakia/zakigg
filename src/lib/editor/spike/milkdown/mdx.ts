export type MdxAttribute = {
	type: string;
	name?: string;
	value?: string | null | { type?: string; value?: string };
};

export type MarkdownAstNode = {
	type: string;
	name?: string | null;
	value?: string | null;
	attributes?: MdxAttribute[];
	children?: MarkdownAstNode[];
};

export function readStringAttribute(node: MarkdownAstNode, name: string) {
	const value = readAttribute(node, name);

	return typeof value === 'string' ? value : null;
}

export function readAttribute(node: MarkdownAstNode, name: string): unknown {
	const value = node.attributes?.find(
		(attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === name
	)?.value;

	if (value == null) return value === null ? true : null;
	if (typeof value === 'string') return value;

	try {
		return JSON.parse(value.value ?? '');
	} catch {
		return null;
	}
}
