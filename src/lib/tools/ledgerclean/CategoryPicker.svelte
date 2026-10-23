<script lang="ts">
	import ComboboxInput from '$lib/components/ComboboxInput.svelte';
	import type { BudgetOverride } from './activity';
	import { categoryList, categoryPath, type CategoryDictionary } from './category-model';

	const TRANSFER_OPTION_ID = '__budget:transfer__';
	const EXCLUDE_OPTION_ID = '__budget:exclude__';

	let {
		categories,
		value = '',
		budgetOverride = null,
		label,
		placeholder = 'Search categories…',
		disabled = false,
		onChange,
		onBudgetChange
	}: {
		categories: CategoryDictionary;
		value?: string;
		budgetOverride?: BudgetOverride;
		label: string;
		placeholder?: string;
		disabled?: boolean;
		onChange: (id: string) => void;
		onBudgetChange?: (override: BudgetOverride) => void;
	} = $props();
	const uid = $props.id();
	let open = $state(false);
	let query = $state('');
	let highlightedIndex = $state(0);
	let inputEl = $state<HTMLInputElement>();

	const baseOptions = $derived([
		...categoryList(categories).map((category) => ({
			id: category.id,
			label: categoryPath(categories, category.id)
		})),
		...(onBudgetChange
			? [
					{ id: TRANSFER_OPTION_ID, label: 'Transfer · exclude from totals' },
					{ id: EXCLUDE_OPTION_ID, label: 'Exclude from budget' }
				]
			: [])
	]);

	const options = $derived(
		baseOptions.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
	);

	const activeOptionId = $derived(
		budgetOverride === 'transfer'
			? TRANSFER_OPTION_ID
			: budgetOverride === 'exclude'
				? EXCLUDE_OPTION_ID
				: value
	);

	const displayValue = $derived(
		budgetOverride === 'transfer'
			? 'Transfer · excluded'
			: budgetOverride === 'exclude'
				? 'Excluded from budget'
				: value
					? categoryPath(categories, value)
					: ''
	);

	const accentColor = $derived(
		budgetOverride === 'transfer'
			? '#7baab9'
			: budgetOverride === 'exclude'
				? 'var(--content-1)'
				: (categories[value]?.color ?? 'var(--edge-1)')
	);

	function close() {
		open = false;
		query = '';
	}
	function choose(id: string) {
		close();
		if (id === TRANSFER_OPTION_ID) {
			onBudgetChange?.('transfer');
		} else if (id === EXCLUDE_OPTION_ID) {
			onBudgetChange?.('exclude');
		} else {
			if (budgetOverride && onBudgetChange) onBudgetChange(null);
			onChange(id);
		}
		inputEl?.blur();
	}
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			inputEl?.blur();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!open) {
				open = true;
				highlightedIndex = 0;
			} else if (options.length)
				highlightedIndex =
					(highlightedIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
					options.length;
		} else if (event.key === 'Enter' && open) {
			event.preventDefault();
			if (options[highlightedIndex]) choose(options[highlightedIndex].id);
		}
	}
</script>

<ComboboxInput
	{options}
	value={open ? query : displayValue}
	{open}
	{highlightedIndex}
	listboxId={`${uid}-categories`}
	{label}
	bind:inputEl
	{disabled}
	{placeholder}
	escapeClipping
	emptyText="No matching categories"
	style={`font-size:0.8125rem;font-weight:450;min-height:2.1rem;padding:0.4rem 0.6rem;border:1px solid var(--edge-1);border-left:3.5px solid ${accentColor};border-radius:6px;background:var(--base-1);`}
	onInput={(text) => {
		query = text;
		open = true;
		highlightedIndex = 0;
	}}
	onFocus={() => {
		query = '';
		open = true;
		highlightedIndex = Math.max(
			0,
			options.findIndex((option) => option.id === activeOptionId)
		);
	}}
	onBlur={close}
	onKeydown={keydown}
	onSelect={choose}
	onHighlight={(index) => (highlightedIndex = index)}
/>
