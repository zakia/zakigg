<script lang="ts">
	import Icon from '@iconify/svelte';
	import { bookmarks, categories } from './bookmarks';
	import { Temporal } from 'temporal-polyfill';

	function getFaviconUrl(url: string) {
		try {
			const domain = new URL(url).host;
			return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
		} catch {
			return ''; // Return empty string if URL is invalid
		}
	}

	const groupedBookmarks = Object.entries(categories).reduce(
		(acc, [key, label]) => {
			acc[label] = bookmarks.filter((bookmark) => bookmark.tags.includes(label));
			return acc;
		},
		{} as Record<string, typeof bookmarks>
	);

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
				const { offset, timeZone } = temporalObject.getISOFields();

				return { name, timeString, dateString, offset, timeZone, flag, difference };
			})
			.sort((a, b) => {
				const offsetA = parseInt(a.offset.replace(':', ''));
				const offsetB = parseInt(b.offset.replace(':', ''));
				return offsetA - offsetB;
			});
	});
</script>

<div class="mx-auto flex flex-col justify-center p-4">
	<div class="mb-8 flex flex-col items-center gap-4">
		<div class="flex flex-col items-center gap-1">
			<div class="text-2xl font-bold">
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

		<div class="flex flex-wrap justify-center gap-4">
			{#each times as time}
				<div
					class="flex flex-col items-center gap-1 rounded-lg border border-current/10 shadow p-2 text-center"
				>
					<div class="text-xl font-medium">
						{time.timeString}
					</div>
					<div>
						<div>
							{time.name}
						</div>
						<div class="text-sm font-light">
							{time.difference > 0 ? `+${time.difference} hr` : `${time.difference} hr`}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap justify-center gap-4">
		{#each Object.entries(groupedBookmarks) as [category, items]}
			{#if items.length > 0}
				<div class="w-fit rounded-lg p-2 ring ring-current/10">
					<h2 class="mb-2 text-lg font-light">{category}</h2>
					<div class="flex flex-wrap">
						{#each items as bookmark}
							<a href={bookmark.url} class="btn flex items-center rounded-lg p-2">
								<Icon icon={bookmark.icon} class=" text-primary h-10 w-10 drop-shadow-2xl" />
							</a>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>
