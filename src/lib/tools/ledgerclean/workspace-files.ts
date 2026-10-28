import * as v from 'valibot';
import { portableRules } from './rules';
import { ruleKey } from './processing';
import {
	emptyWorkspace,
	ruleSchema,
	serializeWorkspace,
	validateWorkspace,
	type Workspace
} from './workspace-storage';

export function workspaceBackup(workspace: Workspace): string {
	return JSON.stringify(serializeWorkspace(workspace), null, 2);
}

export function rulesBackup(workspace: Workspace): string {
	return JSON.stringify(
		{
			format: 'ledgerclean-rules',
			version: 1,
			categories: workspace.categories,
			tags: workspace.tags,
			rules: portableRules(workspace.rules)
		},
		null,
		2
	);
}

const bundleSchema = v.strictObject({
	format: v.literal('ledgerclean-rules'),
	version: v.literal(1),
	categories: v.unknown(),
	tags: v.unknown(),
	rules: v.array(ruleSchema)
});

export function importRuleBundle(text: string, current: Workspace): Workspace {
	const bundle = v.parse(bundleSchema, JSON.parse(text));
	const imported = validateWorkspace({
		...serializeWorkspace(emptyWorkspace()),
		categories: bundle.categories,
		tags: bundle.tags,
		rules: portableRules(bundle.rules)
	});
	const keys = new Set(imported.rules.map(ruleKey));
	// Import is explicit: matching predicates are replaced, other personal rules keep their order.
	return validateWorkspace(
		serializeWorkspace({
			...current,
			categories: { ...imported.categories, ...current.categories },
			tags: { ...imported.tags, ...current.tags },
			rules: [...imported.rules, ...current.rules.filter((rule) => !keys.has(ruleKey(rule)))]
		})
	);
}

export function restoreWorkspaceBackup(text: string): Workspace {
	return validateWorkspace(JSON.parse(text));
}
