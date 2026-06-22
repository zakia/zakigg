<script lang="ts">
	const workout = [
		{
			name: 'Pull-Ups',
			volume: '3x6-12',
		},
		{
			name: 'Dips',
			volume: '3x6-12'
		},
		{
			name: 'Pistol Squats (assisted if needed)',
			volume: '3x6-10 (each side)'
		},
		{
			name: 'Push-Ups',
			volume: '3x8-14'
		},
		{
			name: 'Rows',
			volume: '3x8-14'
		}
	];
</script>

<p>
	The key to building muscle is to make each rep as hard as possible. this is done by using a
	controlled eccentric (lengthening), pausing between reps, and using a full range of motion. You
	should strive to make each rep as perfect as possible.
</p>

<p>
	A lot of people think basic bodyweight exercises are not worth their time; that they can only make progress ifit's an hour spent at the gym. If you think you are above push-ups, try doing 20
	"perfect" pushups. It's extremely humbling.
	
</p>

<p>
	For so many people 8-10 pull-ups with great form is tough! 
</p>

<p>
	When done like this, your rep count will certainly drop. But this is good news! It means you have
	so much more room to grow in this basic movement.
</p>



<p>
	Building a solid fitness foundation using fundamental bodyweight movements will enable ANYTHING
	else you'd like to pursue.
</p>

<h3>Why Rings?</h3>

<ul>
	<li>One piece of equipment for a full workout</li>
	<li>Works stabilizing muscles</li>
	<li>Allows for a wide range of motion naturally</li>
	<li>Encourages time spent outdoors</li>
	<li>Scales to your ability</li>
</ul>

<h3>The workout</h3>
<div class="grid gap-2">
	{#each workout as exercise (exercise.name)}
		<div>
			<strong>{exercise.name}</strong>
			<div>{exercise.volume}</div>
		</div>
	{/each}
</div>
