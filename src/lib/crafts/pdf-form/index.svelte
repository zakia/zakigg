<script lang="ts">
	import { extractFields } from './pdf.remote';

	let file = $state<File | undefined>();
	let cleared = $state(false);

	const fields = $derived(cleared ? null : (extractFields.result?.fields ?? null));

	async function handleFill(e: SubmitEvent) {
		e.preventDefault();
		if (!file) return;
		const formData = new FormData(e.target as HTMLFormElement);
		formData.append('pdf', file);
		const res = await fetch('/api/pdf', { method: 'POST', body: formData });
		if (!res.ok) {
			console.error('Failed to fill PDF');
			return;
		}
		const link = document.createElement('a');
		link.href = window.URL.createObjectURL(await res.blob());
		link.download = 'filled.pdf';
		link.click();
	}

	function reset() {
		cleared = true;
		file = undefined;
	}
</script>

<section class="layout justify-items-center gap-4">
	<div class="mb-10 grid max-w-lg gap-4">
		<h1>Automate PDF Form Filling</h1>
		<ol class="marker:font-bold">
			<li>Extract all form fields from your PDF.</li>
			<li>Fill the fields with your desired inputs.</li>
			<li>Download your fully completed PDF.</li>
		</ol>
		<p>This project serves as a foundation for automating the process of filling PDF forms.</p>
	</div>

	{#if !fields}
		<form
			{...extractFields}
			enctype="multipart/form-data"
			oninput={(e) => {
				const input = e.target as HTMLInputElement;
				if (input.type === 'file' && input.files?.[0]) {
					file = input.files[0];
					cleared = false;
				}
			}}
		>
			<div class="grid gap-2">
				<input {...extractFields.fields.pdf.as('file')} accept=".pdf" class="input" required />
				<button
					type="submit"
					class="btn variant-primary place-self-center"
					disabled={!!extractFields.pending}
				>
					{extractFields.pending ? 'Extracting...' : 'Submit'}
				</button>
			</div>
		</form>
	{:else}
		<form class="grid gap-2" onsubmit={handleFill}>
			<div class="grid grid-cols-2 gap-4">
				{#each fields as field}
					<div class="grid">
						<div class="flex items-center justify-between gap-4">
							<b>{field.name}</b>
							<span class="text-sm opacity-50">{field.type}</span>
						</div>
						<div class="flex gap-4">
							{#if field.type === 'PDFCheckBox'}
								<label>
									<input type="checkbox" name={field.name} />
								</label>
							{:else if field.type === 'PDFRadioGroup'}
								{#each field.options || [] as option}
									<label>
										{option}
										<input type="radio" name={field.name} value={option} />
									</label>
								{/each}
							{:else}
								<input type="text" class="input" name={field.name} />
							{/if}
						</div>
					</div>
				{/each}
			</div>
			<div class="grid place-items-center gap-2">
				<button type="submit" class="btn variant-primary">Get Filled PDF</button>
				<button type="button" class="variant-base btn" onclick={reset}>Reset</button>
			</div>
		</form>
	{/if}
</section>
