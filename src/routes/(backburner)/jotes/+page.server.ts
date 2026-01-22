import { NOTION_TOKEN } from '$env/static/private';
import { Client, isFullDatabase } from '@notionhq/client';
import type { PageServerLoad } from './$types';

// Initializing a client
const notion = new Client({
	auth: NOTION_TOKEN
});

const getUsers = async () => {
	const listUsersResponse = await notion.users.list({});
	return listUsersResponse;
};

const getQuotes = async () => {
	const listQuotesResponse = await notion.blocks.children.list({
		block_id: '1d7729937a2f4df7a96f168cbe465da7'
	});

	listQuotesResponse.results[0];
	return listQuotesResponse;
};

export const load: PageServerLoad = async () => {
	const quotes = getQuotes();
	return { quotes };
};
