/**
 * main.js
 * 
 * Central Controller for Rubik's Cube State-Space Search & Solver Engine.
 */

import confetti from 'canvas-confetti';
import { CubeState, generateScramble, invertMoves, simplifyAlgorithm } from './core/CubeState.js';
import { Cube3D } from './render/Cube3D.js';
import { StateSpaceTreeVisualizer } from './visualizer/StateSpaceTree.js';
import { runBFS } from './algorithms/BreadthFirstSearch.js';
import { runIDAStar } from './algorithms/IDAStarSearch.js';
import { solveCube } from './algorithms/LayerByLayerSolver.js';

// --- Sound Synthesizer (Web Audio API) ---
class CubeAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTurnSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Subtle magnetic speedcube click sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  playSolvedChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Harmonic arpeggio fanfare (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const now = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });
  }
}

// --- Application State ---
const sound = new CubeAudio();
let cubeState = new CubeState();
let cube3D = null;
let treeVisualizer = null;

let currentScrambleMoves = [];
let moveHistory = [];
let currentSolution = null;
let solutionStepIndex = -1;
let isPlayingSolution = false;
let playbackTimer = null;
let playbackSpeed = 250; // ms

// --- DOM References ---
const stateBadge = document.getElementById('state-badge');
const stateText = document.getElementById('state-text');
const hudPercentSolved = document.getElementById('hud-percent-solved');
const hudHeuristic = document.getElementById('hud-heuristic');
const hudMisplaced = document.getElementById('hud-misplaced');

const scrambleLengthSelect = document.getElementById('scramble-length-select');
const btnScramble = document.getElementById('btn-scramble');
const btnReset = document.getElementById('btn-reset');
const btnSoundToggle = document.getElementById('btn-sound-toggle');
const soundIcon = document.getElementById('sound-icon');
const btnTheoryModal = document.getElementById('btn-theory-modal');
const theoryModal = document.getElementById('theory-modal');
const btnCloseModal = document.getElementById('btn-close-modal');

const depthSlider = document.getElementById('depth-limit-slider');
const depthLabel = document.getElementById('depth-limit-val');
const btnFindPath = document.getElementById('btn-find-path');
const searchStatusText = document.getElementById('search-status-text');
const metricExplored = document.getElementById('metric-explored');
const metricTime = document.getElementById('metric-time');
const metricPathLength = document.getElementById('metric-path-length');
const metricFrontier = document.getElementById('metric-frontier');
const algoMetricBadge = document.getElementById('algo-metric-badge');

const solutionSection = document.getElementById('solution-section');
const solutionMoveCount = document.getElementById('solution-move-count');
const solutionTape = document.getElementById('solution-tape');
const btnPlayStart = document.getElementById('btn-play-start');
const btnPlayPrev = document.getElementById('btn-play-prev');
const btnPlaybackToggle = document.getElementById('btn-playback-toggle');
const playPauseIcon = document.getElementById('play-pause-icon');
const btnPlayNext = document.getElementById('btn-play-next');
const btnPlayEnd = document.getElementById('btn-play-end');
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');

const stateHashDisplay = document.getElementById('state-hash-display');
const stateFaceletString = document.getElementById('state-facelet-string');
const cornerCountStat = document.getElementById('corner-count-stat');
const edgeCountStat = document.getElementById('edge-count-stat');
const historyList = document.getElementById('history-list');
const algorithmExportText = document.getElementById('algorithm-export-text');
const btnCopyAlgo = document.getElementById('btn-copy-algo');
const btnClearHistory = document.getElementById('btn-clear-history');

// --- Initialization ---
function init() {
  const mountContainer = document.getElementById('cube3d-mount');
  if (!mountContainer) return;

  cube3D = new Cube3D(mountContainer, on3DMoveCompleted);
  treeVisualizer = new StateSpaceTreeVisualizer('tree-canvas-container');

  setupEventListeners();
  updateUI();
}

// Called whenever a 3D slice finishes animating
function on3DMoveCompleted(move) {
  cubeState.applyMove(move);
  sound.playTurnSound();

  moveHistory.push({ move, timestamp: new Date().toLocaleTimeString() });
  currentScrambleMoves.push(move);

  updateUI();

  if (cubeState.isSolved()) {
    triggerVictory();
  }
}

// Executes an interactive move (from button or keyboard)
function executeMove(move) {
  if (!cube3D) return;
  cube3D.queueMove(move);
}

// Trigger victory celebration when cube reaches solved state
let lastCelebrationTime = 0;
function triggerVictory() {
  const now = Date.now();
  if (now - lastCelebrationTime < 3000) return;
  lastCelebrationTime = now;

  sound.playSolvedChime();

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#6366f1']
  });
}

// Updates Telemetry, HUD, Analytics & Badges
function updateUI() {
  const isSolved = cubeState.isSolved();
  const analysis = cubeState.getCubieAnalysis();
  const misplaced = cubeState.getMisplacedFacelets();
  const heuristic = cubeState.getHeuristicScore();

  // Status Badge
  if (isSolved) {
    stateBadge.className = 'badge badge-solved';
    stateText.textContent = 'STATE: SOLVED';
  } else {
    stateBadge.className = 'badge badge-scrambled';
    stateText.textContent = `STATE: SCRAMBLED (h=${heuristic})`;
  }

  // HUD
  hudPercentSolved.textContent = `${analysis.percentSolved}%`;
  hudHeuristic.textContent = `${heuristic}`;
  hudMisplaced.textContent = `${misplaced} / 48`;

  // Analytics Tab
  const hash = cubeState.getHash();
  let hashHex = '';
  for (let i = 0; i < Math.min(16, hash.length); i++) {
    hashHex += hash.charCodeAt(i).toString(16).padStart(2, '0');
  }
  stateHashDisplay.textContent = `0x${hashHex.toUpperCase()}... (${hash.length * 8} bits)`;
  stateFaceletString.textContent = cubeState.toString();

  cornerCountStat.textContent = `${analysis.solvedCorners} / 8 Solved`;
  edgeCountStat.textContent = `${analysis.solvedEdges} / 12 Solved`;

  // History Tab
  if (moveHistory.length === 0) {
    historyList.innerHTML = '<span style="color: var(--text-dim); text-align: center; padding: 1rem;">No moves recorded yet.</span>';
    algorithmExportText.value = '';
  } else {
    historyList.innerHTML = moveHistory.slice(-50).reverse().map((item, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface); padding: 0.25rem 0.5rem; border-radius:4px;">
        <span style="font-weight:700; color:var(--primary);">${item.move}</span>
        <span style="font-size:0.7rem; color:var(--text-dim);">${item.timestamp}</span>
      </div>
    `).join('');

    algorithmExportText.value = moveHistory.map(h => h.move).join(' ');
  }
}

// --- Solver Implementation ---
function findSolutionPath() {
  const selectedAlgo = document.querySelector('input[name="solver-algo"]:checked')?.value || 'bfs';
  const depth = parseInt(depthSlider.value, 10);

  if (cubeState.isSolved()) {
    searchStatusText.textContent = 'ALREADY SOLVED';
    return;
  }

  searchStatusText.textContent = 'SEARCHING...';
  btnFindPath.disabled = true;

  // Let UI breathe before CPU-bound search
  setTimeout(() => {
    let result = null;

    if (selectedAlgo === 'bfs') {
      result = runBFS(cubeState, { maxDepth: depth, maxNodes: 30000 });
    } else if (selectedAlgo === 'ida') {
      result = runIDAStar(cubeState, { maxDepth: depth, maxNodes: 45000 });
    } else {
      // Hierarchical CFOP solver
      result = solveCube(cubeState, currentScrambleMoves);
    }

    btnFindPath.disabled = false;

    if (!result) return;

    metricExplored.textContent = (result.nodesExplored || result.totalMoves?.length || 0).toLocaleString();
    metricTime.textContent = `${(result.durationMs || 0).toFixed(1)} ms`;

    if (result.success) {
      searchStatusText.textContent = 'PATH FOUND';
      searchStatusText.style.color = 'var(--emerald)';

      const moves = result.moves || result.totalMoves || [];
      metricPathLength.textContent = `${moves.length} moves`;
      metricFrontier.textContent = (result.frontierSize || 0).toLocaleString();

      // Render search tree
      if (treeVisualizer && result.treeNodes) {
        treeVisualizer.setTreeData(result.treeNodes, result.solutionNodeId);
      } else if (treeVisualizer) {
        // Construct visual trajectory for CFOP
        const synthTree = [{ id: '0', label: 'START', depth: 0, hash: cubeState.getHash().slice(0, 8), parentId: null, isSolution: true }];
        let curSim = cubeState.clone();
        moves.forEach((m, idx) => {
          curSim.applyMove(m);
          synthTree.push({
            id: `step-${idx + 1}`,
            label: m,
            depth: idx + 1,
            hash: curSim.getHash().slice(0, 8),
            parentId: idx === 0 ? '0' : `step-${idx}`,
            isSolution: true
          });
        });
        treeVisualizer.setTreeData(synthTree, `step-${moves.length}`);
      }

      setupSolutionPlayback(moves);
    } else {
      searchStatusText.textContent = result.reason || 'DEPTH LIMIT';
      searchStatusText.style.color = 'var(--amber)';
      metricPathLength.textContent = 'No Path';
      if (treeVisualizer && result.treeNodes) {
        treeVisualizer.setTreeData(result.treeNodes, null);
      }
    }
  }, 20);
}

// --- Solution Playback Controller ---
function setupSolutionPlayback(moves) {
  currentSolution = moves;
  solutionStepIndex = 0;
  pauseSolutionPlayback();

  solutionSection.style.display = 'block';
  solutionMoveCount.textContent = `${moves.length} Moves`;

  renderSolutionTape();
}

function renderSolutionTape() {
  if (!currentSolution || currentSolution.length === 0) {
    solutionTape.innerHTML = '';
    return;
  }

  solutionTape.innerHTML = currentSolution.map((move, idx) => {
    let cls = 'move-chip';
    if (idx < solutionStepIndex) cls += ' played';
    if (idx === solutionStepIndex) cls += ' active';
    return `<button class="${cls}" data-step="${idx}">${move}</button>`;
  }).join('');

  // Scroll active chip into view
  const activeChip = solutionTape.querySelector('.move-chip.active');
  if (activeChip) {
    activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function playNextSolutionStep() {
  if (!currentSolution || solutionStepIndex >= currentSolution.length) {
    pauseSolutionPlayback();
    return;
  }

  const move = currentSolution[solutionStepIndex];
  executeMove(move);
  solutionStepIndex++;
  renderSolutionTape();

  if (solutionStepIndex >= currentSolution.length) {
    pauseSolutionPlayback();
  }
}

function playPrevSolutionStep() {
  if (!currentSolution || solutionStepIndex <= 0) return;

  pauseSolutionPlayback();
  solutionStepIndex--;
  const move = currentSolution[solutionStepIndex];

  // Invert move to step backward
  const inv = move.endsWith('2') ? move : move.endsWith("'") ? move[0] : move + "'";
  executeMove(inv);
  renderSolutionTape();
}

function toggleSolutionPlayback() {
  if (isPlayingSolution) {
    pauseSolutionPlayback();
  } else {
    startSolutionPlayback();
  }
}

function startSolutionPlayback() {
  if (!currentSolution || currentSolution.length === 0) return;
  if (solutionStepIndex >= currentSolution.length) {
    solutionStepIndex = 0;
    renderSolutionTape();
  }

  isPlayingSolution = true;
  playPauseIcon.textContent = '⏸ Pause';

  playNextSolutionStep();
  playbackTimer = setInterval(() => {
    if (solutionStepIndex >= currentSolution.length) {
      pauseSolutionPlayback();
    } else {
      playNextSolutionStep();
    }
  }, playbackSpeed + 40);
}

function pauseSolutionPlayback() {
  isPlayingSolution = false;
  if (playbackTimer) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
  if (playPauseIcon) {
    playPauseIcon.textContent = '▶ Play Path';
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Scramble button
  btnScramble?.addEventListener('click', () => {
    const len = parseInt(scrambleLengthSelect.value, 10) || 5;
    const scrambleMoves = generateScramble(len);
    currentScrambleMoves = [...scrambleMoves];

    // Reset solution view
    currentSolution = null;
    pauseSolutionPlayback();
    solutionSection.style.display = 'none';

    cube3D.queueMoves(scrambleMoves);
  });

  // Reset button
  btnReset?.addEventListener('click', () => {
    pauseSolutionPlayback();
    cubeState.reset();
    cube3D.resetToSolved();
    currentScrambleMoves = [];
    currentSolution = null;
    solutionSection.style.display = 'none';
    if (treeVisualizer) treeVisualizer.setTreeData([], null);
    updateUI();
  });

  // Sound toggle
  btnSoundToggle?.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    soundIcon.textContent = sound.enabled ? '🔊' : '🔇';
    btnSoundToggle.title = sound.enabled ? 'Sound Enabled' : 'Sound Muted';
  });

  // Theory modal
  btnTheoryModal?.addEventListener('click', () => theoryModal.classList.add('active'));
  btnCloseModal?.addEventListener('click', () => theoryModal.classList.remove('active'));
  theoryModal?.addEventListener('click', (e) => {
    if (e.target === theoryModal) theoryModal.classList.remove('active');
  });

  // 18 Move Buttons
  document.querySelectorAll('.btn-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const move = btn.dataset.move;
      if (move) executeMove(move);
    });
  });

  // Algorithm Options Radio
  document.querySelectorAll('input[name="solver-algo"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.algo-option-label').forEach(lbl => lbl.classList.remove('selected'));
      e.target.closest('.algo-option-label')?.classList.add('selected');

      const val = e.target.value;
      if (val === 'bfs') {
        algoMetricBadge.textContent = 'Shortest Path (HTM)';
        depthSlider.max = 7;
        depthSlider.value = Math.min(depthSlider.value, 5);
        depthLabel.textContent = `${depthSlider.value} moves`;
      } else if (val === 'ida') {
        algoMetricBadge.textContent = 'f(n) = g(n) + h(n)';
        depthSlider.max = 10;
        depthLabel.textContent = `${depthSlider.value} moves`;
      } else {
        algoMetricBadge.textContent = 'Guaranteed 100%';
        depthLabel.textContent = 'Auto (All Depths)';
      }
    });
  });

  // Search Depth Slider
  depthSlider?.addEventListener('input', (e) => {
    depthLabel.textContent = `${e.target.value} moves`;
  });

  // Speed Slider
  speedSlider?.addEventListener('input', (e) => {
    playbackSpeed = parseInt(e.target.value, 10);
    speedLabel.textContent = `${playbackSpeed} ms / turn`;
    cube3D.animationSpeed = playbackSpeed;

    if (isPlayingSolution) {
      pauseSolutionPlayback();
      startSolutionPlayback();
    }
  });

  // Solve button
  btnFindPath?.addEventListener('click', findSolutionPath);

  // Playback control buttons
  btnPlaybackToggle?.addEventListener('click', toggleSolutionPlayback);
  btnPlayNext?.addEventListener('click', playNextSolutionStep);
  btnPlayPrev?.addEventListener('click', playPrevSolutionStep);

  btnPlayStart?.addEventListener('click', () => {
    pauseSolutionPlayback();
    if (!currentSolution) return;
    // Step back to start
    while (solutionStepIndex > 0) {
      solutionStepIndex--;
      const m = currentSolution[solutionStepIndex];
      const inv = m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'";
      executeMove(inv);
    }
    renderSolutionTape();
  });

  btnPlayEnd?.addEventListener('click', () => {
    pauseSolutionPlayback();
    if (!currentSolution) return;
    while (solutionStepIndex < currentSolution.length) {
      executeMove(currentSolution[solutionStepIndex]);
      solutionStepIndex++;
    }
    renderSolutionTape();
  });

  // Solution tape click
  solutionTape?.addEventListener('click', (e) => {
    const chip = e.target.closest('.move-chip');
    if (!chip) return;
    const targetIdx = parseInt(chip.dataset.step, 10);
    if (isNaN(targetIdx)) return;

    pauseSolutionPlayback();
    while (solutionStepIndex < targetIdx) {
      executeMove(currentSolution[solutionStepIndex]);
      solutionStepIndex++;
    }
    while (solutionStepIndex > targetIdx) {
      solutionStepIndex--;
      const m = currentSolution[solutionStepIndex];
      const inv = m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'";
      executeMove(inv);
    }
    renderSolutionTape();
  });

  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');

      if (btn.dataset.tab === 'tab-solver' && treeVisualizer) {
        setTimeout(() => treeVisualizer.resize(), 50);
      }
    });
  });

  // Clear History
  btnClearHistory?.addEventListener('click', () => {
    moveHistory = [];
    updateUI();
  });

  // Copy Algorithm
  btnCopyAlgo?.addEventListener('click', () => {
    if (!algorithmExportText.value) return;
    navigator.clipboard.writeText(algorithmExportText.value);
    const originalText = btnCopyAlgo.innerHTML;
    btnCopyAlgo.innerHTML = '<span>✓ Copied to Clipboard!</span>';
    setTimeout(() => {
      btnCopyAlgo.innerHTML = originalText;
    }, 1800);
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    // Ignore if typing inside input / textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    const key = e.key.toUpperCase();
    const isShift = e.shiftKey;

    if (['U', 'D', 'L', 'R', 'F', 'B'].includes(key)) {
      e.preventDefault();
      const move = isShift ? `${key}'` : key;
      executeMove(move);
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (currentSolution && currentSolution.length > 0) {
        toggleSolutionPlayback();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      playNextSolutionStep();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      playPrevSolutionStep();
    }
  });

  // Window resize
  window.addEventListener('resize', () => {
    if (cube3D) cube3D.onWindowResize();
    if (treeVisualizer) treeVisualizer.resize();
  });
}

// Start application
window.addEventListener('DOMContentLoaded', init);
