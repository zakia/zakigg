<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let file = $state<File | undefined>();

	console.log(form?.fields);
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
	{#if !form?.fields}
		<form
			class="grid gap-2"
			method="post"
			use:enhance={({ formElement, formData, action, cancel, submitter }) => {
				// `formElement` is this `<form>` element
				// `formData` is its `FormData` object that's about to be submitted
				// `action` is the URL to which the form is posted
				// calling `cancel()` will prevent the submission
				// `submitter` is the `HTMLElement` that caused the form to be submitted

				return async ({ result, update }) => {
					update({ reset: false });
					file = formData.get('pdf') as File;
					// `result` is an `ActionResult` object
					// `update` is a function which triggers the default logic that would be triggered if this callback wasn't set
				};
			}}
			enctype="multipart/form-data"
			action="/pdf-form?/get"
		>
			<input type="file" name="pdf" accept=".pdf" class="input" required />
			<button type="submit" class="btn variant-primary place-self-center">Submit</button>
		</form>
	{/if}
	{#if form?.fields}
		<form
			class="grid gap-2"
			method="post"
			onsubmit={async (e) => {
				e.preventDefault();
				const formData = new FormData(e.target as HTMLFormElement);
				if (!file) {
					console.error('No file selected');
					return;
				}
				formData.append('pdf', file);
				const pdf = await fetch('/api/pdf', {
					method: 'POST',
					body: formData
				});
				if (!pdf.ok) {
					console.error('Failed to fill PDF');
					console.log(pdf.statusText);
					return;
				}
				const myLink = document.createElement('a');
				myLink.href = window.URL.createObjectURL(await pdf.blob());
				myLink.download = 'filled.pdf';
				myLink.click();
			}}
		>
			<div class="grid grid-cols-2 gap-4">
				{#each form.fields as field}
					<div class="grid">
						<div class="flex items-center justify-between gap-4">
							<b>
								{field?.name}
							</b>
							<span class="text-sm opacity-50">{field?.type}</span>
						</div>
						<div class="flex gap-4">
							{#if field.type === 'PDFCheckBox'}
								<label>
									<input type="checkbox" name={field.name} />
								</label>
							{:else if field.type === 'PDFRadioGroup'}
								{#each field?.options || [] as option}
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
				<button type="reset" class="variant-base btn" onclick={() => (form = null)}>Reset</button>
			</div>
		</form>
	{/if}
</section>
