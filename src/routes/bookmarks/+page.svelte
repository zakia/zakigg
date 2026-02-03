<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Temporal } from 'temporal-polyfill';
	import { bookmarks } from './bookmarks';
	import Tasks from '$lib/components/Tasks.svelte';

	function getFaviconUrl(url: string) {
		try {
			const domain = new URL(url).host;
			return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
		} catch {
			return ''; // Return empty string if URL is invalid
		}
	}

	const cities = [
		// { name: 'Toronto', timezone: 'America/Toronto', flag: '🇨🇦' },
		{ name: 'PST', timezone: 'America/Los_Angeles', flag: '🇺🇸' },
		{ name: 'Berlin', timezone: 'Europe/Berlin', flag: '🇩🇪' },
		{ name: 'Cairo', timezone: 'Africa/Cairo', flag: '🇪🇬' },
		{ name: 'Dubai', timezone: 'Asia/Dubai', flag: '🇦🇪' },
		{ name: 'Shanghai', timezone: 'Asia/Shanghai', flag: '🇨🇳' }
	];

	const times = $derived.by(() => {
		return cities
			.map(({ name, timezone, flag }) => {
				const temporalObject = Temporal.Now.zonedDateTimeISO(timezone);
				const difference = Temporal.Now.zonedDateTimeISO()
					.toPlainDateTime()
					.until(temporalObject.toPlainDateTime())
					.round({
						largestUnit: 'hour',
						smallestUnit: 'minute'
					})
					.total({
						unit: 'hour'
					});
				const timeString = temporalObject.toLocaleString('en-US', { timeStyle: 'short' });
				const dateString = temporalObject.toLocaleString('en-US', { dateStyle: 'short' });
				const { offset, timeZoneId } = temporalObject;

				return { name, timeString, dateString, offset, timeZoneId, flag, difference };
			})
			.sort((a, b) => {
				const offsetA = parseInt(a.offset.replace(':', ''));
				const offsetB = parseInt(b.offset.replace(':', ''));
				return offsetA - offsetB;
			});
	});
</script>

<div class="page-grid">
	<div class="flex flex-col items-center gap-s0">
		<div class="flex flex-col items-center gap-s-4">
			<div class="text-s2 font-bold">
				{Temporal.Now.zonedDateTimeISO().toLocaleString('en-US', { timeStyle: 'short' })}
			</div>
			<div>
				{Temporal.Now.zonedDateTimeISO().toLocaleString('en-US', {
					day: 'numeric',
					month: 'short',
					weekday: 'short'
				})}
			</div>
		</div>

		<div class="flex flex-wrap justify-start gap-s0">
			{#each times as time}
				<div
					class="bg-base-1 flex flex-col items-center gap-s-4 rounded-md p-s-2 text-center shadow ring ring-current/10"
				>
					<div class="text-s1 font-medium">
						{time.timeString}
					</div>
					<div>
						<div>
							{time.name}
						</div>
						<div class="text-s-1 font-light">
							{time.difference > 0 ? `+${time.difference} hr` : `${time.difference} hr`}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<Tasks />

	<div class="bookmarks-section">
		<div class="bg-base-1/50 flex flex-wrap gap-s0 rounded-md p-s0 shadow ring-2 ring-current/10">
			{#each Object.entries(bookmarks) as [category, items]}
				{#if items.length > 0}
					<div class="w-fit rounded-md p-s-2">
						<h2 class="text-center text-s0 font-medium capitalize underline">{category}</h2>
						<div class="grid grid-cols-2 gap-s-2">
							{#each items as bookmark}
								<a href={bookmark.url} class="btn flex items-center rounded-md p-s-2">
									<Icon icon={bookmark.icon} class="text-brand h-10 w-10 drop-shadow-2xl" />
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.page-grid {
		--grid-size: var(--s2);
		display: flex;
		flex-wrap: wrap;
		gap: var(--s2);
		padding: var(--s0);
	}
</style>
