import { query, command, getRequestEvent } from '$app/server';
import * as v from 'valibot';

export type Task = {
	id: string;
	name: string;
	details?: string;
	tags?: string[];
	reminderDate?: string;
	dueDate?: string;
	startDate?: string;
	endDate?: string;
	priority?: number;
	completed?: boolean;
};

// Default seed used if no cookie exists
const seed: Task[] = [
	{
		id: '1',
		name: 'Review quarterly budget report',
		details:
			'Analyze Q3 spending patterns and prepare recommendations for Q4 budget adjustments. Focus on marketing spend efficiency.',
		completed: false
	},
	{
		id: '2',
		name: 'Call dentist for cleaning appointment',
		details: 'Schedule routine 6-month cleaning. Mention the sensitivity in lower left molar.',
		completed: false
	},
	{
		id: '3',
		name: 'Fix leaky kitchen faucet',
		details:
			'Replace O-ring in kitchen faucet handle. Need to pick up replacement parts from hardware store first.',
		completed: false
	},
	{
		id: '4',
		name: 'Prepare presentation for client meeting',
		details:
			"Create slides for Tuesday's 2pm meeting with Acme Corp. Include project timeline, deliverables, and cost breakdown.",
		completed: false
	},
	{
		id: '5',
		name: 'Research vacation destinations',
		details:
			'Look into 2-week trip options for next summer. Consider: budget $3000, prefer beach destinations, need pet-friendly accommodations.',
		completed: false
	}
];

const COOKIE_NAME = 'home:tasks';

function readTasksFromCookies(): Task[] {
	const { cookies } = getRequestEvent();
	const raw = cookies.get(COOKIE_NAME);
	if (!raw) return structuredClone(seed);
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as Task[];
	} catch {}
	return structuredClone(seed);
}

function writeTasksToCookies(tasks: Task[]): void {
	const { cookies } = getRequestEvent();
	cookies.set(COOKIE_NAME, JSON.stringify(tasks), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}

export const getTasks = query<Task[]>(async () => {
	await new Promise((resolve) => setTimeout(resolve, 200));
	const tasks = readTasksFromCookies();
	// Ensure cookie is present after first read
	writeTasksToCookies(tasks);
	return tasks;
});

// Validate the command input using Valibot

export const toggleTask = command(v.string(), async (id) => {
	const tasks = readTasksFromCookies();
	const idx = tasks.findIndex((t) => t.id === id);
	if (idx === -1) throw new Error('Task not found');
	const updated: Task = { ...tasks[idx], completed: !tasks[idx].completed };
	tasks[idx] = updated;
	writeTasksToCookies(tasks);
	return updated;
});

// Generic update endpoint returning the full list so the client can replace its data easily
const UpdateTaskSchema = v.object({
	id: v.string(),
	toggle: v.optional(v.boolean())
});

export const updateTask = command(UpdateTaskSchema, async ({ id, toggle = true }) => {
	const tasks = readTasksFromCookies();
	const idx = tasks.findIndex((t) => t.id === id);
	if (idx === -1) throw new Error('Task not found');

	const current = tasks[idx];
	const next: Task = {
		...current,
		completed: toggle ? !current.completed : current.completed
	};
	tasks[idx] = next;
	writeTasksToCookies(tasks);
	return tasks;
});
