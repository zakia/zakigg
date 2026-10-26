<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDate, formatMonth } from '#lib/utils/date.js';
	import { type MonthSpending, type MonthSummary } from './processing';
	import { type CategoryDictionary } from './category-model';

	let {
		months,
		calendarMonths = [],
		summary,
		prior,
		allMonths = false,
		reviewCount = 0,
		reviewFilterActive = false,
		tagFilterLabel = '',
		categoryDictionary,
		year,
		years,
		currency,
		currencies,
		selectedMonth,
		selectedCategory,
		onCategorySelect,
		onMonthSelect,
		onAllMonthsToggle = () => {},
		onReviewToggle = () => {},
		onYearChange,
		onCurrencyChange
	}: {
		months: MonthSpending[];
		calendarMonths?: MonthSummary[];
		summary?: { spendingCents: number; incomeCents: number; netCents: number };
		prior?: { month: string; spendingCents: number };
		allMonths?: boolean;
		reviewCount?: number;
		reviewFilterActive?: boolean;
		tagFilterLabel?: string;
		categoryDictionary: CategoryDictionary;
		year: string;
		years: string[];
		currency: string;
		currencies: string[];
		selectedMonth: string;
		selectedCategory: string;
		onCategorySelect: (categoryId: string) => void;
		onMonthSelect: (month: string) => void;
		onAllMonthsToggle?: (all: boolean) => void;
		onReviewToggle?: () => void;
		onYearChange: (year: string) => void;
		onCurrencyChange: (currency: string) => void;
	} = $props();

	let plotElement: HTMLDivElement;
	let width = $state(960);
	let hoveredMonth = $state<string | null>(null);
	const height = 250;
	const top = 16;
	const bottom = 216;
	const left = 58;
	const right = 12;
	const slot = $derived((width - left - right) / 12);
	const barWidth = $derived(Math.min(44, slot * 0.62));

	const yearRollup = $derived.by((): MonthSpending => {
		const totals = new Map<string, number>();
		let count = 0;
		let spendingCents = 0;
		for (const m of months) {
			count += m.count;
			spendingCents += m.spendingCents;
			for (const entry of m.categories) {
				totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? 0) + entry.amountCents);
			}
		}
		return {
			month: year,
			count,
			spendingCents,
			categories: [...totals.entries()].map(([categoryId, amountCents]) => ({
				categoryId,
				amountCents
			}))
		};
	});

	const detail = $derived(
		months.find((entry) => entry.month === hoveredMonth) ??
			(allMonths ? yearRollup : months.find((entry) => entry.month === selectedMonth))
	);
	const categories = $derived(
		Object.keys(categoryDictionary).filter((category) =>
			months.some((month) => month.categories.some((entry) => entry.categoryId === category))
		)
	);
	const trail = $derived.by(() => {
		const ids: string[] = [];
		let id = selectedCategory;
		while (categoryDictionary[id] && !ids.includes(id)) {
			ids.unshift(id);
			id = categoryDictionary[id].parentId ?? '';
		}
		return ids;
	});
	const hasChildren = $derived(
		Object.values(categoryDictionary).some((category) => category.parentId === selectedCategory)
	);
	const monthIndex = $derived(calendarMonths.findIndex((entry) => entry.month === selectedMonth));

	function categoryName(id: string) {
		const name = categoryDictionary[id]?.name ?? 'Uncategorized';
		return id === selectedCategory && hasChildren ? `Directly in ${name}` : name;
	}
	const scale = $derived.by(() => {
		const positive = Math.max(
			0,
			...months.map((month) =>
				month.categories.reduce((total, entry) => total + Math.max(0, entry.amountCents), 0)
			)
		);
		const negative = Math.max(
			0,
			...months.map((month) =>
				month.categories.reduce((total, entry) => total + Math.max(0, -entry.amountCents), 0)
			)
		);
		const step = tickStep(Math.max(positive, negative, 100));
		const max = Math.ceil(positive / step) * step || (negative ? 0 : 100);
		const negativeStep = tickStep(Math.max(negative, 1));
		const min = -Math.ceil(negative / negativeStep) * negativeStep;
		const firstTick = Math.ceil(min / step) * step;
		return {
			min,
			max,
			ticks: Array.from(
				{ length: Math.round((max - firstTick) / step) + 1 },
				(_, index) => firstTick + index * step
			)
		};
	});
	const bars = $derived(
		months.map((month, index) => {
			let positive = 0;
			let negative = 0;
			const segments = month.categories
				.filter((entry) => entry.amountCents !== 0)
				.map((entry) => {
					const start = entry.amountCents > 0 ? positive : negative;
					const end = start + entry.amountCents;
					if (entry.amountCents > 0) positive = end;
					else negative = end;
					return { ...entry, y: y(Math.max(start, end)), height: Math.abs(y(start) - y(end)) };
				});
			return { ...month, center: left + slot * (index + 0.5), segments };
		})
	);

	onMount(() => {
		const observer = new ResizeObserver(([entry]) => {
			width = Math.max(300, entry.contentRect.width);
		});
		observer.observe(plotElement);
		return () => observer.disconnect();
	});
	function tickStep(value: number): number {
		const target = value / 5;
		const magnitude = 10 ** Math.floor(Math.log10(target));
		return Math.max(
			1,
			[1, 2, 2.5, 5, 10].find((multiple) => multiple * magnitude >= target)! * magnitude
		);
	}
	function y(value: number): number {
		return top + ((scale.max - value) / (scale.max - scale.min)) * (bottom - top);
	}
	function money(cents: number, axis = false): string {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency,
			...(axis
				? {
						notation: 'compact',
						maximumFractionDigits: Math.abs(cents) < 100 ? 2 : 1,
						minimumFractionDigits: 0
					}
				: {})
		}).format(cents / 100);
	}
	function monthName(month: string): string {
		return formatDate(`${month}-01`, { month: 'short' });
	}
	const spendingLabel = $derived(
		selectedCategory
			? `${categoryDictionary[selectedCategory]?.name ?? 'Category'} spending`
			: tagFilterLabel
				? `${tagFilterLabel} spending`
				: 'Net spending'
	);
</script>

<section class="overview-card" aria-label="Yearly spending overview">
	<header class="overview-header">
		<div class="period-controls">
			{#if calendarMonths.length}
				<div class="month-stepper" class:dimmed={allMonths}>
					<button
						type="button"
						class="step-btn"
						aria-label="Previous imported month"
						disabled={monthIndex >= calendarMonths.length - 1}
						onclick={() => {
							onAllMonthsToggle(false);
							onMonthSelect(calendarMonths[monthIndex + 1].month);
						}}>‹</button
					>
					<select
						aria-label="Month"
						value={selectedMonth}
						onchange={(event) => {
							onAllMonthsToggle(false);
							onMonthSelect(event.currentTarget.value);
						}}
					>
						{#each calendarMonths as entry (entry.month)}<option value={entry.month}
								>{formatMonth(entry.month)}</option
							>{/each}
					</select>
					<button
						type="button"
						class="step-btn"
						aria-label="Next imported month"
						disabled={monthIndex <= 0}
						onclick={() => {
							onAllMonthsToggle(false);
							onMonthSelect(calendarMonths[monthIndex - 1].month);
						}}>›</button
					>
				</div>
				<button
					type="button"
					class="scope-pill"
					class:active={allMonths}
					aria-pressed={allMonths}
					onclick={() => onAllMonthsToggle(!allMonths)}
				>
					All months
				</button>
			{/if}
		</div>
		<div class="controls">
			{#if years.length > 1}
				<select
					aria-label="Spending year"
					value={year}
					onchange={(event) => {
						hoveredMonth = null;
						onYearChange(event.currentTarget.value);
					}}
				>
					{#each years as option (option)}<option>{option}</option>{/each}
				</select>
			{/if}
			{#if currencies.length > 1}
				<select
					aria-label="Display currency"
					value={currency}
					onchange={(event) => {
						hoveredMonth = null;
						onCurrencyChange(event.currentTarget.value);
					}}
				>
					{#each currencies as code (code)}<option>{code}</option>{/each}
				</select>
			{:else}
				<span class="currency-pill">{currency}</span>
			{/if}
		</div>
	</header>

	{#if summary}
		<div class="kpi-grid" aria-label="Selected period totals">
			<div class="kpi-card primary-kpi">
				<span class="kpi-label">{spendingLabel}</span>
				<strong class="kpi-value">{money(summary.spendingCents)}</strong>
				{#if !allMonths && prior && !selectedCategory}
					<span class="kpi-sub">
						{#if summary.spendingCents === prior.spendingCents}
							No change vs. {formatMonth(prior.month, true)}
						{:else}
							{money(Math.abs(summary.spendingCents - prior.spendingCents))}
							{summary.spendingCents > prior.spendingCents ? 'more' : 'less'} vs.
							{formatMonth(prior.month, true)}
						{/if}
					</span>
				{:else}
					<span class="kpi-sub"
						>{allMonths ? 'Across all imported months' : formatMonth(selectedMonth)}</span
					>
				{/if}
			</div>

			{#if !selectedCategory && !tagFilterLabel}
				<div class="kpi-card">
					<span class="kpi-label">Income</span>
					<strong class="kpi-value">{money(summary.incomeCents)}</strong>
					<span class="kpi-sub">Money in</span>
				</div>
				<div class="kpi-card">
					<span class="kpi-label">Remaining</span>
					<strong
						class="kpi-value"
						class:positive={summary.netCents > 0}
						class:negative={summary.netCents < 0}>{money(summary.netCents)}</strong
					>
					<span class="kpi-sub">Net cashflow</span>
				</div>
			{/if}

			<button
				type="button"
				class="kpi-card review-kpi"
				class:needs-attention={reviewCount > 0}
				class:active={reviewFilterActive}
				aria-pressed={reviewFilterActive}
				onclick={onReviewToggle}
			>
				<span class="kpi-label">Needs review</span>
				<strong class="kpi-value">{reviewCount}</strong>
				<span class="kpi-sub">
					{#if reviewFilterActive}
						Showing uncategorized · click to clear
					{:else if reviewCount > 0}
						Filter uncategorized transactions →
					{:else}
						All categorized ✓
					{/if}
				</span>
			</button>
		</div>
	{/if}

	{#if trail.length}
		<nav class="breadcrumbs" aria-label="Spending category path">
			<button
				type="button"
				onclick={() => {
					hoveredMonth = null;
					onCategorySelect('');
				}}>All spending</button
			>
			{#each trail as id, index (id)}<span aria-hidden="true">›</span><button
					type="button"
					aria-current={index === trail.length - 1 ? 'location' : undefined}
					disabled={index === trail.length - 1}
					onclick={() => {
						hoveredMonth = null;
						onCategorySelect(id);
					}}>{categoryDictionary[id].name}</button
				>{/each}
		</nav>
	{/if}

	<div class="plot" bind:this={plotElement}>
		<svg
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label={`${year} monthly net spending by ${selectedCategory ? categoryDictionary[selectedCategory]?.name : 'category'} in ${currency}. Select a month below to inspect its transactions.`}
		>
			{#each scale.ticks as value (value)}
				<line
					x1={left}
					x2={width - right}
					y1={y(value)}
					y2={y(value)}
					class:baseline={value === 0}
				/>
				<text x={left - 10} y={y(value) + 4} text-anchor="end" class="axis"
					>{money(value, true)}</text
				>
			{/each}
			{#each bars as bar (bar.month)}
				{#if (!allMonths && bar.month === selectedMonth) || bar.month === hoveredMonth}<rect
						class="column-highlight"
						x={bar.center - slot / 2 + 2}
						y={top - 8}
						width={slot - 4}
						height={height - top}
						rx="6"
					/>{/if}
				{#each bar.segments as segment (segment.categoryId)}<rect
						x={bar.center - barWidth / 2}
						y={segment.y}
						width={barWidth}
						height={segment.height}
						fill={categoryDictionary[segment.categoryId]?.color}
						><title
							>{formatMonth(bar.month)} · {categoryName(segment.categoryId)}: {money(
								segment.amountCents
							)}</title
						></rect
					>{/each}
				{#if !bar.count}<text x={bar.center} y={y(0) - 9} text-anchor="middle" class="missing"
						><title>No imported records</title>—</text
					>{:else if !bar.segments.length}<circle
						cx={bar.center}
						cy={y(0)}
						r="2.5"
						class="zero"
					/>{/if}
				<text
					x={bar.center}
					y={height - 10}
					transform={width < 600 ? `rotate(-35 ${bar.center} ${height - 10})` : undefined}
					text-anchor="middle"
					class:selected={!allMonths && bar.month === selectedMonth}
					class="month-label">{monthName(bar.month)}</text
				>
			{/each}
		</svg>
		<div class="month-targets" role="group" aria-label="Select a month to review transactions">
			{#each bars as bar (bar.month)}<button
					type="button"
					class="month-target"
					aria-label={`${formatMonth(bar.month)}: ${bar.count ? `${money(bar.spendingCents)} net spending. View this month’s ${selectedCategory ? categoryDictionary[selectedCategory]?.name + ' ' : ''}transactions.` : 'No imported records.'}`}
					aria-pressed={!allMonths && bar.month === selectedMonth}
					disabled={!bar.count}
					style:left={`${((bar.center - slot / 2) / width) * 100}%`}
					style:width={`${(slot / width) * 100}%`}
					onpointerenter={() => (hoveredMonth = bar.month)}
					onpointerleave={() => (hoveredMonth = null)}
					onfocus={() => (hoveredMonth = bar.month)}
					onblur={() => (hoveredMonth = null)}
					onclick={() => {
						onAllMonthsToggle(false);
						onMonthSelect(bar.month);
					}}><span class="sr-only">{monthName(bar.month)}</span></button
				>{/each}
		</div>
	</div>
	<div class="month-detail" aria-label="Month spending breakdown">
		{#if detail}
			<div class="detail-heading">
				<strong
					>{detail.month.length === 4
						? `${detail.month} breakdown`
						: formatMonth(detail.month)}</strong
				>
				<span>{detail.count ? money(detail.spendingCents) : 'No imported records'}</span>
			</div>
			{#if categories.length}
				<ul class="detail-categories" aria-label="Spending categories">
					{#each categories as category (category)}
						{@const amount =
							detail.categories.find((entry) => entry.categoryId === category)?.amountCents ?? 0}
						<li>
							<button
								type="button"
								class="category-link"
								class:active-chip={category === selectedCategory}
								aria-label={`Explore ${categoryName(category)} in ${detail.month.length === 4 ? detail.month : formatMonth(detail.month)}`}
								onclick={() => {
									if (hoveredMonth) onMonthSelect(hoveredMonth);
									hoveredMonth = null;
									onCategorySelect(category === selectedCategory ? '' : category);
								}}
							>
								<span
									class="swatch"
									style:background={categoryDictionary[category]?.color}
									aria-hidden="true"
								></span><span>{categoryName(category)}</span>
								{#if amount !== 0}<strong>{money(amount)}</strong>{/if}
								{#if category !== selectedCategory}<span class="chevron" aria-hidden="true">›</span
									>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</section>

<style>
	.overview-card {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 1.25rem 1.35rem;
		margin: 0 0 1.75rem;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.03);
	}
	.overview-header,
	.period-controls,
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		flex-wrap: wrap;
	}
	.overview-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--edge);
	}
	.month-stepper {
		display: inline-flex;
		align-items: center;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 8px;
		padding: 0.15rem;
		transition: opacity 150ms ease;
	}
	.month-stepper.dimmed {
		opacity: 0.72;
	}
	.month-stepper select {
		font-size: 0.95rem;
		font-weight: 600;
		border: 0;
		background: transparent;
		padding: 0.3rem 0.5rem;
		min-height: 2rem;
		cursor: pointer;
	}
	.step-btn {
		background: transparent;
		border: 0;
		border-radius: 6px;
		color: var(--content);
		font-size: 1.15rem;
		line-height: 1;
		padding: 0.25rem 0.55rem;
		min-height: 2rem;
	}
	.step-btn:hover:not(:disabled) {
		background: var(--base-1);
	}
	.step-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.scope-pill {
		font-size: 0.8rem;
		font-weight: 500;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--edge-1);
		background: var(--base-1);
		color: var(--content-1);
		min-height: 2.25rem;
		transition:
			background-color 120ms ease,
			color 120ms ease,
			border-color 120ms ease;
	}
	.scope-pill:hover {
		color: var(--content);
		border-color: var(--content-1);
	}
	.scope-pill.active {
		background: var(--content);
		border-color: var(--content);
		color: var(--base-1);
	}
	.currency-pill {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--content-1);
		background: var(--base-2);
		border: 1px solid var(--edge);
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
	}
	select {
		font-size: 0.8rem;
		background: var(--base-1);
		color: var(--content);
		border: 1px solid var(--edge-1);
		border-radius: 7px;
		padding: 0.4rem 0.6rem;
		min-height: 2.2rem;
	}
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.75rem;
		margin: 1rem 0 0.5rem;
	}
	.kpi-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		padding: 0.85rem 1rem;
		border-radius: 9px;
		background: var(--base-2);
		border: 1px solid var(--edge);
		text-align: left;
	}
	.kpi-label {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--content-1);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.kpi-value {
		font-size: 1.35rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
		color: var(--content);
		line-height: 1.2;
	}
	.kpi-value.positive {
		color: color-mix(in oklch, var(--success) 72%, var(--content));
	}
	.kpi-sub {
		font-size: 0.74rem;
		color: var(--content-1);
	}
	.review-kpi {
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background-color 120ms ease;
	}
	.review-kpi:hover {
		border-color: var(--content-1);
	}
	.review-kpi.needs-attention {
		border-color: color-mix(in oklch, var(--warning) 60%, var(--edge-1));
		background: color-mix(in oklch, var(--warning) 10%, var(--base-2));
	}
	.review-kpi.active {
		border-color: var(--content);
		background: color-mix(in oklch, var(--content) 8%, var(--base-2));
	}
	.plot {
		position: relative;
		width: 100%;
		margin-top: 1rem;
	}
	svg {
		display: block;
		width: 100%;
		height: 250px;
		overflow: visible;
	}
	line {
		stroke: var(--edge);
		stroke-width: 1;
	}
	line.baseline {
		stroke: var(--edge-1);
	}
	text {
		fill: var(--content-1);
		font-size: 11px;
	}
	.column-highlight {
		fill: var(--base-2);
	}
	.month-label.selected {
		fill: var(--content);
		font-weight: 650;
	}
	.missing {
		fill: var(--content-1);
		opacity: 0.5;
	}
	.zero {
		fill: var(--content-1);
	}
	.month-targets {
		position: absolute;
		inset: 0;
	}
	.month-target {
		position: absolute;
		top: 8px;
		height: calc(100% - 8px);
		background: transparent;
		border: 0;
		border-radius: 5px;
		padding: 0;
	}
	.month-target:disabled {
		cursor: default;
	}
	button:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 2px;
	}
	.month-detail {
		border-top: 1px solid var(--edge);
		padding-top: 0.85rem;
		margin-top: 0.35rem;
	}
	.detail-heading {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		justify-content: space-between;
		font-size: 0.8rem;
		margin-bottom: 0.6rem;
	}
	.detail-heading strong {
		font-weight: 600;
	}
	.detail-heading span {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.detail-categories {
		display: flex;
		gap: 0.4rem 0.65rem;
		flex-wrap: wrap;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.detail-categories li {
		display: inline-flex;
		align-items: center;
		font-size: 0.74rem;
		color: var(--content-1);
	}
	.detail-categories strong {
		font-weight: 550;
		color: var(--content);
		font-variant-numeric: tabular-nums;
	}
	.breadcrumbs {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.85rem;
		font-size: 0.76rem;
		color: var(--content-1);
	}
	.breadcrumbs button,
	.category-link {
		font: inherit;
		color: inherit;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 0.25rem 0.5rem;
		text-align: left;
	}
	.breadcrumbs button:hover:not(:disabled),
	.category-link:hover:not(:disabled) {
		background: var(--base-2);
		border-color: var(--edge);
		color: var(--content);
	}
	.category-link.active-chip {
		background: var(--base-2);
		border-color: var(--content-1);
		color: var(--content);
		font-weight: 600;
	}
	.breadcrumbs button:disabled {
		color: var(--content);
		font-weight: 600;
		cursor: default;
	}
	.category-link {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		min-height: 1.85rem;
	}
	.swatch {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 2px;
		flex-shrink: 0;
	}
	.chevron {
		opacity: 0.65;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		.overview-card {
			padding: 0.9rem;
		}
		.kpi-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.kpi-value {
			font-size: 1.15rem;
		}
		.controls {
			gap: 0.35rem;
		}
		select {
			padding: 0.4rem;
		}
	}
</style>
