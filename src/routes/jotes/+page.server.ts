import { NOTION_TOKEN } from '$env/static/private';
import { Client } from '@notionhq/client';

// Initializing a client
const notion = new Client({
	auth: NOTION_TOKEN
});

const getUsers = async () => {
	const listUsersResponse = await notion.users.list({});
	return listUsersResponse;
};

export const load = async () => {
	const users = await getUsers();
	console.log(users);
	return { users };
};
