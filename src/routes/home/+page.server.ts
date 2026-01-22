import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async () => {
	const initializeTasks = (): Task[] => {
		return [
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
	};

	return {
		tasks: initializeTasks()
	};
};
