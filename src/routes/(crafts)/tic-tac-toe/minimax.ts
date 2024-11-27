
const memoizedScores: Record<string, { score: number; depth: number }> = {};

export const HUMAN = 1;
export const AI = 2;
export const EMPTY = 0;

function minimax(board: number[], depth: number, isMaximizing: boolean): number {
  const result = checkWinner(board);
  if (result.winner !== -1) {
    return evaluateResult(result.winner, depth);
  }

  let bestScore = isMaximizing ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] === EMPTY) {
      board[i] = isMaximizing ? AI : HUMAN;
      let score: number;
      if (memoizedScores[board.toString()]) {
        score = memoizedScores[board.toString()].score;
      } else {
        score = minimax(board, depth + 1, !isMaximizing);
        memoizedScores[board.toString()] = { score, depth };
      }
      board[i] = EMPTY;
      bestScore = isMaximizing ? Math.max(score, bestScore) : Math.min(score, bestScore);
    }
  }
  return bestScore;
}

export function checkWinner(board: number[]): { winner: number; pattern: number[] } {
  const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] !== EMPTY && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], pattern };
    }
  }

  if (board.every((cell) => cell !== EMPTY)) {
    return { winner: EMPTY, pattern: [] };
  }

  return { winner: -1, pattern: [] };
}

export function bestMove(board: number[]): number {
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (let i = 0; i < 9; i++) {
    if (board[i] === EMPTY) {
      board[i] = AI; // AI move
      const score = minimax(board, 0, false);
      board[i] = EMPTY;
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [i];
      } else if (score === bestScore) {
        bestMoves.push(i);
      }
    }
  }
  if (bestMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * bestMoves.length);
    return bestMoves[randomIndex];
  }

  return -1;
}

function evaluateResult(result: number, depth: number): number {
  if (result === AI) {
    return 10 - depth;
  } else if (result === HUMAN) {
    return depth - 10;
  } else {
    return 0;
  }
}