import { CubeState } from './src/core/CubeState.js';

const cube = new CubeState();
console.log('Initially solved:', cube.isSolved());

let allPassed = true;

// Test each move M^4 == I and M * M' == I
for (const m of ['U', 'D', 'L', 'R', 'F', 'B']) {
  cube.reset();
  for (let i = 0; i < 4; i++) cube.applyMove(m);
  if (!cube.isSolved()) {
    console.error('Failed 4-cycle for', m);
    allPassed = false;
  }
  
  cube.reset();
  cube.applyMove(m);
  cube.applyMove(m + "'");
  if (!cube.isSolved()) {
    console.error('Failed inverse for', m);
    allPassed = false;
  }

  cube.reset();
  cube.applyMove(m + '2');
  cube.applyMove(m + '2');
  if (!cube.isSolved()) {
    console.error('Failed double move for', m);
    allPassed = false;
  }
}

// Test Sexy Move (R U R' U')^6 == I
cube.reset();
for (let i = 0; i < 6; i++) {
  cube.applyMoves("R U R' U'");
}
if (!cube.isSolved()) {
  console.error('Failed Sexy move x 6');
  allPassed = false;
}

// Test T-Permutation x 2 == I: R U R' U' R' F R2 U' R' U' R U R' F'
cube.reset();
const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
cube.applyMoves(tPerm);
cube.applyMoves(tPerm);
if (!cube.isSolved()) {
  console.error('Failed T-Perm x 2');
  allPassed = false;
}

if (allPassed) {
  console.log('ALL MATHEMATICAL GROUP TRANSFORMATIONS VERIFIED SUCCESSFULLY!');
}
