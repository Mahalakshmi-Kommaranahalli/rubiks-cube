import { CubeState, generateScramble, invertMoves, simplifyAlgorithm } from './src/core/CubeState.js';
import { runBFS } from './src/algorithms/BreadthFirstSearch.js';
import { runIDAStar } from './src/algorithms/IDAStarSearch.js';
import { solveCube } from './src/algorithms/LayerByLayerSolver.js';

console.log('====================================================');
console.log('RUBIK\'S CUBE SUITE: ALGORITHM & SOLVER VERIFICATION');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failCount++;
  }
}

// TEST 1: Move Inversion & Simplification
{
  const moves = ["R", "U", "R'", "U'"];
  const inverted = invertMoves(moves);
  assert(inverted.join(' ') === "U R U' R'", 'Move sequence inversion: (R U R\' U\')^-1 == U R U\' R\'');

  const redundant = ["R", "R'", "U", "U", "U2", "F"];
  const simplified = simplifyAlgorithm(redundant);
  assert(!simplified.includes("R'"), 'Algorithm simplification cancels R followed by R\'');
}

// TEST 2: BFS Optimal Shortest Path Search
{
  const cube = new CubeState();
  const testScrambles = [
    ["R"],
    ["U", "R"],
    ["F", "R'", "D"]
  ];

  for (const scramble of testScrambles) {
    cube.reset();
    cube.applyMoves(scramble.join(' '));
    const result = runBFS(cube, { maxDepth: scramble.length + 1, maxNodes: 10000 });
    
    assert(result.success === true, `BFS finds path for ${scramble.join(' ')}`);
    assert(result.moves.length === scramble.length, `BFS solution is strictly optimal (${result.moves.length} moves)`);

    // Verify solution returns cube to solved state
    for (const m of result.moves) cube.applyMove(m);
    assert(cube.isSolved(), `Applying BFS solution restores identity solved state`);
  }
}

// TEST 3: IDA* Heuristic Search
{
  const cube = new CubeState();
  const scramble = ["R", "U", "R'", "F"];
  cube.applyMoves(scramble.join(' '));
  
  const result = runIDAStar(cube, { maxDepth: 5, maxNodes: 15000 });
  assert(result.success === true, `IDA* with heuristic finds solution for ${scramble.join(' ')}`);
  
  for (const m of result.moves) cube.applyMove(m);
  assert(cube.isSolved(), 'Applying IDA* solution restores identity solved state');
}

// TEST 4: CFOP / Layer-By-Layer Solver on arbitrary depth scrambles
{
  const cube = new CubeState();
  for (const scrambleLen of [5, 10, 20]) {
    cube.reset();
    const scramble = generateScramble(scrambleLen);
    cube.applyMoves(scramble.join(' '));

    const result = solveCube(cube, scramble);
    assert(result.success === true, `CFOP solver successfully solves ${scrambleLen}-move WCA scramble`);
    assert(result.phases && result.phases.length >= 1, `CFOP breaks problem into sub-goal stages (${result.phases.length} phases)`);

    // Test execution of CFOP solution
    for (const m of result.moves) cube.applyMove(m);
    assert(cube.isSolved(), `Applying CFOP solution restores solved state for ${scrambleLen}-move scramble`);
  }
}

// TEST 5: State Space Hash Invariance
{
  const c1 = new CubeState();
  const c2 = new CubeState();
  c1.applyMoves("R U R' U'");
  c2.applyMoves("R U R' U'");
  assert(c1.getHash() === c2.getHash(), 'Deterministic SHA-equivalent state hashing');
  
  c2.applyMoves("U");
  assert(c1.getHash() !== c2.getHash(), 'Distinct states produce unique hashes');
}

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) process.exit(1);
