/**
 * StateSpaceTree.js
 * 
 * Interactive HTML5 Canvas State-Space Graph & Search Tree Visualizer.
 * 
 * Displays:
 * - State nodes S_i with depth, hash, and heuristic score f(n) = g(n) + h(n)
 * - Directed edges representing state transitions labeled by move M in G
 * - Glowing solution trajectory highlighted from scrambled root to solved state
 * - Real-time pan & zoom with mouse dragging and scroll wheel
 * - Hover inspection tooltips
 */

export class StateSpaceTreeVisualizer {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.nodes = [];
    this.nodeMap = new Map();
    this.solutionPathSet = new Set();
    this.hoveredNode = null;

    // Viewport transform
    this.panX = 0;
    this.panY = 30;
    this.scale = 1.0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.initEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.draw();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.draw();
      } else {
        this.handleHover(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      this.panX = mouseX - (mouseX - this.panX) * zoomFactor;
      this.panY = mouseY - (mouseY - this.panY) * zoomFactor;
      this.scale = Math.max(0.15, Math.min(3.0, this.scale * zoomFactor));
      this.draw();
    }, { passive: false });
  }

  handleHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - this.panX) / this.scale;
    const mouseY = (e.clientY - rect.top - this.panY) / this.scale;

    let found = null;
    for (const node of this.nodes) {
      const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
      if (dist <= (node.radius || 14)) {
        found = node;
        break;
      }
    }

    if (this.hoveredNode !== found) {
      this.hoveredNode = found;
      this.canvas.style.cursor = found ? 'pointer' : 'grab';
      this.draw();
    }
  }

  /**
   * Loads search telemetry and calculates tree layout coordinates.
   */
  setTreeData(treeNodes = [], solutionNodeId = null) {
    this.nodes = [];
    this.nodeMap.clear();
    this.solutionPathSet.clear();

    if (!treeNodes || treeNodes.length === 0) {
      this.draw();
      return;
    }

    // Build hierarchy
    const levels = {};
    for (const raw of treeNodes) {
      const node = {
        id: raw.id,
        label: raw.label,
        depth: raw.depth,
        hash: raw.hash,
        parentId: raw.parentId,
        isSolution: !!raw.isSolution,
        children: [],
        x: 0,
        y: 0,
        radius: raw.depth === 0 ? 18 : 14
      };
      this.nodes.push(node);
      this.nodeMap.set(node.id, node);

      if (!levels[node.depth]) levels[node.depth] = [];
      levels[node.depth].push(node);
    }

    // Connect children
    for (const node of this.nodes) {
      if (node.parentId && this.nodeMap.has(node.parentId)) {
        this.nodeMap.get(node.parentId).children.push(node);
      }
    }

    // Trace solution path backwards
    if (solutionNodeId && this.nodeMap.has(solutionNodeId)) {
      let curr = this.nodeMap.get(solutionNodeId);
      while (curr) {
        this.solutionPathSet.add(curr.id);
        curr = curr.parentId ? this.nodeMap.get(curr.parentId) : null;
      }
    }

    // Calculate layout coordinates (Radial / Layered layout)
    const levelDepths = Object.keys(levels).map(Number).sort((a, b) => a - b);
    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const layerSpacingY = 70;

    for (const depth of levelDepths) {
      const levelNodes = levels[depth];
      const count = levelNodes.length;
      const totalWidth = Math.max(canvasWidth - 80, count * 55);
      const startX = (canvasWidth - totalWidth) / 2;
      const stepX = totalWidth / Math.max(1, count - 1);

      for (let i = 0; i < count; i++) {
        levelNodes[i].x = count === 1 ? canvasWidth / 2 : startX + i * stepX;
        levelNodes[i].y = 40 + depth * layerSpacingY;
      }
    }

    // Center view
    this.panX = 0;
    this.panY = 20;
    this.scale = 1.0;
    this.draw();
  }

  draw() {
    if (!this.ctx) return;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.clearRect(0, 0, width, height);

    // Subtle background grid
    this.drawBackgroundGrid(width, height);

    if (this.nodes.length === 0) {
      this.drawEmptyState(width, height);
      return;
    }

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.scale, this.scale);

    // 1. Draw Edges (State Transitions)
    for (const node of this.nodes) {
      if (!node.parentId || !this.nodeMap.has(node.parentId)) continue;
      const parent = this.nodeMap.get(node.parentId);
      const isSolutionEdge = this.solutionPathSet.has(node.id) && this.solutionPathSet.has(parent.id);

      this.ctx.beginPath();
      this.ctx.moveTo(parent.x, parent.y);
      this.ctx.lineTo(node.x, node.y);

      if (isSolutionEdge) {
        this.ctx.strokeStyle = '#10b981'; // Emerald glow
        this.ctx.lineWidth = 3.5;
        this.ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
        this.ctx.shadowBlur = 10;
      } else {
        this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
        this.ctx.lineWidth = 1.2;
        this.ctx.shadowBlur = 0;
      }
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;

      // Draw move label on edge if zoomed in enough
      if (this.scale >= 0.7) {
        const midX = (parent.x + node.x) / 2;
        const midY = (parent.y + node.y) / 2;
        this.ctx.fillStyle = isSolutionEdge ? '#34d399' : '#94a3b8';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(node.label.split(' ')[0], midX + 8, midY);
      }
    }

    // 2. Draw Nodes (States)
    for (const node of this.nodes) {
      const isSolutionNode = this.solutionPathSet.has(node.id);
      const isHovered = this.hoveredNode === node;

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius * (isHovered ? 1.25 : 1), 0, Math.PI * 2);

      if (node.depth === 0) {
        // Root / Scramble
        this.ctx.fillStyle = '#6366f1'; // Indigo
        this.ctx.strokeStyle = '#a5b4fc';
      } else if (node.isSolution || (isSolutionNode && node.children.length === 0)) {
        // Solved state
        this.ctx.fillStyle = '#10b981'; // Emerald
        this.ctx.strokeStyle = '#6ee7b7';
      } else if (isSolutionNode) {
        // Solution trajectory
        this.ctx.fillStyle = '#059669';
        this.ctx.strokeStyle = '#34d399';
      } else {
        // Explored branch
        this.ctx.fillStyle = '#1e293b';
        this.ctx.strokeStyle = '#334155';
      }

      this.ctx.lineWidth = isSolutionNode || isHovered ? 2.5 : 1.2;
      if (isSolutionNode) {
        this.ctx.shadowColor = '#10b981';
        this.ctx.shadowBlur = 12;
      }
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;

      // Label inside node
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const label = node.depth === 0 ? 'S0' : node.isSolution ? 'SOLV' : `d=${node.depth}`;
      this.ctx.fillText(label, node.x, node.y);
    }

    // 3. Hover Tooltip
    if (this.hoveredNode) {
      this.drawTooltip(this.hoveredNode);
    }

    this.ctx.restore();
  }

  drawTooltip(node) {
    const isSolution = this.solutionPathSet.has(node.id);
    const textLines = [
      `Node: ${node.id}`,
      `Depth g(n): ${node.depth}`,
      `Transition: ${node.label}`,
      `Hash: ${node.hash}...`,
      isSolution ? 'Status: SOLUTION PATH' : 'Status: Explored'
    ];

    const boxWidth = 160;
    const boxHeight = textLines.length * 16 + 14;
    const boxX = node.x + 18;
    const boxY = node.y - 18;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    this.ctx.strokeStyle = isSolution ? '#10b981' : '#38bdf8';
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    this.ctx.shadowBlur = 8;

    this.ctx.beginPath();
    this.ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = '11px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    textLines.forEach((line, idx) => {
      if (idx === 4) {
        this.ctx.fillStyle = isSolution ? '#34d399' : '#94a3b8';
      }
      this.ctx.fillText(line, boxX + 8, boxY + 8 + idx * 16);
    });
    this.ctx.restore();
  }

  drawBackgroundGrid(width, height) {
    this.ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    this.ctx.lineWidth = 1;
    const gridSize = 40;

    const startX = (this.panX % (gridSize * this.scale));
    const startY = (this.panY % (gridSize * this.scale));

    this.ctx.beginPath();
    for (let x = startX; x < width; x += gridSize * this.scale) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
    }
    for (let y = startY; y < height; y += gridSize * this.scale) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();
  }

  drawEmptyState(width, height) {
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '13px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Execute BFS or IDA* to visualize state-space tree expansion', width / 2, height / 2);
  }
}
