# 🧊 Rubik's Cube — Computational State-Space Engine & Solver

[![Deploy to GitHub Pages](https://github.com/Mahalakshmi-Kommaranahalli/rubiks-cube/actions/workflows/deploy.yml/badge.svg)](https://github.com/Mahalakshmi-Kommaranahalli/rubiks-cube/actions/workflows/deploy.yml)
[![Vite](https://img.shields.io/badge/Vite-8.3.5-646CFF?logo=vite)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js)](https://threejs.org/)

An interactive **3D Rubik's Cube** web application treating the $3 \times 3 \times 3$ puzzle as a formal **Computational State-Space Search Problem** $G = (V, E)$. Features real-time state-space graph search algorithms (**Breadth-First Search (BFS)**, **Iterative Deepening A\* (IDA\*)**, and **Hierarchical CFOP Decomposition**), live HTML5 Canvas state-space tree graph visualization, and realistic WebGL graphics.

Optimized for **Smartphones, Tablets, and Laptops/Desktops**.

---

## 🌟 Features

- **🎮 Responsive Multi-Platform Layout**:
  - **📱 Mobile Phones**: Fullscreen-proportioned 3D viewport with touch-action drag turning, compact telemetry cards, and touch-optimized move ribbon.
  - **📟 Tablets**: Adaptive 2-column or stacked layout with quick scramble controls and responsive tree inspection.
  - **💻 Laptops & Desktops**: Split-view studio dashboard with 3D canvas, live telemetry HUD, interactive state-space tree, and chronological move log.
- **✨ Studio 3D WebGL Engine**: 26 independent cubies with matte black plastic chamfering, glossy vinyl stickers, ACESFilmic tone mapping, and quaternion slice rotations.
- **⚡ Multiple State-Space Algorithms**:
  - **BFS (Breadth-First Search)**: Explores all reachable states level-by-level to find the mathematically optimal shortest path.
  - **IDA\* Search**: Iterative Deepening A\* with admissible pattern heuristics to prune exponential branches in $O(d)$ memory.
  - **Hierarchical Decomposition (CFOP)**: Decomposes the $4.33 \times 10^{19}$ state space into 7 sub-goal manifolds to solve any scramble in milliseconds.
- **🌳 Interactive State-Space Tree $G=(V, E)$**: Canvas graph visualizer supporting mouse pan, scroll-wheel zoom, hover tooltips, and glowing solution trajectory highlighting.
- **🎬 Solution Trajectory Player**: Interactive move tape with step scrubbing, auto-playback (`▶ Play Path`), step forward/backward, and speed adjustment.
- **🔊 Web Audio API Synthesizer**: Realistic speedcube magnetic tactile clicks on turns and victory fanfare chime when solved with confetti celebration.
- **📐 Mathematical Group Theory Analytics**: Real-time state fingerprint hashing, corner orientation parity $\sum x_c \equiv 0 \pmod 3$, and edge parity $\sum x_e \equiv 0 \pmod 2$.

---

## 🚀 Quick Start (Local Development)

```bash
# Clone the repository
git clone https://github.com/Mahalakshmi-Kommaranahalli/rubiks-cube.git
cd rubiks-cube

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173/` in your browser.

---

## 🌐 Deployment

### 1. GitHub Pages (Automated via GitHub Actions)
This repository includes a pre-configured GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
1. Push this repository to GitHub.
2. In your repository settings, go to **Settings > Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. Every push to `main` will automatically build and publish the site!

### 2. Vercel
1. Import the repository in [Vercel](https://vercel.com).
2. The included [`vercel.json`](vercel.json) automatically sets up the Vite build command and output directory (`dist`).
3. Click **Deploy**.

---

## 🕹 Controls

- **Mouse & Touch Drag**: Click and drag any sticker on the 3D cube to rotate that slice. Drag outside the cube to orbit and inspect all sides.
- **Keyboard Shortcuts**:
  - `U`, `D`, `L`, `R`, `F`, `B`: Turn corresponding face clockwise.
  - `Shift` + key: Turn face counter-clockwise (inverse).
  - `Space`: Toggle solution auto-play / pause.
  - `ArrowRight`: Step forward in solution.
  - `ArrowLeft`: Step backward in solution.

---

## 📚 Mathematical Formulation

The Rubik's Cube state space is modeled as an element of the permutation group:

$$\mathcal{G} = \langle U, D, L, R, F, B \rangle \le S_{48}$$

The total order of reachable states is:

$$|\mathcal{G}| = \frac{8! \times 3^7 \times 12! \times 2^{11}}{2} = 43,252,003,274,489,856,000 \approx 4.33 \times 10^{19}$$

In 2010, God's Number was proven to be **20** in the Half-Turn Metric (HTM).
>>>>>>> 65ed4e3 (Initial commit: Rubik's Cube state-space search engine with 3D WebGL, BFS, IDA*, CFOP solvers, tree visualizer, and responsive design)
