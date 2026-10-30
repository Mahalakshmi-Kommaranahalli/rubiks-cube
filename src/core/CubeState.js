/**
 * CubeState.js
 * 
 * Formal Computational State-Space Model for Rubik's Cube.
 * 
 * Mathematical Formulation:
 * State S = (F_0, F_1, ..., F_53) in {U, L, F, R, B, D}^54
 * 
 * In Group Theory:
 * Cube Group G = <U, D, L, R, F, B> <= S_48
 * Order of G = 43,252,003,274,489,856,000 (~4.33 x 10^19 states)
 * Each move M in G is a permutation acting on the 54 facelet indices.
 */

export const FACE = {
  U: 0,
  L: 1,
  F: 2,
  R: 3,
  B: 4,
  D: 5
};

export const COLOR_MAP = {
  U: '#ffffff', // White
  D: '#ffd500', // Yellow
  F: '#009b48', // Green
  B: '#0046ad', // Blue
  L: '#ff5800', // Orange
  R: '#b71234'  // Red
};

export const COLOR_NAMES = {
  U: 'White',
  D: 'Yellow',
  F: 'Green',
  B: 'Blue',
  L: 'Orange',
  R: 'Red'
};

export const MOVES = [
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'L', "L'", 'L2',
  'R', "R'", 'R2',
  'F', "F'", 'F2',
  'B', "B'", 'B2'
];

export const OPPOSITE_MOVES = {
  U: 'D', D: 'U',
  L: 'R', R: 'L',
  F: 'B', B: 'F'
};

// Permutation cycles for 90-degree clockwise face turns:
// Each 4-tuple [a, b, c, d] means: a -> b -> c -> d -> a
// Which translates to: new_b = old_a, new_c = old_b, new_d = old_c, new_a = old_d
const FACE_CYCLES = (offset) => [
  [offset + 0, offset + 2, offset + 8, offset + 6], // corners
  [offset + 1, offset + 5, offset + 7, offset + 3]  // edges
];

const RAW_MOVE_CYCLES = {
  U: [
    ...FACE_CYCLES(0),
    [18, 9, 36, 27],  // F0 -> L0 -> B0 -> R0 -> F0
    [19, 10, 37, 28], // F1 -> L1 -> B1 -> R1 -> F1
    [20, 11, 38, 29]  // F2 -> L2 -> B2 -> R2 -> F2
  ],
  D: [
    ...FACE_CYCLES(45),
    [24, 33, 42, 15], // F6 -> R6 -> B6 -> L6 -> F6
    [25, 34, 43, 16], // F7 -> R7 -> B7 -> L7 -> F7
    [26, 35, 44, 17]  // F8 -> R8 -> B8 -> L8 -> F8
  ],
  F: [
    ...FACE_CYCLES(18),
    [6, 27, 47, 17], // U6 -> R27 -> D47 -> L17 -> U6
    [7, 30, 46, 14], // U7 -> R30 -> D46 -> L14 -> U7
    [8, 33, 45, 11]  // U8 -> R33 -> D45 -> L11 -> U8
  ],
  B: [
    ...FACE_CYCLES(36),
    [2, 9, 53, 35],  // U2 -> L9 -> D53 -> R35 -> U2
    [1, 12, 52, 32], // U1 -> L12 -> D52 -> R32 -> U1
    [0, 15, 51, 29]  // U0 -> L15 -> D51 -> R29 -> U0
  ],
  L: [
    ...FACE_CYCLES(9),
    [0, 18, 45, 44], // U0 -> F18 -> D45 -> B44 -> U0
    [3, 21, 48, 41], // U3 -> F21 -> D48 -> B41 -> U3
    [6, 24, 51, 38]  // U6 -> F24 -> D51 -> B38 -> U6
  ],
  R: [
    ...FACE_CYCLES(27),
    [8, 36, 53, 26], // U8 -> B36 -> D53 -> F26 -> U8
    [5, 39, 50, 23], // U5 -> B39 -> D50 -> F23 -> U5
    [2, 42, 47, 20]  // U2 -> B42 -> D47 -> F20 -> U2
  ]
};

// Build permutation lookup tables for all 18 basic moves
const PERMUTATIONS = {};

function compilePermutations() {
  const baseMoves = ['U', 'D', 'F', 'B', 'L', 'R'];
  
  for (const m of baseMoves) {
    const p1 = new Uint8Array(54);
    for (let i = 0; i < 54; i++) p1[i] = i;
    
    const cycles = RAW_MOVE_CYCLES[m];
    for (const [a, b, c, d] of cycles) {
      // a -> b -> c -> d -> a
      // so position b gets a, c gets b, d gets c, a gets d
      p1[b] = a;
      p1[c] = b;
      p1[d] = c;
      p1[a] = d;
    }
    PERMUTATIONS[m] = p1;

    // m2 is p1 applied twice
    const p2 = new Uint8Array(54);
    for (let i = 0; i < 54; i++) p2[i] = p1[p1[i]];
    PERMUTATIONS[m + '2'] = p2;

    // m' is p1 applied three times (or reverse cycle)
    const p3 = new Uint8Array(54);
    for (let i = 0; i < 54; i++) p3[i] = p1[p2[i]];
    PERMUTATIONS[m + "'"] = p3;
  }
}

compilePermutations();

export class CubeState {
  constructor(initialFacelets = null) {
    if (initialFacelets) {
      this.facelets = new Uint8Array(initialFacelets);
    } else {
      this.reset();
    }
  }

  reset() {
    this.facelets = new Uint8Array(54);
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 9; i++) {
        this.facelets[f * 9 + i] = f;
      }
    }
  }

  clone() {
    return new CubeState(this.facelets);
  }

  /**
   * Applies a single move (e.g. "R", "U'", "F2")
   */
  applyMove(move) {
    const perm = PERMUTATIONS[move];
    if (!perm) {
      console.warn(`Unknown move: ${move}`);
      return this;
    }
    const next = new Uint8Array(54);
    for (let i = 0; i < 54; i++) {
      next[i] = this.facelets[perm[i]];
    }
    this.facelets = next;
    return this;
  }

  /**
   * Applies a sequence of moves (e.g. "R U R' U'")
   */
  applyMoves(movesStringOrArray) {
    const moves = Array.isArray(movesStringOrArray) 
      ? movesStringOrArray 
      : movesStringOrArray.trim().split(/\s+/).filter(Boolean);
    for (const m of moves) {
      this.applyMove(m);
    }
    return this;
  }

  isSolved() {
    for (let f = 0; f < 6; f++) {
      const center = this.facelets[f * 9 + 4];
      for (let i = 0; i < 9; i++) {
        if (this.facelets[f * 9 + i] !== center) return false;
      }
    }
    return true;
  }

  /**
   * Compact 54-character state string for hash sets / visited maps
   */
  getHash() {
    return String.fromCharCode(...this.facelets);
  }

  /**
   * Returns a readable facelet array of letters U, L, F, R, B, D
   */
  toString() {
    const letters = ['U', 'L', 'F', 'R', 'B', 'D'];
    return Array.from(this.facelets).map(n => letters[n]).join('');
  }

  /**
   * Misplaced Facelets Heuristic h1 (Admissible lower bound)
   */
  getMisplacedFacelets() {
    let count = 0;
    for (let f = 0; f < 6; f++) {
      const center = this.facelets[f * 9 + 4];
      for (let i = 0; i < 9; i++) {
        if (this.facelets[f * 9 + i] !== center) count++;
      }
    }
    return count;
  }

  /**
   * Admissible heuristic for A* / IDA*:
   * Misplaced facelets / 8.
   */
  getHeuristicScore() {
    let misplaced = 0;
    for (let f = 0; f < 6; f++) {
      const center = this.facelets[f * 9 + 4];
      for (let i = 0; i < 9; i++) {
        if (i !== 4 && this.facelets[f * 9 + i] !== center) {
          misplaced++;
        }
      }
    }
    return Math.ceil(misplaced / 8);
  }

  /**
   * Returns corner and edge permutation/orientation status for diagnostics
   */
  getCubieAnalysis() {
    let solvedCorners = 0;
    let solvedEdges = 0;

    const cornerIndices = [
      [0, 9, 38], [2, 36, 29], [6, 11, 18], [8, 20, 27],
      [51, 15, 44], [53, 42, 35], [45, 17, 24], [47, 26, 33]
    ];
    for (const [c1, c2, c3] of cornerIndices) {
      if (this.facelets[c1] === Math.floor(c1 / 9) &&
          this.facelets[c2] === Math.floor(c2 / 9) &&
          this.facelets[c3] === Math.floor(c3 / 9)) {
        solvedCorners++;
      }
    }

    const edgeIndices = [
      [1, 37], [3, 10], [5, 28], [7, 19],
      [12, 41], [14, 21], [30, 23], [32, 39],
      [46, 25], [48, 16], [50, 34], [52, 43]
    ];
    for (const [e1, e2] of edgeIndices) {
      if (this.facelets[e1] === Math.floor(e1 / 9) &&
          this.facelets[e2] === Math.floor(e2 / 9)) {
        solvedEdges++;
      }
    }

    return {
      solvedCorners,
      totalCorners: 8,
      solvedEdges,
      totalEdges: 12,
      misplacedFacelets: this.getMisplacedFacelets(),
      percentSolved: Math.round(((solvedCorners + solvedEdges) / 20) * 100)
    };
  }
}

/**
 * Inverts a single move: e.g. R -> R', R' -> R, R2 -> R2
 */
export function invertMove(move) {
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move[0];
  return move + "'";
}

/**
 * Inverts an entire move sequence: e.g. "R U R' U'" -> "U R U' R'"
 */
export function invertMoves(moves) {
  const list = typeof moves === 'string' ? moves.trim().split(/\s+/).filter(Boolean) : [...moves];
  return list.reverse().map(invertMove);
}

/**
 * Simplifies a sequence of moves (collapses duplicates and inverses)
 */
export function simplifyAlgorithm(moves) {
  const list = typeof moves === 'string' ? moves.trim().split(/\s+/).filter(Boolean) : [...moves];
  const result = [];

  for (const move of list) {
    if (result.length === 0) {
      result.push(move);
      continue;
    }
    const last = result[result.length - 1];
    const base1 = last[0];
    const base2 = move[0];

    if (base1 !== base2) {
      result.push(move);
      continue;
    }

    // Same face turned twice in succession: calculate combined angle mod 4
    const angle1 = last.endsWith('2') ? 2 : last.endsWith("'") ? 3 : 1;
    const angle2 = move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1;
    const combined = (angle1 + angle2) % 4;

    result.pop();
    if (combined === 1) result.push(base1);
    else if (combined === 2) result.push(base1 + '2');
    else if (combined === 3) result.push(base1 + "'");
  }
  return result;
}

/**
 * Generates random scramble sequence
 */
export function generateScramble(length = 20) {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const scramble = [];
  let lastFace = null;
  let secondLastFace = null;

  for (let i = 0; i < length; i++) {
    let face;
    do {
      face = faces[Math.floor(Math.random() * faces.length)];
    } while (
      face === lastFace || 
      (face === OPPOSITE_MOVES[lastFace] && face === secondLastFace)
    );

    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(face + mod);
    secondLastFace = lastFace;
    lastFace = face;
  }
  return scramble;
}
