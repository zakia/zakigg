<script module>
	export const metadata = {
		title: 'Places',
		description: 'Adventures around the world.',
		date: '2025-01-16',
		draft: true,
		tags: ['teaching']
	};
</script>

<script>
	import Layout from '$lib/Layout.svelte';
	import { draw, random } from 'radash';

	const images = [
		'https://a0.muscache.com/im/pictures/passport/Passport-Frankfurt%2C%20DE-HE/original/9d088766-9d24-4330-ba2b-f5313121c697.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Rome%2C%20IT-62/original/6825b10a-6fd1-47c1-add7-a6b6c3a82cfa.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Florence%2C%20IT-52/original/8a052149-fd55-41b4-b8de-4ba5c04c080c.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Berlin%2C%20DE-BE/original/87215abc-86fa-4647-bb93-dc2a74929d54.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Kawartha%20Lakes%2C%20CA-ON/original/acc34a9d-f5de-4063-9b1a-7aeac0791dc9.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Granada%2C%20ES-AN/original/3f44d4d5-40c6-4d35-a53f-90b8dbee5c38.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Canmore%2C%20CA-AB/original/89e48148-3bb0-4b2b-99b4-2b49421cb02d.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Mapo-gu%2C%20KR-11/original/7da250e4-e7c1-47f2-a524-0acfcfdffe21.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Chuo%2C%20JP-27/original/ffcfd50d-6427-459c-9b17-53a443b930ed.png',
		'https://a0.muscache.com/im/pictures/passport/Passport-Shibuya%2C%20JP-13/original/f9f1e0f9-36f3-450c-9ddf-2c588119fd1d.png'
	];

	const randomAngle = () => (Math.random() > 0.5 ? Math.random() * 5 : -Math.random() * 5);
	const randomScale = () => Math.random() * 0.1 + 0.95;
</script>

<Layout {...metadata}>
	<div class="flex flex-wrap gap-4">
		{#each images as image}
			<img
				alt="Passport"
				src={image}
				class="w-40 object-contain"
				style="transform: rotate({randomAngle()}deg) scale({randomScale()});"
			/>
		{/each}
	</div>
</Layout>
