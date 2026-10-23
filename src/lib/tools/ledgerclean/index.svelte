<script lang="ts">
	import { budgetFlow, isDeclaredTransfer, setBudgetOverrides, type BudgetOverride } from './activity';
	import { onMount, onDestroy, tick } from 'svelte';
	import { nanoid } from 'nanoid';
	import {
		DEFAULT_CATEGORIES,
		UNCATEGORIZED_ID,
		categoryList,
		categoryPath,
		validateCategories,
		type CategoryDictionary
	} from './category-model';
	import {
		emptyWorkspace,
		loadWorkspace,
		persistWorkspace,
		type AiSettings,
		type ImportInfo
	} from './workspace-storage';
	import { localAi } from './local-ai.svelte';
	import type { TagProposal } from './ai';
	import { approveLearning } from './learning';
	import { identifyTransactions, planImport } from './identity';
	import CategoryEditor from './CategoryEditor.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import TagPicker from './TagPicker.svelte';
	import TagEditor from './TagEditor.svelte';
	import {
		DEFAULT_TAGS,
		validateTagIds,
		editTransactionTags,
		transactionTagMap,
		filterByTag,
		type TagDictionary
	} from './tags';
	import { detectRecurring } from './recurring';
	import { groupMerchantTransactions } from './merchants';
	import { consolidateMerchantRules } from './merchant-rules';
	import { needsAiRule } from './ai';
	import AiCategorizer from './AiCategorizer.svelte';
	import {
		previewMerchantRule,
		workspaceMerchantGroups,
		type MerchantGroup
	} from './merchant-workspace';
	import AiConnectionSettings from './AiSettings.svelte';
	import { formatDate, formatMonth as monthLabel } from '$lib/utils/date';
	import {
		applyRules,
		clearRuleScopes,
		matchingRule,
		mergeCategoryMappings,
		proposedCategoryMappings,
		ruleKey,
		exportTransactions,
		filterTransactions,
		normalizeTransactions,
		previousMonth,
		restoreDefaultCategories,
		readCsv,
		saveRule,
		setCategory,
		summarizeMonths,
		summarizeYearSpending,
		type CsvData,
		type ImportOptions,
		transactionOverride,
		type Rule,
		type Transaction,
		type TransactionFilter
	} from './processing';
	import MonthlySpendingChart from './MonthlySpendingChart.svelte';
	import ImportQuestions from './ImportQuestions.svelte';
	import {
		inferImport,
		importProfileKey,
		rememberImportProfile,
		type ImportProfile,
		type ImportQuestion
	} from './import-inference';

	type StagedFile = {
		name: string;
		data: CsvData;
		options: ImportOptions;
		questions: ImportQuestion[];
	};
	let transactions = $state<Transaction[]>([]);
	let learnedRules = $state<Rule[]>(emptyWorkspace().rules);
	let staged = $state<StagedFile[]>([]);
	let profiles = $state<Record<string, ImportProfile>>({});
	type ImportState = { transactions: Transaction[]; rules: Rule[]; imports: ImportInfo[] };
	let importUndo = $state.raw<{ before: ImportState; after: ImportState; label: string } | null>(
		null
	);
	type RuleToastState = {
		before: { transactions: Transaction[]; rules: Rule[] };
		after: { transactions: Transaction[]; rules: Rule[] };
		transactionId: string;
		categoryId: string;
		keyword: string;
		matchCount: number;
	};
	let ruleToast = $state.raw<RuleToastState | null>(null);
	let month = $state('');
	let allMonths = $state(false);
	let currency = $state('CAD');
	let search = $state('');
	let category = $state('');
	let categories = $state<CategoryDictionary>(structuredClone(DEFAULT_CATEGORIES));
	let tags = $state<TagDictionary>(structuredClone(DEFAULT_TAGS));
	let tagFilter = $state('');
	const recurring = $derived(detectRecurring(transactions, learnedRules, categories));
	const recurringIds = $derived(new Set(recurring.flatMap((series) => series.transactionIds)));
	const rowTags = $derived(
		transactionTagMap(transactions, learnedRules, categories, tags, recurringIds)
	);
	const taggedRows = $derived(filterByTag(transactions, rowTags, tagFilter, tags));
	let importedFiles = $state<ImportInfo[]>([]);
	let aiSettings = $state<AiSettings>(emptyWorkspace().ai);
	let storageReady = $state(false);
	let persistenceBlocked = $state(false);
	const categoryOptions = $derived(categoryList(categories));
	let type = $state<TransactionFilter['type']>('');
	let page = $state(1);
	let loading = $state(false);
	let message = $state('');
	let error = $state('');
	let storageWarning = $state('');
	type View = 'overview' | 'categories' | 'settings' | 'import';
	let view = $state<View>('overview');
	let returnView = $state<View>('overview');
	let aiReviewActive = $state(false);
	let fileInput: HTMLInputElement;
	let exportScope = $state('month');
	let resetCategoriesOpen = $state(false);
	let resetAssignments = $state(false);
	type CategoryState = {
		categories: CategoryDictionary;
		transactions: Transaction[];
		rules: Rule[];
	};
	let categoryResetUndo = $state.raw<{ before: CategoryState; after: CategoryState } | null>(null);
	const resetCategoryPreview = $derived(
		restoreDefaultCategories(transactions, categories, learnedRules, resetAssignments)
	);
	const customCategoryCount = $derived(
		Object.keys(categories).filter((id) => !DEFAULT_CATEGORIES[id]).length
	);
	const resetMovedCount = $derived(
		resetCategoryPreview.transactions.filter(
			(row, i) => row.categoryId !== transactions[i].categoryId
		).length
	);
	const resetRemovedRules = $derived(learnedRules.length - resetCategoryPreview.rules.length);
	const pageSize = 50;
	const rules = $derived(learnedRules);
	const currencies = $derived(
		[...new Set(transactions.map((transaction) => transaction.currency))].sort()
	);
	const calendarMonths = $derived(summarizeMonths(transactions, currency, categories));
	const summaries = $derived(summarizeMonths(taggedRows, currency, categories));
	const years = $derived([...new Set(calendarMonths.map((entry) => entry.month.slice(0, 4)))]);
	const year = $derived(month.slice(0, 4) || years[0] || '');
	const chartCategory = $derived(
		category && ['expense', 'uncategorized'].includes(categories[category]?.kind) ? category : ''
	);
	const yearlySpending = $derived(
		summarizeYearSpending(taggedRows, year, currency, categories, chartCategory || null)
	);
	const activeMonthFilter = $derived(allMonths ? '' : month);
	const summary = $derived.by(() => {
		if (chartCategory) {
			const spendingCents = allMonths
				? yearlySpending.reduce((sum, entry) => sum + entry.spendingCents, 0)
				: (yearlySpending.find((entry) => entry.month === month)?.spendingCents ?? 0);
			return { spendingCents, incomeCents: 0, netCents: -spendingCents };
		}
		if (allMonths) {
			const spendingCents = summaries.reduce((sum, entry) => sum + entry.spendingCents, 0);
			const incomeCents = summaries.reduce((sum, entry) => sum + entry.incomeCents, 0);
			return { spendingCents, incomeCents, netCents: incomeCents - spendingCents };
		}
		return summaries.find((entry) => entry.month === month);
	});
	const prior = $derived(summaries.find((entry) => entry.month === previousMonth(month)));
	const filtered = $derived(
		filterTransactions(
			taggedRows,
			{
				month: activeMonthFilter,
				currency,
				search,
				categoryId: category,
				type
			},
			categories
		)
	);
	const reviewCount = $derived(
		filterTransactions(
			taggedRows,
			{
				month: activeMonthFilter,
				currency,
				categoryId: UNCATEGORIZED_ID
			},
			categories
		).length
	);
	const unmatchedMerchantCount = $derived(
		workspaceMerchantGroups(transactions, learnedRules, categories).filter(
			(g) => g.transactions.length > 0 && g.rule.categoryId === UNCATEGORIZED_ID
		).length
	);
	const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
	const currentPage = $derived(Math.min(page, pageCount));
	const visible = $derived(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize));
	const imports = $derived(
		staged.map((file) => {
			try {
				return {
					name: file.name,
					result: normalizeTransactions(file.data, file.options, rules, categories),
					error: ''
				};
			} catch (cause) {
				return {
					name: file.name,
					result: { transactions: [], issues: [] },
					error: cause instanceof Error ? cause.message : 'Could not process this file.'
				};
			}
		})
	);
	const validCount = $derived(
		imports.reduce((total, file) => total + file.result.transactions.length, 0)
	);
	const importPlan = $derived(
		planImport(
			transactions,
			imports.map((file, index) => ({
				transactions: file.result.transactions,
				keepDuplicates: staged[index].options.keepDuplicates
			}))
		)
	);
	const accounts = $derived([...new Set(transactions.map((row) => row.account || 'Main account'))]);
	const skippedCount = $derived(
		imports.reduce((total, file) => total + file.result.issues.length, 0)
	);

	onDestroy(() => localAi.unload());
	onMount(() => {
		try {
			const saved = loadWorkspace(localStorage);
			categories = saved.categories;
			tags = saved.tags;
			transactions = saved.transactions;
			learnedRules = saved.rules;
			importedFiles = saved.imports;
			aiSettings = saved.ai;
			profiles = saved.profiles;
			const latest = [...saved.transactions].sort((a, b) => b.date.localeCompare(a.date))[0];
			if (latest) {
				currency = latest.currency;
				month = latest.date.slice(0, 7);
			}
		} catch {
			persistenceBlocked = true;
			storageWarning =
				'Saved data could not be loaded. It has been preserved; changes will stay in this session until you replace the saved workspace.';
		}
		storageReady = true;
	});
	$effect(() => {
		if (!storageReady || persistenceBlocked) return;
		const workspace = {
			version: 4 as const,
			tags,
			categories,
			transactions,
			rules: learnedRules,
			imports: importedFiles,
			ai: aiSettings,
			profiles
		};
		try {
			persistWorkspace(localStorage, workspace);
			storageWarning = '';
		} catch {
			storageWarning =
				'Browser storage is unavailable or full. Recent changes are only available in this session.';
		}
	});
	$effect(() => {
		if (
			categoryResetUndo &&
			(categories !== categoryResetUndo.after.categories ||
				transactions !== categoryResetUndo.after.transactions ||
				learnedRules !== categoryResetUndo.after.rules)
		)
			categoryResetUndo = null;
	});
	$effect(() => {
		if (
			ruleToast &&
			(transactions !== ruleToast.after.transactions || learnedRules !== ruleToast.after.rules)
		)
			ruleToast = null;
	});
	function resetCategories() {
		if (aiReviewActive) return;
		const before = $state.snapshot({ categories, transactions, rules: learnedRules });
		const next = resetCategoryPreview;
		categories = next.categories;
		transactions = next.transactions;
		learnedRules = next.rules;
		categoryResetUndo = { before, after: { categories, transactions, rules: learnedRules } };
		resetCategoriesOpen = false;
		category = '';
		ruleToast = null;
		message = resetAssignments
			? 'Default categories restored. Transactions are ready for a fresh AI categorization.'
			: 'Default categories restored.';
	}
	function undoCategoryReset() {
		if (!categoryResetUndo || aiReviewActive) return;
		const before = categoryResetUndo.before;
		categoryResetUndo = null;
		categories = before.categories;
		transactions = before.transactions;
		learnedRules = before.rules;
		category = '';
		ruleToast = null;
		message = 'Category reset undone.';
	}
	function selectView(next: View) {
		view = next;
		page = 1;
		ruleToast = null;
		message = '';
		void tick().then(() => {
			if (view === next) window.scrollTo({ top: 0 });
		});
	}
	function applyBudgetFlags(ids: string[], flag: BudgetOverride) {
		transactions = applyRules(
			setBudgetOverrides(transactions, ids, flag),
			learnedRules,
			categories
		);
		ruleToast = null;
		message =
			flag === 'transfer'
				? `${ids.length === 1 ? 'Marked as transfer' : `${ids.length} marked as transfers`}. Spending and income totals exclude ${ids.length === 1 ? 'it' : 'them'}.`
				: flag === 'exclude'
					? `${ids.length === 1 ? 'Excluded' : `${ids.length} excluded`} from budget totals.`
					: `Budget treatment reset.`;
	}
	function updateAiSettings(value: AiSettings) {
		aiSettings = value;
	}
	function cancelImport() {
		staged = [];
		selectView(returnView);
	}
	function deleteCategory(id: string) {
		if (id === UNCATEGORIZED_ID) return;
		const parent = categories[id].parentId;
		const replacement = parent ?? UNCATEGORIZED_ID;
		const next = { ...categories };
		delete next[id];
		for (const entry of Object.values(next))
			if (entry.parentId === id) next[entry.id] = { ...entry, parentId: parent };
		validateCategories(next);
		categories = next;
		transactions = transactions.map((transaction) =>
			transaction.categoryId === id || transactionOverride(transaction)?.categoryId === id
				? {
						...transaction,
						categoryId: transaction.categoryId === id ? replacement : transaction.categoryId,
						categoryOverride: transactionOverride(transaction)
							? {
									...transactionOverride(transaction)!,
									categoryId:
										transactionOverride(transaction)!.categoryId === id
											? replacement
											: transactionOverride(transaction)!.categoryId
								}
							: null
					}
				: transaction
		);
		learnedRules = learnedRules.map((rule) =>
			rule.categoryId === id ? { ...rule, categoryId: replacement } : rule
		);
		transactions = applyRules(transactions, learnedRules, categories);
		if (category === id) category = '';
		ruleToast = null;
	}
	function applyAiTags(proposal: TagProposal, requested: Transaction[]) {
		const approved = approveLearning(transactions, proposal, requested, learnedRules, categories);
		learnedRules = approved.rules;
		transactions = approved.transactions;
		message = `Saved ${approved.savedCount} rule${approved.savedCount === 1 ? '' : 's'}; updated ${approved.updatedCount} transaction${approved.updatedCount === 1 ? '' : 's'}.`;
	}
	function changeImportSigns(id: string, expenses: ImportInfo['expenses']) {
		const file = importedFiles.find((file) => file.id === id);
		if (!file || file.amountMode !== 'signed' || file.expenses === expenses) return;
		transactions = applyRules(
			transactions.map((transaction) =>
				transaction.importId === id
					? { ...transaction, amountCents: -transaction.amountCents }
					: transaction
			),
			learnedRules,
			categories
		);
		importedFiles = importedFiles.map((file) => (file.id === id ? { ...file, expenses } : file));
		if (file.profileKey && profiles[file.profileKey])
			profiles = { ...profiles, [file.profileKey]: { ...profiles[file.profileKey], expenses } };
		message = `Updated expense signs for ${file.name}.`;
	}

	function money(cents: number, code = currency) {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: code }).format(
			cents / 100
		);
	}
	function dayLabel(value: string) {
		return formatDate(value, { month: 'short', day: 'numeric' });
	}
	function resetFilters() {
		tagFilter = '';
		search = '';
		category = '';
		type = '';
		allMonths = false;
		page = 1;
	}
	function selectMonth(value: string) {
		month = value;
		allMonths = false;
		page = 1;
		ruleToast = null;
	}
	function selectChartCategory(id: string) {
		category = id;
		search = '';
		type = '';
		page = 1;
		ruleToast = null;
	}
	function changeCurrency(value: string) {
		currency = value;
		const available = summarizeMonths(transactions, value, categories);
		if (!available.some((entry) => entry.month === month)) month = available[0]?.month ?? '';
		page = 1;
	}
	function selectYear(value: string) {
		const months = summaries.filter((entry) => entry.month.startsWith(`${value}-`));
		const next = months.find((entry) => entry.month.slice(5) === month.slice(5)) ?? months[0];
		if (next) selectMonth(next.month);
	}
	async function stageFiles(files: FileList | null) {
		if (loading || !files?.length) return;
		loading = true;
		error = '';
		message = '';
		try {
			const next: StagedFile[] = [];
			for (const file of Array.from(files)) {
				if (!/\.csv$/i.test(file.name)) throw new Error(`${file.name}: choose a CSV file.`);
				let data: CsvData;
				try {
					data = readCsv(await file.text());
				} catch (cause) {
					throw new Error(
						`${file.name}: ${cause instanceof Error ? cause.message : 'Could not read CSV.'}`,
						{ cause }
					);
				}
				const inferred = inferImport(
					data,
					file.name,
					nanoid(),
					profiles[importProfileKey(data.headers)],
					transactions.map((row) => ({
						name: row.account || 'Main account',
						type: row.accountType || 'unknown'
					})),
					currency
				);
				inferred.options.categoryMappings = proposedCategoryMappings(
					data,
					inferred.options.columns,
					rules,
					categories
				);
				next.push({ name: file.name, data, ...inferred });
			}
			staged = next;
			returnView = view === 'import' ? returnView : view;
			if (
				next.some((file) => file.questions.length) ||
				!validCount ||
				imports.some((file) => file.error)
			)
				selectView('import');
			else {
				loading = false;
				await importFiles();
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not read CSV.';
		} finally {
			loading = false;
			fileInput.value = '';
		}
	}
	async function importFiles() {
		if (
			loading ||
			!validCount ||
			imports.some((file) => file.error) ||
			staged.some((file) => file.questions.includes('sign') && !file.options.accountType)
		)
			return;
		loading = true;
		error = '';
		try {
			const before = $state.snapshot({ transactions, rules: learnedRules, imports: importedFiles });
			const planned = $state.snapshot(importPlan);
			const files = $state.snapshot(staged);
			const skipped = skippedCount;
			const duplicates = planned.reduce((total, file) => total + file.duplicates.length, 0);
			const incoming = await identifyTransactions(
				$state.snapshot(transactions),
				planned.flatMap((file) => file.added)
			);
			const combined = [...transactions, ...incoming];
			for (const file of files)
				learnedRules = mergeCategoryMappings(
					learnedRules,
					file.options.categoryMappings ??
						proposedCategoryMappings(file.data, file.options.columns, learnedRules, categories),
					categories
				);
			learnedRules = consolidateMerchantRules(combined, learnedRules, categories);
			const incomingGroups = groupMerchantTransactions(
				incoming,
				combined,
				learnedRules,
				categories
			);
			transactions = applyRules(combined, learnedRules, categories);
			importedFiles = [
				...importedFiles,
				...files.map((file, index) => ({
					id: file.options.idPrefix,
					name: file.name,
					count: planned[index].added.length,
					duplicates: planned[index].duplicates.length,
					profileKey: importProfileKey(file.data.headers),
					account: file.options.account?.trim() || 'Main account',
					amountMode: file.options.amountMode,
					expenses: file.options.expenses
				}))
			];
			if (incoming.length) {
				currency = incoming.some((row) => row.currency === currency)
					? currency
					: incoming[0].currency;
				month = incoming
					.filter((row) => row.currency === currency)
					.map((row) => row.date.slice(0, 7))
					.sort()
					.at(-1)!;
			}
			resetFilters();
			message = `${incoming.length} transactions · ${incomingGroups.length} merchant groups${duplicates ? ` · ${duplicates} duplicates skipped` : ''}${skipped ? ` · ${skipped} invalid rows skipped` : ''}`;
			for (const file of files)
				profiles = {
					...profiles,
					[importProfileKey(file.data.headers)]: rememberImportProfile(file.options)
				};
			if (incoming.length)
				importUndo = {
					before,
					after: { transactions, rules: learnedRules, imports: importedFiles },
					label: message
				};
			view =
				incoming.length &&
				transactions.some(
					(row) =>
						incoming.some((item) => item.id === row.id) &&
						needsAiRule(row, learnedRules, categories)
				)
					? 'categories'
					: 'overview';
			staged = [];
			void tick().then(() => window.scrollTo({ top: 0 }));
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not import transactions.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (
			importUndo &&
			(transactions !== importUndo.after.transactions ||
				learnedRules !== importUndo.after.rules ||
				importedFiles !== importUndo.after.imports)
		)
			importUndo = null;
	});
	function undoImport() {
		if (!importUndo) return;
		const before = importUndo.before;
		importUndo = null;
		transactions = before.transactions;
		learnedRules = before.rules;
		importedFiles = before.imports;
		resetFilters();
		month =
			transactions
				.map((row) => row.date.slice(0, 7))
				.sort()
				.at(-1) || '';
		message = 'Import undone.';
	}
	function editCategory(transaction: Transaction, value: string) {
		const beforeTransactions = $state.snapshot(transactions);
		const beforeRules = $state.snapshot(learnedRules);
		message = '';

		if (value === UNCATEGORIZED_ID || isDeclaredTransfer(transaction)) {
			transactions = applyRules(
				setCategory(transactions, transaction.id, value, categories),
				learnedRules,
				categories
			);
			ruleToast = null;
			return;
		}

		// Automatically save as a merchant rule by default, with an option for "Only this transaction" or "Undo"
		const group = groupMerchantTransactions(
			[transaction],
			transactions,
			learnedRules,
			categories
		)[0];
		const baseRule = group?.rule ?? {
			keyword: transaction.description,
			match: 'exact' as const,
			field: 'description' as const,
			categoryId: value
		};
		const nextRule: Rule = {
			...baseRule,
			categoryId: value,
			source: 'manual',
			confidence: undefined
		};
		const nextRules = saveRule(learnedRules, nextRule, categories);
		const clearedRowTransactions = transactions.map((row) =>
			row.id === transaction.id
				? { ...row, categoryOverride: null, categorySource: 'automatic' as const }
				: row
		);
		const nextTransactions = applyRules(clearedRowTransactions, nextRules, categories);
		const matchCount = nextTransactions.filter(
			(row) =>
				!isDeclaredTransfer(row) &&
				matchingRule(row.description, [nextRule], categories, row.id, row)
		).length;

		learnedRules = nextRules;
		transactions = nextTransactions;
		ruleToast = {
			before: { transactions: beforeTransactions, rules: beforeRules },
			after: { transactions: nextTransactions, rules: nextRules },
			transactionId: transaction.id,
			categoryId: value,
			keyword: nextRule.keyword,
			matchCount
		};
	}
	function applyRuleToastSingleOnly() {
		if (!ruleToast) return;
		const { before, transactionId, categoryId } = ruleToast;
		ruleToast = null;
		learnedRules = before.rules;
		transactions = applyRules(
			setCategory(before.transactions, transactionId, categoryId, categories),
			before.rules,
			categories
		);
		message = 'Updated only this transaction.';
	}
	function undoRuleToast() {
		if (!ruleToast) return;
		const { before } = ruleToast;
		ruleToast = null;
		learnedRules = before.rules;
		transactions = before.transactions;
		message = 'Category change undone.';
	}
	function saveMerchantGroup(rule: Rule, groups: MerchantGroup[]) {
		validateTagIds(rule.tagIds ?? [], tags);
		const preview = previewMerchantRule(transactions, learnedRules, categories, groups, rule);
		learnedRules = preview.rules;
		transactions = preview.transactions;
	}

	function saveMerchantTags(rule: Rule, ids: string[]) {
		validateTagIds(ids, tags);
		learnedRules = saveRule(
			learnedRules,
			{ ...rule, tagIds: ids, source: rule.source ?? 'manual' },
			categories
		);
		transactions = applyRules(transactions, learnedRules, categories);
	}
	function changeTransactionTags(id: string, ids: string[]) {
		transactions = editTransactionTags(transactions, id, rowTags.get(id) ?? [], ids, tags);
	}
	function removeTag(id: string) {
		if (DEFAULT_TAGS[id]) return;
		const next = { ...tags };
		delete next[id];
		tags = next;
		learnedRules = learnedRules.map((rule) => ({
			...rule,
			tagIds: rule.tagIds?.filter((tag) => tag !== id)
		}));
		transactions = transactions.map((row) =>
			row.tagOverride
				? {
						...row,
						tagOverride: {
							add: row.tagOverride.add.filter((tag) => tag !== id),
							remove: row.tagOverride.remove.filter((tag) => tag !== id)
						}
					}
				: row
		);
		if (tagFilter === id) tagFilter = '';
	}

	function removeRule(target: Rule) {
		learnedRules = learnedRules.filter((rule) => ruleKey(rule) !== ruleKey(target));
		transactions = applyRules(transactions, rules, categories);
	}
	function exportCsv() {
		const rows =
			exportScope === 'all'
				? transactions
				: exportScope === 'filtered'
					? filtered
					: filterTransactions(transactions, { month: activeMonthFilter, currency }, categories);
		const url = URL.createObjectURL(
			new Blob(['\uFEFF', exportTransactions(rows, categories, tags, rowTags)], {
				type: 'text/csv;charset=utf-8'
			})
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `ledgerclean-${exportScope === 'all' ? 'all' : activeMonthFilter || 'filtered'}.csv`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	function clearTransactions() {
		localAi.unload();
		transactions = [];
		learnedRules = clearRuleScopes(learnedRules);
		importedFiles = [];
		month = '';
		ruleToast = null;
		message = '';
		error = '';
		resetFilters();
	}
</script>

<section class="ledger" aria-label="LedgerClean transaction workspace">
	<header class="heading">
		<div class="brand-block">
			<h1>LedgerClean</h1>
			<p>Local spending ledger & merchant rules.</p>
		</div>
		<div class="header-actions">
			{#if transactions.length}
				<div class="export-group">
					<select aria-label="Export scope" bind:value={exportScope}>
						{#if !allMonths && month}
							<option value="month">{monthLabel(month, true)} · {currency}</option>
						{/if}
						<option value="filtered">Filtered ({filtered.length})</option>
						<option value="all">All ({transactions.length})</option>
					</select>
					<button
						type="button"
						disabled={exportScope === 'filtered' && !filtered.length}
						onclick={exportCsv}>Export CSV</button
					>
				</div>
			{/if}
			<button
				type="button"
				class="primary"
				disabled={loading}
				onclick={() => fileInput.click()}
			>
				{loading ? 'Reading…' : '+ Import CSV'}
			</button>
		</div>
	</header>

	<nav class="workspace-nav" aria-label="Workspace views">
		<button
			type="button"
			class:active={view === 'overview'}
			aria-pressed={view === 'overview'}
			onclick={() => selectView('overview')}
		>
			Overview
		</button>
		<button
			type="button"
			class:active={view === 'categories'}
			aria-pressed={view === 'categories'}
			onclick={() => selectView('categories')}
		>
			Merchants
			{#if aiReviewActive}
				<span class="nav-badge attention">review</span>
			{:else if unmatchedMerchantCount > 0}
				<span class="nav-badge">{unmatchedMerchantCount}</span>
			{/if}
		</button>
		<button
			type="button"
			class:active={view === 'settings'}
			aria-pressed={view === 'settings'}
			onclick={() => selectView('settings')}
		>
			Settings
		</button>
	</nav>

	<input
		bind:this={fileInput}
		class="file-input"
		type="file"
		accept=".csv,text/csv"
		multiple
		aria-label="Import CSV files"
		onchange={(event) => stageFiles(event.currentTarget.files)}
	/>

	{#if error}<p class="notice error" role="alert">{error}</p>{/if}
	{#if storageWarning}
		<p class="notice" role="status">
			{storageWarning}
			{#if persistenceBlocked}
				<button
					type="button"
					onclick={() => {
						persistenceBlocked = false;
					}}>Replace saved workspace</button
				>
			{/if}
		</p>
	{/if}
	{#if ruleToast}
		<div class="notice toast-notice" role="status">
			<span>
				Categorized <strong>{ruleToast.keyword}</strong> as
				<strong>{categoryPath(categories, ruleToast.categoryId)}</strong>
				{#if ruleToast.matchCount > 1}
					({ruleToast.matchCount} matching transactions)
				{/if}
			</span>
			<div class="actions">
				{#if ruleToast.matchCount > 1}
					<button type="button" onclick={applyRuleToastSingleOnly}>Only this transaction</button>
				{/if}
				<button type="button" class="quiet" onclick={undoRuleToast}>Undo</button>
			</div>
		</div>
	{:else if message || importUndo}
		<div class="notice import-notice" role="status">
			<span>{message || importUndo?.label}</span>
			{#if importUndo}
				<div class="actions">
					<button type="button" class="quiet" disabled={aiReviewActive} onclick={undoImport}>
						Undo
					</button>
					<button type="button" class="quiet" onclick={() => selectView('settings')}>
						Details
					</button>
				</div>
			{/if}
		</div>
	{/if}
	{#if staged.length && view !== 'import'}
		<p class="notice">
			{staged.length} file{staged.length === 1 ? '' : 's'} waiting to import.
			<button type="button" onclick={() => selectView('import')}>Continue review</button>
			<button type="button" class="quiet" onclick={() => (staged = [])}>Discard import</button>
		</p>
	{/if}

	{#if view === 'import'}
		<section class="workspace-section" aria-labelledby="import-title">
			<div class="section-heading">
				<h2 id="import-title">
					{staged.some((file) => file.questions.length)
						? 'One detail before importing'
						: 'Check this file'}
				</h2>
				<button type="button" class="quiet" disabled={loading} onclick={cancelImport}>Cancel</button>
			</div>
			<fieldset disabled={loading}>
				{#each staged as file (file.options.idPrefix)}
					{#if file.questions.length}
						<ImportQuestions
							name={file.name}
							data={file.data}
							options={file.options}
							questions={file.questions}
							{accounts}
							onChange={(options) => (file.options = options)}
						/>
					{/if}
				{/each}
			</fieldset>
			{#each imports.filter((file) => file.error) as file (file.name)}
				<p role="alert">{file.error}</p>
			{/each}
			{#if !validCount}
				{#each imports as file (file.name)}
					{#each file.result.issues.slice(0, 5) as issue (issue.row)}
						<p class="error" role="alert">Row {issue.row}: {issue.message}</p>
					{/each}
				{/each}
			{/if}
			<div class="actions">
				<span class="muted">{validCount} transactions</span>
				<button
					type="button"
					class="primary"
					disabled={loading ||
						!validCount ||
						imports.some((file) => file.error) ||
						staged.some((file) => file.questions.includes('sign') && !file.options.accountType)}
					onclick={importFiles}>{loading ? 'Importing…' : 'Continue'}</button
				>
			</div>
		</section>
	{:else if view === 'overview'}
		{#if transactions.length}
			<MonthlySpendingChart
				months={yearlySpending}
				{calendarMonths}
				{summary}
				{prior}
				{allMonths}
				{reviewCount}
				reviewFilterActive={category === UNCATEGORIZED_ID}
				tagFilterLabel={tagFilter
					? tagFilter === 'unreviewed'
						? 'Unreviewed'
						: (tags[tagFilter]?.name ?? '')
					: ''}
				categoryDictionary={categories}
				{year}
				{years}
				{currency}
				{currencies}
				selectedMonth={month}
				selectedCategory={chartCategory}
				onCategorySelect={selectChartCategory}
				onMonthSelect={selectMonth}
				onAllMonthsToggle={(all) => {
					allMonths = all;
					exportScope = all ? 'filtered' : 'month';
					page = 1;
				}}
				onReviewToggle={() => {
					category = category === UNCATEGORIZED_ID ? '' : UNCATEGORIZED_ID;
					type = '';
					search = '';
					page = 1;
				}}
				onYearChange={selectYear}
				onCurrencyChange={changeCurrency}
			/>

			{#if !chartCategory && yearlySpending.reduce((sum, entry) => sum + entry.spendingCents, 0) < 0}
				<p class="notice">
					Net spending is negative. If these are purchases, check the expense signs for your import.
					<button type="button" onclick={() => selectView('settings')}>Review import signs</button>
				</p>
			{/if}

			<div class="table-panel">
				<div class="filters">
					<div class="scope-segmented" role="group" aria-label="Transaction time scope">
						<button
							type="button"
							class="seg-btn"
							class:active={!allMonths}
							aria-pressed={!allMonths}
							onclick={() => {
								allMonths = false;
								exportScope = 'month';
								page = 1;
							}}
						>
							{month ? monthLabel(month, true) : 'Month'}
						</button>
						<button
							type="button"
							class="seg-btn"
							class:active={allMonths}
							aria-pressed={allMonths}
							onclick={() => {
								allMonths = true;
								exportScope = 'filtered';
								page = 1;
							}}
						>
							All months
						</button>
					</div>

					<input
						type="search"
						aria-label="Search transactions"
						placeholder="Search merchant, description, or amount…"
						bind:value={search}
						oninput={() => (page = 1)}
					/>

					<select aria-label="Filter category" bind:value={category} onchange={() => (page = 1)}>
						<option value="">All categories</option>
						{#each categoryOptions as option (option.id)}
							<option value={option.id}>{categoryPath(categories, option.id)}</option>
						{/each}
					</select>

					<select
						aria-label="Filter transaction type"
						bind:value={type}
						onchange={() => (page = 1)}
					>
						<option value="">All types</option>
						<option value="out">Money out</option>
						<option value="in">Money in</option>
						<option value="transfers">Transfers</option>
						<option value="excluded">Excluded</option>
					</select>

					<select aria-label="Filter by tag" bind:value={tagFilter} onchange={() => (page = 1)}>
						<option value="">All tags</option>
						<optgroup label="Wants and needs">
							<option value="unreviewed">Unreviewed purpose</option>
							{#each Object.values(tags).filter((tag) => tag.dimension === 'purpose') as tag (tag.id)}
								<option value={tag.id}>{tag.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Context and patterns">
							{#each Object.values(tags).filter((tag) => tag.dimension !== 'purpose') as tag (tag.id)}
								<option value={tag.id}>{tag.name}</option>
							{/each}
						</optgroup>
					</select>

					{#if reviewCount > 0 || category === UNCATEGORIZED_ID}
						<button
							type="button"
							class="review-pill"
							class:active={category === UNCATEGORIZED_ID}
							aria-pressed={category === UNCATEGORIZED_ID}
							onclick={() => {
								category = category === UNCATEGORIZED_ID ? '' : UNCATEGORIZED_ID;
								type = '';
								search = '';
								page = 1;
							}}
						>
							{reviewCount} to review
						</button>
					{/if}

					{#if search || category || type || tagFilter || allMonths}
						<button type="button" class="quiet" onclick={resetFilters}>Reset</button>
					{/if}
				</div>

				<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable table needs keyboard access.) -->
				<div class="table-scroll" tabindex="0" role="region" aria-label="Transactions table">
					<table>
						<caption class="sr-only">
							{allMonths ? 'All' : monthLabel(month)} transactions in {currency}
						</caption>
						<thead>
							<tr>
								<th scope="col">Date</th>
								<th scope="col">Merchant</th>
								<th scope="col">Category & tags</th>
								<th scope="col" class="number">Amount</th>
							</tr>
						</thead>
						<tbody>
							{#each visible as transaction (transaction.id)}
								{@const flow = budgetFlow(transaction, categories)}
								{@const isMutedFlow = flow === 'transfer' || flow === 'excluded'}
								<tr class:muted-row={isMutedFlow}>
									<td class="date" data-label="Date">
										<time datetime={transaction.date}>
											{allMonths
												? formatDate(transaction.date, {
														month: 'short',
														day: 'numeric',
														year: 'numeric'
													})
												: dayLabel(transaction.date)}
										</time>
									</td>
									<td class="merchant-col" data-label="Merchant">
										<div class="merchant-title-row">
											<span class="merchant">{transaction.merchant}</span>
											{#if flow === 'transfer'}
												<span class="flow-badge">Transfer</span>
											{:else if flow === 'excluded'}
												<span class="flow-badge">Excluded</span>
											{/if}
										</div>
										<small title={transaction.source}>
											{transaction.description !== transaction.merchant
												? `${transaction.description} · `
												: ''}{transaction.source}{accounts.length > 1
												? ` · ${transaction.account || 'Main account'}`
												: ''}
										</small>
										{#if transaction.sourceCategory}
											<small>Bank category: {transaction.sourceCategory}</small>
										{/if}
									</td>
									<td class="category-td" data-label="Category & tags">
										<div class="category-cell">
											<CategoryPicker
												{categories}
												value={transaction.categoryId}
												budgetOverride={transaction.budgetOverride ?? null}
												label={`Category for ${transaction.description} on ${transaction.date}`}
												onChange={(id) => editCategory(transaction, id)}
												onBudgetChange={(flag) => applyBudgetFlags([transaction.id], flag)}
											/>
											<TagPicker
												{tags}
												ids={rowTags.get(transaction.id) ?? []}
												label={`${transaction.description} on ${transaction.date}`}
												disabled={aiReviewActive}
												onChange={(ids) => changeTransactionTags(transaction.id, ids)}
											/>
										</div>
									</td>
									<td
										class="number"
										data-label="Amount"
										class:credit={transaction.amountCents > 0 && !isMutedFlow}
										class:muted-amount={isMutedFlow}
									>
										{transaction.amountCents > 0 ? '+' : ''}{money(transaction.amountCents)}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="4" class="empty">
										No transactions match these filters.
										<button type="button" class="quiet" onclick={resetFilters}>
											Reset filters
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<footer class="table-footer">
					<span>
						{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(
							currentPage * pageSize,
							filtered.length
						)} of {filtered.length} transactions
					</span>
					<div class="actions">
						<button
							type="button"
							disabled={currentPage <= 1}
							onclick={() => (page = currentPage - 1)}>Previous</button
						>
						<span>{currentPage} / {pageCount}</span>
						<button
							type="button"
							disabled={currentPage >= pageCount}
							onclick={() => (page = currentPage + 1)}>Next</button
						>
					</div>
				</footer>
			</div>
		{:else}
			<div class="empty-state">
				<div class="empty-mark" aria-hidden="true">＋</div>
				<h2>Start with your transactions</h2>
				<p>
					Import one or more bank or credit card CSVs.<br />Review the columns, then organize your
					spending by month.
				</p>
				<button type="button" class="primary" disabled={loading} onclick={() => fileInput.click()}>
					{loading ? 'Reading…' : 'Import transactions'}
				</button>
				<small>Categories and imported transactions are saved in this browser.</small>
			</div>
		{/if}
	{:else if view === 'settings'}
		<div class="settings-grid" aria-label="Workspace settings">
			<section class="workspace-section" aria-labelledby="categories-settings-title">
				<div class="category-heading">
					<div>
						<h2 id="categories-settings-title">Budget categories</h2>
						<p class="card-sub">Rename, recolor, reparent, or add spending categories.</p>
					</div>
					<div class="actions">
						{#if categoryResetUndo}
							<button type="button" onclick={undoCategoryReset}>Undo reset</button>
						{/if}
						<button
							type="button"
							aria-expanded={resetCategoriesOpen}
							onclick={() => {
								resetCategoriesOpen = !resetCategoriesOpen;
								resetAssignments = false;
							}}>Reset to defaults</button
						>
					</div>
				</div>
				<fieldset disabled={loading || aiReviewActive || localAi.status === 'loading'}>
					{#if resetCategoriesOpen}
						<section class="category-reset" aria-label="Reset categories preview">
							<h3>Restore default categories</h3>
							<p>
								Restore the default categories and colors. Remove {customCategoryCount} custom categor{customCategoryCount ===
								1
									? 'y'
									: 'ies'}.
							</p>
							{#if transactions.length}
								<label class="reset-option">
									<input type="checkbox" bind:checked={resetAssignments} />
									Clear all transaction assignments and saved rules for a fresh AI test
								</label>
							{/if}
							<p>
								{transactions.length} imported transactions will be kept. {resetMovedCount} category
								assignments change; {resetRemovedRules} saved rules are removed.
							</p>
							<div class="actions">
								<button type="button" class="primary" onclick={resetCategories}>
									Restore defaults
								</button>
								<button type="button" onclick={() => (resetCategoriesOpen = false)}>
									Cancel reset
								</button>
							</div>
						</section>
					{/if}
					<CategoryEditor
						{categories}
						onChange={(value) => (categories = value)}
						onDelete={deleteCategory}
					/>
				</fieldset>
			</section>

			<div class="settings-side">
				<section class="workspace-section" aria-labelledby="tags-settings-title">
					<h2 id="tags-settings-title">Purpose & context tags</h2>
					<p class="card-sub">
						Track Needs vs. Wants and contexts like Work or Social independently of spending
						categories.
					</p>
					<fieldset disabled={aiReviewActive}>
						<TagEditor {tags} onChange={(value) => (tags = value)} onDelete={removeTag} />
					</fieldset>
				</section>

				<section class="workspace-section">
					<fieldset disabled={aiReviewActive}>
						<AiConnectionSettings settings={aiSettings} onChange={updateAiSettings} />
					</fieldset>
				</section>

				{#if importedFiles.length}
					<section class="workspace-section" aria-labelledby="sources-title">
						<div class="section-heading">
							<h2 id="sources-title">Imported statements</h2>
							<button type="button" onclick={() => fileInput.click()}>Add CSV</button>
						</div>
						<p class="card-sub">
							Choose how each statement represents purchases. Changing this flips its imported
							amounts immediately.
						</p>
						<ul class="rule-list">
							{#each importedFiles as file (file.id)}
								<li>
									<span>
										<strong>{file.name}</strong>
										<small>{file.count} transactions · {file.account}</small>
									</span>
									{#if file.amountMode === 'signed'}
										<select
											aria-label={`Expense signs for ${file.name}`}
											value={file.expenses}
											onchange={(event) =>
												changeImportSigns(
													file.id,
													event.currentTarget.value as ImportInfo['expenses']
												)}
										>
											<option value="negative">− amounts are spending</option>
											<option value="positive">+ amounts are spending</option>
										</select>
									{:else}
										<span class="muted">Debit / credit columns</span>
									{/if}
								</li>
							{/each}
						</ul>
						<div class="danger-zone">
							<button type="button" class="quiet" onclick={clearTransactions}>
								Clear all transactions
							</button>
						</div>
					</section>
				{/if}
			</div>
		</div>
	{/if}

	<section hidden={view !== 'categories'} aria-labelledby="categories-title">
		<h2 id="categories-title" class="sr-only">Merchant rules & categorization</h2>
		<AiCategorizer
			{rules}
			{categories}
			{transactions}
			settings={aiSettings}
			onEnabled={() => (aiSettings = { enabled: true })}
			onReviewChange={(value) => (aiReviewActive = value)}
			onTagsApply={applyAiTags}
			onGroupSave={saveMerchantGroup}
			onGroupDelete={removeRule}
			{tags}
			{rowTags}
			{recurring}
			onGroupTagsChange={saveMerchantTags}
		/>
	</section>

	<p class="privacy">Saved on this device. AI categorization runs locally in your browser.</p>
</section>

<style>
	:global([data-theme='dark']) .ledger {
		--content: #e6eaf0;
		--content-1: #98a2b3;
		--base-1: #161b24;
		--base-2: #11151c;
		--edge: #252c38;
		--edge-1: #344054;
		background: #11151c;
	}
	:global(body[data-theme='dark']:has(.ledger)) {
		background: #11151c;
	}
	:global(body:has(.ledger)) {
		background: #f8fafc;
	}
	.ledger {
		--content: #182230;
		--content-1: #667085;
		--base-1: #fff;
		--base-2: #f8fafc;
		--edge: #eaecf0;
		--edge-1: #d0d5dd;
		background: #f8fafc;
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
		padding: 2.25rem 1.5rem 5rem;
	}
	.heading,
	.header-actions,
	.export-group,
	.actions,
	.table-footer,
	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}
	.heading {
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}
	.header-actions {
		flex-wrap: wrap;
	}
	.export-group {
		gap: 0.35rem;
	}
	h1 {
		font-size: 1.55rem;
		font-weight: 650;
		letter-spacing: -0.045em;
		margin: 0;
		line-height: 1.15;
	}
	h2 {
		font-size: 1.05rem;
		font-weight: 600;
		margin: 0;
	}
	h3 {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
	}
	.heading p,
	.card-sub,
	.muted,
	small,
	.privacy,
	.table-footer {
		color: var(--content-1);
	}
	.heading p {
		font-size: 0.825rem;
		margin: 0.2rem 0 0;
	}
	.card-sub {
		font-size: 0.8rem;
		margin: 0.25rem 0 0.85rem;
		line-height: 1.5;
	}
	button,
	select,
	input {
		font-size: 0.8125rem;
		border: 1px solid var(--edge-1);
		border-radius: 7px;
		padding: 0.45rem 0.7rem;
		background: var(--base-1);
		color: var(--content);
		min-height: 2.2rem;
	}
	button {
		font-weight: 500;
		white-space: nowrap;
	}
	button:hover:not(:disabled) {
		background: var(--base-2);
		border-color: var(--content-1);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button.primary {
		background: var(--content);
		border-color: var(--content);
		color: var(--base-1);
	}
	button.primary:hover:not(:disabled) {
		opacity: 0.88;
	}
	button.quiet {
		background: transparent;
		border-color: transparent;
		color: var(--content-1);
	}
	button.quiet:hover:not(:disabled) {
		background: var(--base-2);
		border-color: transparent;
		color: var(--content);
	}
	button:focus-visible,
	select:focus-visible,
	input:focus-visible,
	.table-scroll:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 2px;
	}
	.file-input {
		display: none;
	}
	.workspace-nav {
		display: flex;
		gap: 1.5rem;
		border-bottom: 1px solid var(--edge);
		margin-bottom: 1.5rem;
	}
	.workspace-nav button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: transparent;
		border: 0;
		border-radius: 0;
		padding: 0.65rem 0.1rem;
		color: var(--content-1);
		border-bottom: 2px solid transparent;
		font-size: 0.875rem;
	}
	.workspace-nav button.active {
		color: var(--content);
		border-bottom-color: var(--content);
		font-weight: 600;
	}
	.workspace-nav button:hover {
		color: var(--content);
		border-bottom-color: var(--edge-1);
		background: transparent;
	}
	.nav-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0.42rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		background: var(--base-1);
		border: 1px solid var(--edge-1);
		color: var(--content);
	}
	.nav-badge.attention {
		background: color-mix(in oklch, var(--info) 16%, var(--base-1));
		border-color: color-mix(in oklch, var(--info) 45%, var(--edge-1));
	}
	.import-notice,
	.toast-notice {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.toast-notice {
		background: var(--base-1);
		border-color: var(--edge-1);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.04);
	}
	.table-panel {
		border: 1px solid var(--edge);
		border-radius: 12px;
		overflow: hidden;
		background: var(--base-1);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.03);
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		padding: 0.8rem 0.9rem;
		align-items: center;
		border-bottom: 1px solid var(--edge);
		flex-wrap: wrap;
	}
	.scope-segmented {
		display: inline-flex;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 7px;
		padding: 0.15rem;
		gap: 0.1rem;
	}
	.seg-btn {
		border: 0;
		background: transparent;
		color: var(--content-1);
		font-size: 0.76rem;
		padding: 0.3rem 0.6rem;
		min-height: 1.85rem;
		border-radius: 5px;
	}
	.seg-btn:hover {
		color: var(--content);
		background: transparent;
	}
	.seg-btn.active {
		background: var(--base-1);
		color: var(--content);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
	}
	.filters input {
		flex: 1;
		min-width: 190px;
	}
	.review-pill {
		background: color-mix(in oklch, var(--warning) 14%, var(--base-1));
		border-color: color-mix(in oklch, var(--warning) 55%, var(--edge-1));
		color: var(--content);
		font-size: 0.76rem;
		padding: 0.35rem 0.65rem;
		border-radius: 999px;
	}
	.review-pill.active {
		background: var(--content);
		border-color: var(--content);
		color: var(--base-1);
	}
	.table-scroll {
		overflow-x: auto;
		container-type: inline-size;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.825rem;
	}
	thead {
		background: var(--base-2);
		position: sticky;
		inset-block-start: 0;
		z-index: 1;
	}
	th {
		font-weight: 500;
		font-size: 0.74rem;
		color: var(--content-1);
	}
	th,
	td {
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--edge);
		vertical-align: middle;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	tbody tr:hover {
		background: color-mix(in oklch, var(--base-2) 45%, var(--base-1));
	}
	.muted-row {
		opacity: 0.78;
	}
	.date {
		white-space: nowrap;
		color: var(--content-1);
		width: 96px;
		font-variant-numeric: tabular-nums;
	}
	.merchant-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
	.merchant {
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.flow-badge {
		font-size: 0.66rem;
		font-weight: 500;
		padding: 0.08rem 0.4rem;
		border-radius: 999px;
		background: var(--base-2);
		border: 1px solid var(--edge-1);
		color: var(--content-1);
	}
	td small {
		display: block;
		font-size: 0.7rem;
		margin-top: 0.12rem;
		overflow-wrap: anywhere;
	}
	.category-cell {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 220px;
	}
	.category-cell > :global(.combobox) {
		flex: 1;
		max-width: 240px;
	}
	.number {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
	}
	.credit {
		color: color-mix(in oklch, var(--success) 70%, var(--content));
	}
	.muted-amount {
		color: var(--content-1);
		font-weight: 400;
	}
	.table-footer {
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--edge);
		font-size: 0.75rem;
	}
	.empty {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--content-1);
	}
	.empty-state {
		display: grid;
		justify-items: center;
		text-align: center;
		padding: 5rem 1rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--base-1);
	}
	.empty-mark {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 10px;
		font-size: 1.7rem;
		padding: 0.7rem 1rem;
		margin-bottom: 1.25rem;
	}
	.empty-state p {
		font-size: 0.875rem;
		color: var(--content-1);
		margin: 0.75rem 0 1.5rem;
	}
	.empty-state small {
		font-size: 0.75rem;
		margin-top: 1.25rem;
	}
	.privacy {
		text-align: center;
		font-size: 0.72rem;
		margin-top: 1.5rem;
	}
	.notice {
		font-size: 0.8rem;
		background: var(--base-2);
		border: 1px solid var(--edge);
		padding: 0.7rem 0.9rem;
		border-radius: 8px;
		margin: 0.75rem 0;
		overflow-wrap: anywhere;
	}
	.error {
		border-color: var(--error);
	}
	.settings-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}
	.settings-side {
		display: grid;
		gap: 1.25rem;
	}
	.workspace-section {
		padding: 1.25rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--base-1);
	}
	.section-heading,
	.category-heading {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.category-reset {
		margin: 0.75rem 0 1rem;
		padding: 1rem;
		border: 1px solid var(--edge);
		border-radius: 8px;
		background: var(--base-2);
	}
	.category-reset p {
		font-size: 0.8rem;
		line-height: 1.6;
		color: var(--content-1);
		margin: 0.65rem 0;
	}
	.reset-option {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.8rem;
		color: var(--content);
		margin: 0.85rem 0;
	}
	.reset-option input {
		width: 15px;
		height: 15px;
		min-height: 0;
		padding: 0;
		flex: 0 0 auto;
	}
	.rule-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.rule-list li {
		display: flex;
		gap: 1rem;
		align-items: center;
		border-bottom: 1px solid var(--edge);
		padding: 0.65rem 0;
		font-size: 0.8rem;
	}
	.rule-list li:last-child {
		border-bottom: 0;
	}
	.rule-list li > :first-child {
		flex: 1;
		overflow-wrap: anywhere;
	}
	.rule-list small {
		display: block;
		font-size: 0.7rem;
		margin-top: 0.15rem;
	}
	.danger-zone {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--edge);
		display: flex;
		justify-content: flex-end;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	fieldset:disabled {
		opacity: 0.55;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	[hidden] {
		display: none;
	}

	@container (width < 600px) {
		thead {
			display: none;
		}
		tbody tr {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.25rem 0.5rem;
			padding: 0.7rem 0.75rem;
			border-bottom: 1px solid var(--edge);
		}
		tbody tr:last-child {
			border-bottom: 0;
		}
		td {
			padding: 0;
			border-bottom: 0;
			min-width: 0;
		}
		.date {
			grid-column: 1;
			grid-row: 2;
			width: auto;
			font-size: 0.72rem;
		}
		.merchant-col {
			grid-column: 1;
			grid-row: 1;
		}
		.category-td {
			grid-column: 1 / -1;
			grid-row: 3;
			padding-top: 0.35rem;
		}
		.number {
			grid-column: 2;
			grid-row: 1;
		}
		.category-cell {
			min-width: 0;
			flex-wrap: wrap;
		}
		.category-cell > :global(.combobox) {
			max-width: none;
		}
	}

	@media (max-width: 860px) {
		.settings-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.ledger {
			padding: 1.25rem 0.75rem 5rem;
		}
		.workspace-section {
			padding: 1rem;
		}
		.filters select {
			flex: 1;
			min-width: 135px;
		}
		.filters input {
			flex-basis: 100%;
		}
		.table-footer {
			flex-wrap: wrap;
		}
	}
</style>
