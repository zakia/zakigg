import { Task } from '$lib/shared/Task';
import { remultApi } from 'remult/remult-sveltekit';

export const api = remultApi({
	entities: [Task]
});
