import type { JSONContent } from '@tiptap/core';

export type CraftMeta = {
	title: string;
	description: string;
	tags: string[];
	date: string;
	wordCount?: number;
	draft?: boolean;
	fullBleed?: boolean;
};

export type CraftListItem = {
	id: string;
	slug: string;
	title: string;
	tags: string[];
	date: string;
	wordCount?: number;
};

export type CraftDocument = {
	version: 1;
	editor: 'tiptap';
	content: JSONContent;
	updatedAt?: string;
};
