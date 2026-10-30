/**
 * BreadthFirstSearch.js
 * 
 * Formal Breadth-First Search (BFS) on Rubik's Cube State-Space Graph G = (V, E)
 * 
 * Properties:
 * - Complete: Guaranteed to find a solution if one exists.
 * - Optimal: Finds the shortest path (minimum moves in Half-Turn Metric).
 * - Time Complexity: O(b^d) where branching factor b = 18 (or 15 without trivial inverses).
 * - Space Complexity: O(b^d) frontier queue + visited hash set.
 * 
 * Emits telemetry data to visualize state-space tree expansion in real time.
 */

import { MOVES, OPPOSITE_MOVES } from '../core/CubeState.js';

export function runBFS(initialState, options = {}) {
  const maxDepth = options.maxDepth ?? 5;
  const maxNodes = options.maxNodes ?? 25000;
  const onProgress = options.onProgress ?? null;

  const startTime = performance.now();

  // Root node
  const rootHash = initialState.getHash();
  if (initialState.isSolved()) {
    return {
      success: true,
      moves: [],
      depth: 0,
      nodesExplored: 1,
      frontierSize: 0,
      durationMs: performance.now() - startTime,
      treeData: { id: '0', move: 'START', depth: 0, hash: rootHash, children: [], isSolution: true }
    };
  }

  // Node structure: { state, moves, lastMove, depth, id, parentId }
  const queue = [{
    state: initialState.clone(),
    moves: [],
    lastMove: null,
    depth: 0,
    id: 'node-0',
    parentId: null
  }];

  const visited = new Set();
  visited.add(rootHash);

  // Flat node list for tree graph visualization
  const treeNodes = [{
    id: 'node-0',
    label: 'START',
    depth: 0,
    hash: rootHash.slice(0, 8),
    parentId: null,
    isSolution: false
  }];

  let nodeCounter = 1;
  let exploredCount = 0;

  // Filter valid moves to avoid immediate redundant inverses (e.g. R followed by R')
  function getValidMoves(lastMove) {
    if (!lastMove) return MOVES;
    const lastFace = lastMove[0];
    return MOVES.filter(m => {
      const face = m[0];
      // Don't turn the same face twice in a row (e.g. R then R, which can be expressed in 1 move)
      if (face === lastFace) return false;
      return true;
    });
  }

  while (queue.length > 0) {
    exploredCount++;
    const current = queue.shift();

    if (current.depth >= maxDepth || exploredCount > maxNodes) {
      continue;
    }

    const availableMoves = getValidMoves(current.lastMove);

    for (const move of availableMoves) {
      const nextState = current.state.clone().applyMove(move);
      const hash = nextState.getHash();

      if (visited.has(hash)) continue;
      visited.add(hash);

      const nextId = `node-${nodeCounter++}`;
      const nextMoves = [...current.moves, move];
      const isGoal = nextState.isSolved();

      // Record in tree graph telemetry (limit tree node size to avoid DOM overload)
      if (treeNodes.length < 300) {
        treeNodes.push({
          id: nextId,
          label: move,
          depth: current.depth + 1,
          hash: hash.slice(0, 8),
          parentId: current.id,
          isSolution: isGoal
        });
      }

      if (isGoal) {
        const durationMs = performance.now() - startTime;
        // Mark path in tree
        return {
          success: true,
          moves: nextMoves,
          depth: nextMoves.length,
          nodesExplored: exploredCount,
          frontierSize: queue.length,
          durationMs,
          treeNodes,
          solutionNodeId: nextId
        };
      }

      queue.push({
        state: nextState,
        moves: nextMoves,
        lastMove: move,
        depth: current.depth + 1,
        id: nextId,
        parentId: current.id
      });
    }

    if (onProgress && exploredCount % 200 === 0) {
      onProgress({
        exploredCount,
        frontierSize: queue.length,
        currentDepth: current.depth
      });
    }
  }

  return {
    success: false,
    reason: exploredCount > maxNodes ? 'Node budget exceeded' : 'Depth limit reached',
    depthLimit: maxDepth,
    nodesExplored: exploredCount,
    frontierSize: queue.length,
    durationMs: performance.now() - startTime,
    treeNodes
  };
}
