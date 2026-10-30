/**
 * IDAStarSearch.js
 * 
 * Iterative Deepening A* (IDA*) Search on Rubik's Cube State-Space Graph.
 * 
 * Algorithm:
 * - Cost evaluation: f(n) = g(n) + h(n)
 * - g(n): Depth (number of moves made so far)
 * - h(n): Admissible heuristic estimate to solved state
 * - Iteratively increases cutoff threshold = min { f(n) | f(n) > threshold }
 * - Space complexity: O(d)
 */

import { MOVES } from '../core/CubeState.js';

export function runIDAStar(initialState, options = {}) {
  const maxDepth = options.maxDepth ?? 8;
  const maxNodes = options.maxNodes ?? 50000;
  const onProgress = options.onProgress ?? null;

  const startTime = performance.now();
  let nodesExplored = 0;
  const treeNodes = [];

  const rootHash = initialState.getHash();
  if (initialState.isSolved()) {
    return {
      success: true,
      moves: [],
      depth: 0,
      nodesExplored: 1,
      durationMs: performance.now() - startTime,
      treeNodes: [{ id: 'node-0', label: 'START', depth: 0, hash: rootHash.slice(0, 8), isSolution: true }]
    };
  }

  let threshold = initialState.getHeuristicScore();
  const path = [];
  const statePath = [initialState.clone()];
  let solutionMoves = null;
  let solutionNodeId = null;

  treeNodes.push({
    id: 'node-0',
    label: 'START',
    depth: 0,
    hash: rootHash.slice(0, 8),
    parentId: null,
    isSolution: false
  });

  function getValidMoves(lastMove) {
    if (!lastMove) return MOVES;
    const lastFace = lastMove[0];
    return MOVES.filter(m => m[0] !== lastFace);
  }

  function search(g, currentThreshold, lastMove, parentNodeId) {
    const currentState = statePath[statePath.length - 1];
    nodesExplored++;

    const h = currentState.getHeuristicScore();
    const f = g + h;

    if (f > currentThreshold) {
      return f;
    }

    if (currentState.isSolved()) {
      solutionMoves = [...path];
      solutionNodeId = parentNodeId;
      return 0; // Found goal
    }

    if (g >= maxDepth || nodesExplored > maxNodes) {
      return Infinity;
    }

    let min = Infinity;
    const moves = getValidMoves(lastMove);

    for (const move of moves) {
      const nextState = currentState.clone().applyMove(move);
      
      path.push(move);
      statePath.push(nextState);

      const nodeId = `ida-${nodesExplored}`;
      if (treeNodes.length < 300) {
        treeNodes.push({
          id: nodeId,
          label: `${move} (f=${g + 1 + nextState.getHeuristicScore()})`,
          depth: g + 1,
          hash: nextState.getHash().slice(0, 8),
          parentId: parentNodeId,
          isSolution: nextState.isSolved()
        });
      }

      const t = search(g + 1, currentThreshold, move, nodeId);

      if (solutionMoves !== null) {
        return 0;
      }

      if (t < min) {
        min = t;
      }

      path.pop();
      statePath.pop();
    }

    return min;
  }

  while (threshold <= maxDepth && nodesExplored <= maxNodes) {
    if (onProgress) {
      onProgress({
        exploredCount: nodesExplored,
        currentThreshold: threshold,
        frontierSize: path.length
      });
    }

    const t = search(0, threshold, null, 'node-0');

    if (solutionMoves !== null) {
      return {
        success: true,
        moves: solutionMoves,
        depth: solutionMoves.length,
        nodesExplored,
        durationMs: performance.now() - startTime,
        treeNodes,
        solutionNodeId
      };
    }

    if (t === Infinity || t <= threshold) {
      break;
    }
    threshold = t;
  }

  return {
    success: false,
    reason: nodesExplored > maxNodes ? 'Node budget exceeded' : 'Depth limit reached',
    depthLimit: maxDepth,
    nodesExplored,
    durationMs: performance.now() - startTime,
    treeNodes
  };
}
