<article class="my-24 max-w-2xl">
	<h1 class="text-center">How do Computers play games?</h1>
	<p>
		Think about how you would play a game of tic-tac-toe against a friend. Intuitively, it might go
		something along the lines of: <em
			>"If I put my X here, they'll put their O there, then I can put my X here and win."</em
		>
	</p>
	<p>How can we capture that thought process in a way that a computer can understand?</p>

	<h2>Let's look at an example</h2>
	<p>Say you're presented with this board, and it's your turn. Where do you play?</p>

	<!-- <RenderTree id="example_1" :board="example" player="X" :depth="1" :score-threshold="10" /> -->

	<p>
		You'd probably spot right away that you could play in the corner and win immediately. Winning is
		good, so you get +10 points for that. Congratulations!
	</p>

	<p>
		That was probably pretty obvious, but remember, we're trying to teach this to a computer and
		they don't know which move is obvious (at least not yet).
	</p>

	<p>How did you know to discard the other moves?</p>

	<p>
		Well, let's <b>look ahead</b> a little bit, and see what would happen if you played one of them
	</p>

	<div class="mx-auto my-12 flex max-w-md flex-col text-center text-balance">
		<p>Let's say you play here. Now your opponent is faced with the same scenario you had.</p>
		<!-- <RenderTree
      id="example_2"
      :last-move="3"
      :board="example2"
      player="O"
      :depth="1"
      :score-threshold="10"
      class="-my-10"
    /> -->

		<div class="grid grid-cols-[4fr_1fr_4fr] items-center justify-center">
			<div>
				They could play here and win right away <em> (which is bad for you btw, -10!) </em>
			</div>
			<div class="text-primary text-xl font-bold uppercase">or</div>
			<div>they could play here and who knows what happens next??</div>
		</div>
	</div>

	<h2>What happens next...</h2>

	<p>
		Playing in the right cell clearly isn't a very good move for our opponent. <br />
		In fact, it's so bad that you have no other choice but to win.
	</p>

	<div class="relative mx-auto my-12 flex max-w-md flex-col text-center text-balance">
		<p class="mx-a z-10 max-w-80">
			Once our opponent made this move, we were already guaranteed to win.
			<!-- <br>
          <small>(it's an <a href="https://knowyourmeme.com/memes/you-are-already-dead-omae-wa-mou-shindeiru">Omae Wa
              Mou Shindeiru</a>
            situation</small>) -->
		</p>
		<!-- <RenderTree
      id="example_3"
      :board="example3"
      :last-move="5"
      player="X"
      :depth="2"
      :score-threshold="8"
      :score="-10"
      class="-my-10"
    /> -->
		<div class="mx-auto max-w-60">
			Because there is no other choice to make, we might as well give you the +10 right away.
		</div>

		<!-- 
        <div class="absolute top-1/2 -translate-y-1/2 -right-6 max-w-40 text-sm text-end">
          Because there is no other choice to make, we might as well give you the +10 right away.
        </div> -->
	</div>

	<h2>So what's the deal with these +10s</h2>

	<p>
		Why are we giving out numbers at all instead of just win/lose?
		<br />
		<small>and why not +1000? or +69? or +∞?</small>
	</p>
	<p>
		We've been representing moves with arrows and the ensuing positions on the board with diagrams.
	</p>
	<p>
		A more generic way to think about these are as <b>actions</b>
		(the moves) and <b>states</b> (the board positions). Taking actions transitions the
		<b>system</b>
		(our game) from state to state.
		<br />
		You could think of <em>playing well</em> as taking actions that lead to states where you are winning.
	</p>

	<!-- 
      <p><em>
        "Whoa! Wait a second we were just talking about tic-tac-toe. Where did all this states and transitions come
          from?"
      </em></p>

      <p>This method of modelling a game applies to many more scenarios than tic-tac-toe, and so I'd like to introduce
        the </p>

      <div class="mb-4">
        A state
        where
        the game is over is called a
        <div class="inline group relative z-10 cursor-help mt-8">
          <p
            class="absolute group-hover:scale-100 scale-0 transition-transform border-2 border-primary bg-base1 rounded-lg p-2 shadow-lg top-full w-60 -left-1/2">
            Sometimes terminal states are also called <b>leaf
              nodes</b> because
            they're
            the leaves on this proverbial branching tree of moves.
          </p>
          <b class="text-primary">terminal state.</b>
        </div>
      </div> -->

	<p>So far it's been pretty easy to spot which actions lead to favourable states.</p>
	<p></p>

	<!-- <RenderTree id="example_5" :board="example5" player="X" :depth="1" :score-threshold="8"
        :include="[{ depth: 1, value: 0 }]" /> -->

	<p>
		This might seem like no big deal, but the idea of <b>propagating</b> the scores up the tree is super
		important.
	</p>
	<p>
		It's pretty straight-forward with only one option, but let's go back one move and take a look at
		our tree now that we've assigned some scores.
	</p>

	<div class="mx-auto my-12 flex max-w-md flex-col text-center text-balance">
		<p>Let's say you play here. Now your opponent is faced with the same scenario you had.</p>
		<!-- <RenderTree
      id="example_4"
      :last-move="3"
      :board="example2"
      player="O"
      :depth="1"
      :score-threshold="8"
      class="-my-10"
    /> -->

		<div class="grid grid-cols-[4fr_1fr_4fr] items-center justify-center">
			<div>We already know</div>
			<div class="text-primary text-xl font-bold uppercase">or</div>
			<div>Now that we've propagated</div>
		</div>
	</div>

	<!-- 
      <div class="grid grid-cols-2 mt-30">
        <Thumbnail v-for="item in nextPossibleStates('step-2.1', [1, 2, 2, 0, 2, 0, 0, 1, 1], 'X').slice(1)" :id=item.id
          :state="item.board" :player="item.player" />
      </div>

      <div class="grid grid-cols-4 mt-30">
        <Thumbnail v-for="item in nextPossibleStates('step-2.2', [1, 2, 2, 0, 2, 1, 0, 1, 1], 'O')" :id=item.id
          :state="item.board" :player="item.player" />
      </div> -->
</article>
