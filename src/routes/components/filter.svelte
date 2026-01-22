<script lang="ts">
	type Props = {
		options: { label: string; value: string }[];
		selected: string;
		placeholder?: string;
		onSelect?: (value: string) => void;
	};

	let { options, selected, placeholder = 'Search options...', onSelect }: Props = $props();

	let searchValue = $state(selected);
	let filteredOptions = $state(options);
	let selectedIndex = $state(-1);
	let inputElement: HTMLInputElement;

	// Filter options based on search input
	function filterOptions(search: string) {
		if (!search.trim()) {
			return options;
		}
		return options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));
	}

	// Handle search input changes
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchValue = target.value;
		filteredOptions = filterOptions(searchValue);
		selectedIndex = -1;
	}

	// Handle option selection
	function selectOption(option: string) {
		searchValue = option;
		selected = option;
		onSelect?.(option);
		selectedIndex = -1;
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredOptions.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
					selectOption(filteredOptions[selectedIndex].value);
				}
				break;
		}
	}
</script>

<div class="relative w-full max-w-sm">
	<input
		bind:this={inputElement}
		type="text"
		value={searchValue}
		{placeholder}
		role="combobox"
		aria-expanded="false"
		aria-autocomplete="list"
		aria-controls="filter-popover"
		aria-activedescendant={selectedIndex >= 0 ? `option-${selectedIndex}` : undefined}
		oninput={handleSearchInput}
		onkeydown={handleKeydown}
		onfocus={() => {
			if (filteredOptions.length > 0) {
				// Trigger popover to show
				const popover = document.getElementById('filter-popover');
				if (popover) popover.showPopover();
			}
		}}
		class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		style="anchor-name: --filter-anchor"
	/>

	<div
		id="filter-popover"
		popover="auto"
		role="listbox"
		aria-label="Options"
		class="mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
		style="position-anchor: --filter-anchor"
	>
		{#if filteredOptions.length > 0}
			{#each filteredOptions as option, index}
				<button
					id="option-{index}"
					role="option"
					aria-selected={index === selectedIndex}
					class="w-full cursor-pointer bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-150 first:rounded-t-md last:rounded-b-md hover:bg-gray-50 focus:bg-gray-100 focus:outline-none {index ===
					selectedIndex
						? 'bg-blue-50 text-blue-700'
						: ''}"
					onclick={() => selectOption(option.value)}
					onmouseenter={() => (selectedIndex = index)}
				>
					{option.label}
				</button>
			{/each}
		{:else if searchValue.trim()}
			<div class="px-3 py-2 text-center text-sm text-gray-500 italic">No options found</div>
		{/if}
	</div>
</div>
