export type ToolMeta = {
	title: string;
	description: string;
	tags: string[];
	date: string;
	draft?: boolean;
	fullBleed?: boolean;
};

export type ToolSummary = ToolMeta & { slug: string };
