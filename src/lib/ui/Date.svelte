<script lang="ts">
	import { Temporal } from 'temporal-polyfill';

	interface Props {
		weekStartsOn?: 'sunday' | 'monday';
		locale?: string;
	}

	let { weekStartsOn = 'sunday', locale = 'en-US' }: Props = $props();

	// State for the currently displayed month and year
	let currentDate = $state(Temporal.Now.plainDateISO());

	// Get month and year from current date
	const currentMonth = $derived(currentDate.month);
	const currentYear = $derived(currentDate.year);

	// Get month name using Temporal API
	const monthName = $derived.by(() => {
		return currentDate.toLocaleString(locale, { month: 'long' });
	});

	// Get day names using Temporal API - properly calculate from any date
	const dayNames = $derived.by(() => {
		// Use any date (we'll use the first day of current month)
		const anyDate = Temporal.PlainDate.from({
			year: currentYear,
			month: currentMonth,
			day: 1
		});

		// Temporal dayOfWeek: 1=Monday, 2=Tuesday, ..., 7=Sunday
		// Find the first day of the week based on weekStartsOn
		const firstDayOfWeek = weekStartsOn === 'sunday' ? 7 : 1; // 7=Sunday, 1=Monday
		const currentDayOfWeek = anyDate.dayOfWeek;

		// Calculate how many days to go back to reach the first day of the week
		let daysToSubtract = currentDayOfWeek - firstDayOfWeek;
		if (daysToSubtract < 0) {
			daysToSubtract += 7;
		}

		// Get the first day of the week
		const firstDay = anyDate.subtract({ days: daysToSubtract });

		// Generate all 7 day names
		return Array.from({ length: 7 }, (_, i) => {
			const day = firstDay.add({ days: i });
			return day.toLocaleString(locale, { weekday: 'short' });
		});
	});

	// Get all days to display in the calendar grid
	const calendarDays = $derived.by(() => {
		const firstDayOfMonth = Temporal.PlainDate.from({
			year: currentYear,
			month: currentMonth,
			day: 1
		});

		// Temporal dayOfWeek: 1=Monday, 2=Tuesday, ..., 7=Sunday
		const firstDayOfWeek = weekStartsOn === 'sunday' ? 7 : 1;
		const currentDayOfWeek = firstDayOfMonth.dayOfWeek;

		// Calculate how many days to go back to reach the first day of the week
		let daysToSubtract = currentDayOfWeek - firstDayOfWeek;
		if (daysToSubtract < 0) {
			daysToSubtract += 7;
		}

		// Get the first day to display in the calendar (might be from previous month)
		const calendarStart = firstDayOfMonth.subtract({ days: daysToSubtract });

		// Get number of days in the month
		const daysInMonth = firstDayOfMonth.daysInMonth;

		const days: Array<{ day: number; isCurrentMonth: boolean; date: Temporal.PlainDate }> = [];

		// Generate 42 days (6 weeks * 7 days) starting from calendarStart
		for (let i = 0; i < 42; i++) {
			const date = calendarStart.add({ days: i });
			const isCurrentMonth = date.year === currentYear && date.month === currentMonth;
			days.push({
				day: date.day,
				isCurrentMonth,
				date
			});
		}

		return days;
	});

	// Check if a date is today
	const isToday = (date: Temporal.PlainDate) => {
		const today = Temporal.Now.plainDateISO();
		return date.year === today.year && date.month === today.month && date.day === today.day;
	};

	// Navigation functions
	const goToPreviousMonth = () => {
		currentDate = currentDate.subtract({ months: 1 });
	};

	const goToNextMonth = () => {
		currentDate = currentDate.add({ months: 1 });
	};

	const goToToday = () => {
		currentDate = Temporal.Now.plainDateISO();
	};
</script>

<div class="datepicker">
	<!-- Header with month/year and navigation -->
	<div class="flex">
		<button
			type="button"
			onclick={goToPreviousMonth}
			class="nav-button"
			aria-label="Previous month"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M10 12 L6 8 L10 4" />
			</svg>
		</button>

		<div class="datepicker-title">
			<span class="month-year">{monthName} {currentYear}</span>
			<button type="button" onclick={goToToday} class="today-button" aria-label="Go to today">
				Today
			</button>
		</div>

		<button type="button" onclick={goToNextMonth} class="nav-button" aria-label="Next month">
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M6 12 L10 8 L6 4" />
			</svg>
		</button>
	</div>

	<!-- Day names header -->
	<div class="grid grid-cols-7 gap-2">
		{#each dayNames as dayName}
			<div class="weekday">{dayName}</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7 gap-2">
		{#each calendarDays as { day, isCurrentMonth, date }}
			<button
				type="button"
				class="datepicker-day"
				class:current-month={isCurrentMonth}
				class:today={isToday(date)}
				aria-label={date.toLocaleString(locale, { dateStyle: 'full' })}
			>
				{day}
			</button>
		{/each}
	</div>
</div>
