import type { JSONContent } from '@tiptap/core';

export type CraftMeta = {
	title: string;
	description: string;
	tags: string[];
	date: string;
	draft?: boolean;
	fullBleed?: boolean;
};

export type CraftDocument = {
	version: 1;
	editor: 'tiptap';
	content: JSONContent;
	updatedAt?: string;
};
