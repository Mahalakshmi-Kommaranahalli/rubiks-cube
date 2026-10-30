/**
 * Cube3D.js
 * 
 * Interactive WebGL 3D Rubik's Cube Renderer using Three.js.
 * 
 * Features:
 * - 26 independent cubies with matte black plastic bodies and glossy vinyl stickers
 * - Smooth quaternion slice rotations with dynamic ease-out curves
 * - Direct mouse/touch dragging on faces to turn slices intuitively
 * - Camera OrbitControls for 360-degree inspection
 * - Move queue and step-by-step animation controls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const STICKER_COLORS = {
  U: 0xffffff, // White
  D: 0xffd500, // Yellow
  F: 0x009b48, // Green
  B: 0x0046ad, // Blue
  L: 0xff5800, // Orange
  R: 0xb71234, // Red
  CORE: 0x111827 // Matte dark charcoal
};

export class Cube3D {
  constructor(canvasContainer, onMoveCompleted = null) {
    this.container = canvasContainer;
    this.onMoveCompleted = onMoveCompleted;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.cubeGroup = null;
    this.pivot = null;

    this.cubies = [];
    this.moveQueue = [];
    this.isAnimating = false;
    this.animationSpeed = 250; // ms per 90-degree turn

    // Raycasting for interactive face drag
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragStartPoint = null;
    this.draggedCubie = null;
    this.draggedNormal = null;

    this.initScene();
    this.buildCube();
    this.initInteraction();
    this.animate();
  }

  initScene() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || Math.round(window.innerHeight * 0.45);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d16);

    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    this.updateCameraForAspect(aspect);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
      this.resizeObserver.observe(this.container);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12; // Snappy damping, prevents continuous endless spinning
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 14;
    this.controls.enablePan = false; // Prevent cube from being panned off screen
    this.controls.rotateSpeed = 0.8;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Studio Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(6, 10, 8);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 1.2);
    fillLight.position.set(-8, -4, -6);
    this.scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 2.5, 20);
    rimLight.position.set(0, 7, 0);
    this.scene.add(rimLight);

    // Cube group and rotation pivot
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.pivot = new THREE.Object3D();
    this.scene.add(this.pivot);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  updateCameraForAspect(aspect) {
    if (!this.camera) return;
    // On portrait / mobile phone screens (aspect < 1.0), step back camera so the cube
    // fits comfortably without overflowing viewport or overlapping header / controls
    if (aspect < 0.75) {
      this.camera.position.set(6.4, 5.6, 7.8);
      this.camera.fov = 42;
    } else if (aspect < 1.05) {
      this.camera.position.set(5.4, 4.8, 6.6);
      this.camera.fov = 40;
    } else {
      this.camera.position.set(4.5, 4.2, 5.8);
      this.camera.fov = 38;
    }
    this.camera.updateProjectionMatrix();
  }

  buildCube() {
    // 26 cubies placed at x, y, z in {-1, 0, 1}
    const size = 0.95;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: STICKER_COLORS.CORE,
      roughness: 0.6,
      metalness: 0.1
    });

    const createStickerMat = (colorHex) => new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.25,
      metalness: 0.05
    });

    // Materials order in Three.js BoxGeometry:
    // 0: +X (Right, R)
    // 1: -X (Left, L)
    // 2: +Y (Up, U)
    // 3: -Y (Down, D)
    // 4: +Z (Front, F)
    // 5: -Z (Back, B)

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // Skip core center

          const materials = [
            x === 1 ? createStickerMat(STICKER_COLORS.R) : coreMaterial,
            x === -1 ? createStickerMat(STICKER_COLORS.L) : coreMaterial,
            y === 1 ? createStickerMat(STICKER_COLORS.U) : coreMaterial,
            y === -1 ? createStickerMat(STICKER_COLORS.D) : coreMaterial,
            z === 1 ? createStickerMat(STICKER_COLORS.F) : coreMaterial,
            z === -1 ? createStickerMat(STICKER_COLORS.B) : coreMaterial
          ];

          const cubie = new THREE.Mesh(geometry, materials);
          cubie.position.set(x, y, z);
          cubie.userData = { initialPos: new THREE.Vector3(x, y, z) };

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;
    this.camera.aspect = aspect;
    this.updateCameraForAspect(aspect);
    this.renderer.setSize(width, height);
  }

  /**
   * Pushes a move into the animation queue
   */
  queueMove(move) {
    this.moveQueue.push(move);
    this.processQueue();
  }

  queueMoves(movesArray) {
    for (const m of movesArray) {
      this.moveQueue.push(m);
    }
    this.processQueue();
  }

  clearQueue() {
    this.moveQueue = [];
  }

  processQueue() {
    if (this.isAnimating || this.moveQueue.length === 0) return;
    const move = this.moveQueue.shift();
    this.animateMove(move);
  }

  /**
   * Executes a slice rotation animation
   */
  animateMove(move) {
    this.isAnimating = true;

    const baseFace = move[0];
    const isPrime = move.endsWith("'");
    const isDouble = move.endsWith('2');

    let angle = isDouble ? Math.PI : Math.PI / 2;
    if (isPrime) angle = -angle;

    // Define slice axis and coordinate filter
    let axis = new THREE.Vector3();
    let filterFn = null;

    switch (baseFace) {
      case 'U':
        axis.set(0, 1, 0);
        angle = -angle; // Looking down +Y, clockwise is negative rotation
        filterFn = (pos) => pos.y > 0.5;
        break;
      case 'D':
        axis.set(0, 1, 0);
        angle = angle; // Looking up from -Y, clockwise
        filterFn = (pos) => pos.y < -0.5;
        break;
      case 'R':
        axis.set(1, 0, 0);
        angle = -angle;
        filterFn = (pos) => pos.x > 0.5;
        break;
      case 'L':
        axis.set(1, 0, 0);
        angle = angle;
        filterFn = (pos) => pos.x < -0.5;
        break;
      case 'F':
        axis.set(0, 0, 1);
        angle = -angle;
        filterFn = (pos) => pos.z > 0.5;
        break;
      case 'B':
        axis.set(0, 0, 1);
        angle = angle;
        filterFn = (pos) => pos.z < -0.5;
        break;
      default:
        this.isAnimating = false;
        this.processQueue();
        return;
    }

    // Identify the 9 cubies in this slice
    const sliceCubies = this.cubies.filter(c => {
      const worldPos = new THREE.Vector3();
      c.getWorldPosition(worldPos);
      return filterFn(worldPos);
    });

    // Attach to pivot
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    this.scene.attach(this.pivot);

    sliceCubies.forEach(c => this.pivot.attach(c));

    const duration = isDouble ? this.animationSpeed * 1.5 : this.animationSpeed;
    const startRot = 0;
    const targetRot = angle;
    const startTime = performance.now();

    const tween = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentAngle = THREE.MathUtils.lerp(startRot, targetRot, ease);

      this.pivot.setRotationFromAxisAngle(axis, currentAngle);

      if (progress < 1.0) {
        requestAnimationFrame(tween);
      } else {
        // Snap to exact target
        this.pivot.setRotationFromAxisAngle(axis, targetRot);
        this.pivot.updateMatrixWorld(true);

        // Re-attach cubies back to cubeGroup and round positions to {-1, 0, 1}
        sliceCubies.forEach(c => {
          this.cubeGroup.attach(c);
          c.position.x = Math.round(c.position.x);
          c.position.y = Math.round(c.position.y);
          c.position.z = Math.round(c.position.z);
          c.updateMatrixWorld(true);
        });

        this.isAnimating = false;
        if (this.onMoveCompleted) {
          this.onMoveCompleted(move);
        }
        this.processQueue();
      }
    };

    requestAnimationFrame(tween);
  }

  /**
   * Resets cubies to identity solved orientation
   */
  resetToSolved() {
    this.clearQueue();
    this.cubeGroup.clear();
    this.cubies = [];
    this.buildCube();
  }

  /**
   * Mouse drag-to-turn raycast interaction
   */
  initInteraction() {
    let startScreenPos = new THREE.Vector2();
    let isMouseDown = false;

    const onPointerDown = (e) => {
      // Direct sticker-drag turns are ONLY enabled for desktop mouse (left-click).
      // On mobile/touchscreens, touching the canvas orbits the camera and should NEVER
      // infer accidental slice turns that cause the cube to run/spin automatically!
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (this.isAnimating) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.cubies);

      if (intersects.length > 0) {
        // Disable orbit controls while dragging cube face
        this.controls.enabled = false;
        isMouseDown = true;
        startScreenPos.set(e.clientX, e.clientY);
        this.draggedCubie = intersects[0].object;
        this.draggedNormal = intersects[0].face.normal.clone().applyQuaternion(this.draggedCubie.quaternion).round();
      }
    };

    const onPointerUp = (e) => {
      if (!isMouseDown) return;
      isMouseDown = false;
      this.controls.enabled = true;

      const deltaX = e.clientX - startScreenPos.x;
      const deltaY = e.clientY - startScreenPos.y;
      const dist = Math.hypot(deltaX, deltaY);

      if (dist > 35 && this.draggedCubie && this.draggedNormal) {
        this.inferMoveFromDrag(deltaX, deltaY, this.draggedCubie, this.draggedNormal);
      }

      this.draggedCubie = null;
      this.draggedNormal = null;
    };

    this.renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
  }

  inferMoveFromDrag(deltaX, deltaY, cubie, normal) {
    const pos = new THREE.Vector3();
    cubie.getWorldPosition(pos);
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Front face (normal +Z)
    if (normal.z > 0.5) {
      if (absX > absY) {
        // Horizontal drag on F face -> U or D move
        if (pos.y > 0.5) this.queueMove(deltaX > 0 ? "U'" : "U");
        else if (pos.y < -0.5) this.queueMove(deltaX > 0 ? "D" : "D'");
      } else {
        // Vertical drag on F face -> L or R move
        if (pos.x > 0.5) this.queueMove(deltaY < 0 ? "R" : "R'");
        else if (pos.x < -0.5) this.queueMove(deltaY < 0 ? "L'" : "L");
      }
    }
    // Up face (normal +Y)
    else if (normal.y > 0.5) {
      if (absX > absY) {
        if (pos.z > 0.5) this.queueMove(deltaX > 0 ? "F" : "F'");
        else if (pos.z < -0.5) this.queueMove(deltaX > 0 ? "B'" : "B");
      } else {
        if (pos.x > 0.5) this.queueMove(deltaY < 0 ? "R" : "R'");
        else if (pos.x < -0.5) this.queueMove(deltaY < 0 ? "L'" : "L");
      }
    }
    // Right face (normal +X)
    else if (normal.x > 0.5) {
      if (absX > absY) {
        if (pos.y > 0.5) this.queueMove(deltaX > 0 ? "U'" : "U");
        else if (pos.y < -0.5) this.queueMove(deltaX > 0 ? "D" : "D'");
      } else {
        if (pos.z > 0.5) this.queueMove(deltaY < 0 ? "F'" : "F");
        else if (pos.z < -0.5) this.queueMove(deltaY < 0 ? "B" : "B'");
      }
    }
    // Default fallback: allow keyboard and buttons
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
