/**
 * Editor Mode — drag-and-drop prop placement with free-fly camera.
 *
 * Features:
 *   • Free-fly camera (WASD + mouse look, no gravity, no HUD)
 *   • Speed slider (mouse wheel or on-screen)
 *   • Drag-and-drop .glb/.gltf/.obj/.fbx files from OS into the browser
 *   • Place models on the ground via click
 *   • Select, move, rotate, scale any object (existing or newly placed)
 *   • Auto-saves placed props to localStorage (separate from game save)
 *   • Props reload on boot so they persist across sessions
 *
 * Keyboard:
 *   F10       — toggle editor mode
 *   WASD      — fly movement
 *   QE / Space / Ctrl  — fly up / down
 *   Shift     — boost speed
 *   G         — toggle gizmo mode (translate / rotate / scale)
 *   Delete    — remove selected prop
 *   Escape    — deselect / exit editor
 *
 * Mouse:
 *   Left click      — place held model, or select scene object
 *   Right drag      — look around
 *   Scroll          — adjust fly speed
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/OBJLoader.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EDITOR_SAVE_KEY = "wasteland_japan_editor_props_v1";

// ---------------------------------------------------------------------------
// CSS for editor overlay (injected once)
// ---------------------------------------------------------------------------

const EDITOR_CSS = `
.editor-overlay{
  position:fixed;inset:0;pointer-events:none;z-index:1000;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#e7f0ff;
}
.editor-overlay *{box-sizing:border-box;}
.editor-bar{
  position:absolute;top:0;left:0;right:0;
  display:flex;align-items:center;gap:12px;
  padding:8px 14px;
  background:rgba(10,12,20,.82);border-bottom:1px solid rgba(255,255,255,.12);
  pointer-events:auto;font-size:13px;
}
.editor-bar .title{font-weight:900;letter-spacing:1px;opacity:.9;}
.editor-bar .sep{width:1px;height:22px;background:rgba(255,255,255,.15);}
.editor-bar label{opacity:.8;}
.editor-bar input[type=range]{width:100px;vertical-align:middle;}
.editor-bar select{background:#1a1e28;color:#e7f0ff;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 8px;pointer-events:auto;}
.editor-bar .btn{
  padding:5px 12px;border-radius:8px;cursor:pointer;user-select:none;
  border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);
}
.editor-bar .btn:hover{background:rgba(255,255,255,.14);}
.editor-bar .btn.active{background:rgba(80,180,255,.25);border-color:rgba(80,180,255,.5);}
.editor-status{
  position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
  padding:8px 14px;border-radius:10px;
  background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);
  font-size:13px;opacity:.9;pointer-events:none;white-space:nowrap;
}
.editor-drop-zone{
  position:absolute;inset:0;
  display:none;align-items:center;justify-content:center;
  background:rgba(10,20,40,.85);border:3px dashed rgba(80,180,255,.5);
  font-size:22px;font-weight:800;letter-spacing:2px;
  pointer-events:none;z-index:1001;
}
.editor-props-panel{
  position:absolute;right:0;top:42px;bottom:0;width:240px;
  background:rgba(10,12,20,.88);border-left:1px solid rgba(255,255,255,.12);
  overflow-y:auto;padding:8px;font-size:12px;pointer-events:auto;
}
.editor-props-panel .prop-item{
  padding:6px 8px;border-radius:6px;cursor:pointer;margin-bottom:2px;
  border:1px solid transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.editor-props-panel .prop-item:hover{background:rgba(255,255,255,.08);}
.editor-props-panel .prop-item.selected{background:rgba(80,180,255,.18);border-color:rgba(80,180,255,.4);}
.editor-props-panel h3{margin:0 0 6px;font-size:13px;opacity:.7;font-weight:700;}
.editor-transform{
  position:absolute;left:14px;bottom:52px;
  padding:10px 14px;border-radius:12px;
  background:rgba(10,12,20,.88);border:1px solid rgba(255,255,255,.12);
  font-size:12px;pointer-events:auto;min-width:220px;display:none;
}
.editor-transform .row{display:flex;gap:6px;align-items:center;margin:4px 0;}
.editor-transform .row label{min-width:55px;opacity:.7;}
.editor-transform .row input{width:70px;background:#1a1e28;color:#e7f0ff;border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:2px 4px;pointer-events:auto;}
`;

// ---------------------------------------------------------------------------
// Editor class
// ---------------------------------------------------------------------------

export class Editor {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} deps  — { terrain, input }
   */
  constructor(scene, camera, renderer, deps) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.terrain = deps.terrain || null;
    this.input = deps.input || null;

    this.active = false;

    // Free-fly state
    this.flySpeed = 15;
    this.flyYaw = 0;
    this.flyPitch = 0;
    this.flyPos = new THREE.Vector3();

    // Placed props: array of { id, url, fileName, position, rotation, scale, obj3d }
    this.props = [];
    this._nextId = 1;

    // Currently selected prop (reference into this.props)
    this.selected = null;

    // Model being held for placement (not yet dropped)
    this._held = null;       // THREE.Object3D (preview)
    this._heldFileName = "";
    this._heldUrl = "";      // file name for persistence lookup

    // Gizmo mode: "translate" | "rotate" | "scale"
    this.gizmoMode = "translate";

    // Raycaster
    this._ray = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Loaders
    this._gltfLoader = new GLTFLoader();
    this._fbxLoader = new FBXLoader();
    this._objLoader = new OBJLoader();

    // Selection highlight
    this._selBox = null;

    // UI
    this._ui = null;
    this._cssInjected = false;

    // Drag state for right-click look
    this._rmbDown = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;

    // Dragging selected prop
    this._dragging = false;

    // Object URLs to revoke on dispose
    this._objectUrls = [];

    // Bind event handlers (stored for removal)
    this._onDragOver = this._handleDragOver.bind(this);
    this._onDragLeave = this._handleDragLeave.bind(this);
    this._onDrop = this._handleDrop.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onContextMenu = (e) => { if (this.active) e.preventDefault(); };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Enter editor mode. Saves current player camera state. */
  enter(playerPos, playerYaw, playerPitch) {
    if (this.active) return;
    this.active = true;

    // Copy camera position
    this.flyPos.copy(playerPos);
    this.flyYaw = playerYaw;
    this.flyPitch = playerPitch;

    this._injectCSS();
    this._buildUI();
    this._bindEvents();

    // Release pointer lock if active
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Leave editor mode. */
  exit() {
    if (!this.active) return;
    this.active = false;
    this._deselect();
    this._clearHeld();
    this._unbindEvents();
    this._destroyUI();
  }

  /** Called every frame from game loop. */
  update(dt) {
    if (!this.active) return;
    this._updateFly(dt);
    this._updateHeldPreview();
    this._updateSelectionBox();
    this._updateTransformPanel();
  }

  /**
   * Load all editor-placed props from localStorage and add to scene.
   * Call once at game boot.
   */
  loadSavedProps() {
    const raw = localStorage.getItem(EDITOR_SAVE_KEY);
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(data)) return;
    for (const entry of data) {
      this._loadPropFromEntry(entry);
    }
  }

  /** Persist all editor props to localStorage immediately. */
  saveProps() {
    const data = this.props.map(p => ({
      id: p.id,
      fileName: p.fileName,
      url: p.url,
      position: { x: p.obj3d.position.x, y: p.obj3d.position.y, z: p.obj3d.position.z },
      rotation: { x: p.obj3d.rotation.x, y: p.obj3d.rotation.y, z: p.obj3d.rotation.z },
      scale: { x: p.obj3d.scale.x, y: p.obj3d.scale.y, z: p.obj3d.scale.z },
    }));
    localStorage.setItem(EDITOR_SAVE_KEY, JSON.stringify(data));
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  _injectCSS() {
    if (this._cssInjected) return;
    this._cssInjected = true;
    const s = document.createElement("style");
    s.textContent = EDITOR_CSS;
    document.head.appendChild(s);
  }

  _buildUI() {
    if (this._ui) return;

    const root = document.createElement("div");
    root.className = "editor-overlay";
    document.body.appendChild(root);

    // Top bar
    const bar = document.createElement("div");
    bar.className = "editor-bar";
    bar.innerHTML = `
      <span class="title">EDITOR MODE</span>
      <div class="sep"></div>
      <label>Speed</label>
      <input type="range" min="2" max="100" step="1" value="${this.flySpeed}" class="speed-slider">
      <span class="speed-val">${this.flySpeed}</span>
      <div class="sep"></div>
      <label>Gizmo</label>
      <select class="gizmo-select">
        <option value="translate">Move (G)</option>
        <option value="rotate">Rotate</option>
        <option value="scale">Scale</option>
      </select>
      <div class="sep"></div>
      <div class="btn import-btn">📂 Import Model</div>
      <div class="sep"></div>
      <div class="btn delete-btn">Delete (Del)</div>
      <div class="btn exit-btn">Exit (F10)</div>
    `;
    root.appendChild(bar);

    // Hidden file input for Import Model button
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".glb,.gltf,.obj,.fbx";
    fileInput.style.display = "none";
    root.appendChild(fileInput);

    bar.querySelector(".import-btn").addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const ext = file.name.split(".").pop().toLowerCase();
        if (["glb", "gltf", "obj", "fbx"].includes(ext)) {
          this._loadDroppedFileWithPersistence(file);
        } else {
          this._setStatus("Unsupported file type. Use .glb, .gltf, .obj, or .fbx");
        }
        fileInput.value = ""; // Reset so same file can be re-imported
      }
    });

    // Bind bar controls
    const speedSlider = bar.querySelector(".speed-slider");
    const speedVal = bar.querySelector(".speed-val");
    speedSlider.addEventListener("input", () => {
      this.flySpeed = parseFloat(speedSlider.value);
      speedVal.textContent = this.flySpeed;
    });

    const gizmoSelect = bar.querySelector(".gizmo-select");
    gizmoSelect.addEventListener("change", () => {
      this.gizmoMode = gizmoSelect.value;
    });

    bar.querySelector(".delete-btn").addEventListener("click", () => this._deleteSelected());
    bar.querySelector(".exit-btn").addEventListener("click", () => {
      // Game will handle the actual exit via mode change
      if (this._onExitCallback) this._onExitCallback();
    });

    // Status bar
    const status = document.createElement("div");
    status.className = "editor-status";
    status.textContent = "Drag & drop model files (.glb .gltf .obj .fbx) • Right-drag to look • Click to place/select • G cycle gizmo";
    root.appendChild(status);

    // Drop zone overlay (shown on drag-over)
    const dropZone = document.createElement("div");
    dropZone.className = "editor-drop-zone";
    dropZone.textContent = "DROP MODEL FILE HERE";
    root.appendChild(dropZone);

    // Props list panel
    const propsPanel = document.createElement("div");
    propsPanel.className = "editor-props-panel";
    propsPanel.innerHTML = `<h3>Placed Props</h3>`;
    root.appendChild(propsPanel);

    // Transform panel (for selected object)
    const transformPanel = document.createElement("div");
    transformPanel.className = "editor-transform";
    transformPanel.innerHTML = `
      <b>Transform</b>
      <div class="row"><label>Pos X</label><input type="number" step="0.1" data-field="px"></div>
      <div class="row"><label>Pos Y</label><input type="number" step="0.1" data-field="py"></div>
      <div class="row"><label>Pos Z</label><input type="number" step="0.1" data-field="pz"></div>
      <div class="row"><label>Rot X°</label><input type="number" step="1" data-field="rx"></div>
      <div class="row"><label>Rot Y°</label><input type="number" step="1" data-field="ry"></div>
      <div class="row"><label>Rot Z°</label><input type="number" step="1" data-field="rz"></div>
      <div class="row"><label>Scale</label><input type="number" step="0.05" min="0.01" data-field="s"></div>
    `;
    root.appendChild(transformPanel);

    // Bind transform inputs
    transformPanel.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("change", () => this._onTransformInput(inp));
    });

    this._ui = { root, bar, status, dropZone, propsPanel, transformPanel, speedSlider, speedVal, gizmoSelect };
    this._renderPropsList();
  }

  _destroyUI() {
    if (!this._ui) return;
    this._ui.root.remove();
    this._ui = null;
  }

  _renderPropsList() {
    if (!this._ui) return;
    const panel = this._ui.propsPanel;
    // Keep the heading
    panel.innerHTML = `<h3>Placed Props (${this.props.length})</h3>`;
    for (const p of this.props) {
      const div = document.createElement("div");
      div.className = "prop-item" + (this.selected === p ? " selected" : "");
      div.textContent = p.fileName || `prop_${p.id}`;
      div.addEventListener("click", () => this._selectProp(p));
      panel.appendChild(div);
    }

    // Also list existing scene objects
    const sceneObjs = this._getSelectableSceneObjects();
    if (sceneObjs.length > 0) {
      const h = document.createElement("h3");
      h.textContent = `Scene Objects (${sceneObjs.length})`;
      h.style.marginTop = "12px";
      panel.appendChild(h);
      for (const obj of sceneObjs) {
        const div = document.createElement("div");
        div.className = "prop-item" + (this.selected && this.selected.obj3d === obj ? " selected" : "");
        div.textContent = obj.name || obj.type || "Object";
        div.addEventListener("click", () => this._selectSceneObject(obj));
        panel.appendChild(div);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  _bindEvents() {
    window.addEventListener("dragover", this._onDragOver);
    window.addEventListener("dragleave", this._onDragLeave);
    window.addEventListener("drop", this._onDrop);
    window.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("wheel", this._onWheel, { passive: false });
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("contextmenu", this._onContextMenu);
  }

  _unbindEvents() {
    window.removeEventListener("dragover", this._onDragOver);
    window.removeEventListener("dragleave", this._onDragLeave);
    window.removeEventListener("drop", this._onDrop);
    window.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("contextmenu", this._onContextMenu);
  }

  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (this._ui) this._ui.dropZone.style.display = "flex";
  }

  _handleDragLeave(e) {
    // Only hide if leaving the window
    if (e.relatedTarget === null && this._ui) {
      this._ui.dropZone.style.display = "none";
    }
  }

  _handleDrop(e) {
    e.preventDefault();
    if (this._ui) this._ui.dropZone.style.display = "none";
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    // Process first supported file
    for (const file of files) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["glb", "gltf", "obj", "fbx"].includes(ext)) {
        this._loadDroppedFileWithPersistence(file);
        return;
      }
    }
    this._setStatus("Unsupported file type. Use .glb, .gltf, .obj, or .fbx");
  }

  _handleMouseDown(e) {
    if (!this.active) return;
    if (e.button === 2) {
      // Right mouse: start looking
      this._rmbDown = true;
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      return;
    }
    if (e.button === 0) {
      // Left click
      // Ignore clicks on UI
      if (e.target.closest && e.target.closest(".editor-overlay")) return;

      if (this._held) {
        // Place the held model
        this._placeHeld();
      } else if (this.selected && this.gizmoMode === "translate") {
        // Start dragging the selected prop
        this._dragging = true;
      } else {
        // Try to select an object in the scene
        this._trySelect(e);
      }
    }
  }

  _handleMouseUp(e) {
    if (e.button === 2) this._rmbDown = false;
    if (e.button === 0 && this._dragging) {
      this._dragging = false;
      this.saveProps();
    }
  }

  _handleMouseMove(e) {
    if (!this.active) return;

    // Update normalised mouse for raycasting
    this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Right-drag look
    if (this._rmbDown) {
      const dx = e.clientX - this._lastMouseX;
      const dy = e.clientY - this._lastMouseY;
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this.flyYaw -= dx * 0.003;
      this.flyPitch -= dy * 0.003;
      this.flyPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.flyPitch));
    }

    // Drag selected prop
    if (this._dragging && this.selected) {
      const hit = this._raycastGround();
      if (hit) {
        this.selected.obj3d.position.x = hit.x;
        this.selected.obj3d.position.z = hit.z;
        // Keep Y on ground or terrain
        this.selected.obj3d.position.y = hit.y;
      }
    }

    // Update held preview
    if (this._held) {
      this._updateHeldPreview();
    }
  }

  _handleWheel(e) {
    if (!this.active) return;
    e.preventDefault();

    if (this.selected && !this._held) {
      // Scroll to adjust selected prop based on gizmo mode
      const delta = e.deltaY > 0 ? -1 : 1;
      if (this.gizmoMode === "rotate") {
        this.selected.obj3d.rotation.y += delta * 0.1;
        this.saveProps();
      } else if (this.gizmoMode === "scale") {
        const factor = 1 + delta * 0.05;
        this.selected.obj3d.scale.multiplyScalar(factor);
        this.saveProps();
      } else {
        // Adjust fly speed
        this.flySpeed = Math.max(2, Math.min(100, this.flySpeed + delta * 2));
        if (this._ui) {
          this._ui.speedSlider.value = this.flySpeed;
          this._ui.speedVal.textContent = Math.round(this.flySpeed);
        }
      }
    } else {
      // Adjust fly speed
      const delta = e.deltaY > 0 ? -1 : 1;
      this.flySpeed = Math.max(2, Math.min(100, this.flySpeed + delta * 2));
      if (this._ui) {
        this._ui.speedSlider.value = this.flySpeed;
        this._ui.speedVal.textContent = Math.round(this.flySpeed);
      }
    }
  }

  _handleKeyDown(e) {
    if (!this.active) return;
    if (e.code === "KeyG") {
      // Cycle gizmo mode
      const modes = ["translate", "rotate", "scale"];
      const idx = (modes.indexOf(this.gizmoMode) + 1) % modes.length;
      this.gizmoMode = modes[idx];
      if (this._ui) this._ui.gizmoSelect.value = this.gizmoMode;
      this._setStatus(`Gizmo: ${this.gizmoMode}`);
    }
    if (e.code === "Delete" || e.code === "Backspace") {
      this._deleteSelected();
    }
  }

  // -------------------------------------------------------------------------
  // Free-fly camera
  // -------------------------------------------------------------------------

  _updateFly(dt) {
    // Read keyboard directly (we bypass Input to avoid conflicts)
    const keys = this.input ? this.input.keys : new Map();
    const down = (code) => !!keys.get(code);

    const forward = new THREE.Vector3(
      -Math.sin(this.flyYaw) * Math.cos(this.flyPitch),
      Math.sin(this.flyPitch),
      -Math.cos(this.flyYaw) * Math.cos(this.flyPitch)
    ).normalize();
    const right = new THREE.Vector3(Math.cos(this.flyYaw), 0, -Math.sin(this.flyYaw));
    const up = new THREE.Vector3(0, 1, 0);

    let speed = this.flySpeed;
    if (down("ShiftLeft") || down("ShiftRight")) speed *= 3;

    const move = new THREE.Vector3();
    if (down("KeyW")) move.add(forward);
    if (down("KeyS")) move.sub(forward);
    if (down("KeyD")) move.add(right);
    if (down("KeyA")) move.sub(right);
    if (down("KeyE") || down("Space")) move.add(up);
    if (down("KeyQ") || down("ControlLeft")) move.sub(up);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.flyPos.add(move);
    }

    // Apply to camera
    this.camera.position.copy(this.flyPos);
    const euler = new THREE.Euler(this.flyPitch, this.flyYaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  // -------------------------------------------------------------------------
  // File loading
  // -------------------------------------------------------------------------

  _loadDroppedFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const url = URL.createObjectURL(file);
    this._objectUrls.push(url);
    this._heldFileName = file.name;
    this._heldUrl = file.name; // Store file name for saved reference

    this._setStatus(`Loading ${file.name}…`);

    const onLoaded = (obj3d) => {
      // Normalize: auto-scale to ~2m tall
      const box = new THREE.Box3().setFromObject(obj3d);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetSize = 2;
        const s = targetSize / maxDim;
        obj3d.scale.setScalar(s);
      }

      // Enable shadows
      obj3d.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Semi-transparent preview
      this._setPreviewMaterial(obj3d, true);

      this._held = obj3d;
      this.scene.add(obj3d);
      this._setStatus(`${file.name} loaded — click to place, scroll to adjust`);
    };

    const onError = (err) => {
      console.warn("[Editor] Failed to load model:", err);
      this._setStatus(`Failed to load ${file.name}`);
    };

    switch (ext) {
      case "glb":
      case "gltf":
        this._gltfLoader.load(url, (gltf) => onLoaded(gltf.scene), undefined, onError);
        break;
      case "fbx":
        this._fbxLoader.load(url, (group) => onLoaded(group), undefined, onError);
        break;
      case "obj":
        this._objLoader.load(url, (group) => onLoaded(group), undefined, onError);
        break;
      default:
        this._setStatus("Unsupported file format: " + ext);
    }
  }

  // -------------------------------------------------------------------------
  // Placement
  // -------------------------------------------------------------------------

  _placeHeld() {
    if (!this._held) return;

    // Remove preview transparency
    this._setPreviewMaterial(this._held, false);

    const id = this._nextId++;
    const prop = {
      id,
      fileName: this._heldFileName,
      url: this._heldUrl,
      obj3d: this._held,
      isEditorProp: true,
    };
    this._held.userData.editorPropId = id;
    this.props.push(prop);
    this._held = null;
    this._heldFileName = "";
    this._heldUrl = "";

    this._selectProp(prop);
    this.saveProps();
    this._renderPropsList();
    this._setStatus("Prop placed! Click to select, G to change gizmo mode.");
  }

  _clearHeld() {
    if (this._held) {
      this.scene.remove(this._held);
      this._held = null;
    }
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  _trySelect(e) {
    this._ray.setFromCamera(this._mouse, this.camera);

    // First: check editor-placed props
    const propObjects = this.props.map(p => p.obj3d);
    const hits = this._ray.intersectObjects(propObjects, true);
    if (hits.length > 0) {
      // Find which prop owns this mesh
      let obj = hits[0].object;
      while (obj.parent && !obj.userData.editorPropId) obj = obj.parent;
      const prop = this.props.find(p => p.obj3d === obj || p.id === obj.userData.editorPropId);
      if (prop) {
        this._selectProp(prop);
        return;
      }
    }

    // Second: check all scene meshes (for existing game objects)
    const sceneHits = this._ray.intersectObjects(this.scene.children, true);
    for (const hit of sceneHits) {
      let obj = hit.object;
      // Walk up to find a meaningful parent (Group with children, not the scene itself)
      while (obj.parent && obj.parent !== this.scene && !(obj.parent.isGroup && obj.parent.children.length > 1)) {
        obj = obj.parent;
      }
      // Skip ground planes, sky sphere, lights
      if (obj === this.scene) continue;
      if (obj.isLight) continue;
      if (obj.geometry && obj.geometry.type === "SphereGeometry" && obj.material && obj.material.side === THREE.BackSide) continue;

      this._selectSceneObject(obj);
      return;
    }

    this._deselect();
  }

  _selectProp(prop) {
    this._deselect();
    this.selected = prop;
    this._createSelectionBox(prop.obj3d);
    this._renderPropsList();
    if (this._ui) this._ui.transformPanel.style.display = "block";
  }

  _selectSceneObject(obj) {
    this._deselect();
    // Create a virtual prop entry for scene objects
    this.selected = {
      id: -1,
      fileName: obj.name || obj.type || "Scene Object",
      obj3d: obj,
      isSceneObject: true,
    };
    this._createSelectionBox(obj);
    this._renderPropsList();
    if (this._ui) this._ui.transformPanel.style.display = "block";
  }

  _deselect() {
    this.selected = null;
    this._removeSelectionBox();
    this._dragging = false;
    if (this._ui) this._ui.transformPanel.style.display = "none";
    this._renderPropsList();
  }

  _deleteSelected() {
    if (!this.selected) return;
    if (this.selected.isSceneObject) {
      this._setStatus("Cannot delete built-in scene objects.");
      return;
    }
    const idx = this.props.indexOf(this.selected);
    if (idx !== -1) {
      this.scene.remove(this.selected.obj3d);
      this.props.splice(idx, 1);
      this._deselect();
      this.saveProps();
      this._renderPropsList();
      this._setStatus("Prop deleted.");
    }
  }

  // -------------------------------------------------------------------------
  // Selection highlight (bounding box wireframe)
  // -------------------------------------------------------------------------

  _createSelectionBox(obj) {
    this._removeSelectionBox();
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ab8ff,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    this._selBox = new THREE.Mesh(geo, mat);
    this._selBox.position.copy(center);
    this._selBox.renderOrder = 999;
    this.scene.add(this._selBox);
  }

  _removeSelectionBox() {
    if (this._selBox) {
      this.scene.remove(this._selBox);
      this._selBox.geometry.dispose();
      this._selBox.material.dispose();
      this._selBox = null;
    }
  }

  _updateSelectionBox() {
    if (!this.selected || !this._selBox) return;
    const box = new THREE.Box3().setFromObject(this.selected.obj3d);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    this._selBox.position.copy(center);
    this._selBox.scale.set(
      size.x / (this._selBox.geometry.parameters.width || 1),
      size.y / (this._selBox.geometry.parameters.height || 1),
      size.z / (this._selBox.geometry.parameters.depth || 1)
    );
  }

  // -------------------------------------------------------------------------
  // Transform panel
  // -------------------------------------------------------------------------

  _updateTransformPanel() {
    if (!this._ui || !this.selected) return;
    const panel = this._ui.transformPanel;
    if (panel.style.display === "none") return;
    const obj = this.selected.obj3d;

    // Only update if not focused (avoid overwriting user edits)
    panel.querySelectorAll("input").forEach(inp => {
      if (document.activeElement === inp) return;
      const f = inp.dataset.field;
      if (f === "px") inp.value = obj.position.x.toFixed(2);
      if (f === "py") inp.value = obj.position.y.toFixed(2);
      if (f === "pz") inp.value = obj.position.z.toFixed(2);
      if (f === "rx") inp.value = (obj.rotation.x * 180 / Math.PI).toFixed(1);
      if (f === "ry") inp.value = (obj.rotation.y * 180 / Math.PI).toFixed(1);
      if (f === "rz") inp.value = (obj.rotation.z * 180 / Math.PI).toFixed(1);
      if (f === "s") inp.value = obj.scale.x.toFixed(3);
    });
  }

  _onTransformInput(inp) {
    if (!this.selected) return;
    const obj = this.selected.obj3d;
    const v = parseFloat(inp.value);
    if (isNaN(v)) return;
    const f = inp.dataset.field;
    if (f === "px") obj.position.x = v;
    if (f === "py") obj.position.y = v;
    if (f === "pz") obj.position.z = v;
    if (f === "rx") obj.rotation.x = v * Math.PI / 180;
    if (f === "ry") obj.rotation.y = v * Math.PI / 180;
    if (f === "rz") obj.rotation.z = v * Math.PI / 180;
    if (f === "s") { const sv = Math.max(0.01, v); obj.scale.set(sv, sv, sv); }
    this.saveProps();
  }

  // -------------------------------------------------------------------------
  // Raycasting
  // -------------------------------------------------------------------------

  _raycastGround() {
    this._ray.setFromCamera(this._mouse, this.camera);

    // Try terrain first
    if (this.terrain && this.terrain.ready && this.terrain.mesh) {
      const terrainHits = this._ray.intersectObject(this.terrain.mesh, false);
      if (terrainHits.length > 0) return terrainHits[0].point;
    }

    // Fallback: intersect y=0 plane
    const target = new THREE.Vector3();
    if (this._ray.ray.intersectPlane(this._groundPlane, target)) {
      return target;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Preview (held model follows mouse cursor on ground)
  // -------------------------------------------------------------------------

  _updateHeldPreview() {
    if (!this._held) return;
    const hit = this._raycastGround();
    if (hit) {
      this._held.position.copy(hit);
      // Adjust Y so bottom is on ground
      const box = new THREE.Box3().setFromObject(this._held);
      const minY = box.min.y;
      this._held.position.y += hit.y - minY;
    }
  }

  _setPreviewMaterial(obj, transparent) {
    obj.traverse(child => {
      if (!child.isMesh) return;
      if (transparent) {
        // Store originals
        child.userData._origMaterial = child.material;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const cloned = mats.map(m => {
          const c = m.clone();
          c.transparent = true;
          c.opacity = 0.5;
          c.depthWrite = false;
          return c;
        });
        child.material = cloned.length === 1 ? cloned[0] : cloned;
      } else {
        // Restore originals
        if (child.userData._origMaterial) {
          child.material = child.userData._origMaterial;
          delete child.userData._origMaterial;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Scene object helpers
  // -------------------------------------------------------------------------

  /** Returns top-level groups in the scene that are "interesting" to select. */
  _getSelectableSceneObjects() {
    const ignore = new Set();
    // Ignore lights, camera, sky, editor's own objects
    this.scene.traverse(child => {
      if (child.isLight || child.isCamera) ignore.add(child);
    });
    if (this._selBox) ignore.add(this._selBox);
    if (this._held) ignore.add(this._held);

    const result = [];
    for (const child of this.scene.children) {
      if (ignore.has(child)) continue;
      if (child.isLight || child.isCamera) continue;
      // Skip sky sphere
      if (child.geometry && child.geometry.type === "SphereGeometry" && child.material && child.material.side === THREE.BackSide) continue;
      // Skip editor props (handled separately)
      if (child.userData.editorPropId) continue;
      // Only groups with meaningful content
      if (child.isGroup || child.isMesh) {
        result.push(child);
      }
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------------

  /**
   * Load a prop from a saved entry. For user-dropped files, we use the saved
   * file name. Since the original file is not available on reload (browser
   * security), we store the geometry + materials as base64 GLB using
   * THREE.js GLTFExporter when saving. For simplicity in this implementation,
   * we persist positions/transforms and re-create placeholder geometry if the
   * original file is gone (the user can re-drop files).
   *
   * Note: Full file persistence would require a backend server or IndexedDB
   * binary storage. This implementation uses IndexedDB for file data.
   */
  _loadPropFromEntry(entry) {
    // Try loading from IndexedDB
    this._loadFileFromIDB(entry.fileName).then(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        this._objectUrls.push(url);
        const ext = entry.fileName.split(".").pop().toLowerCase();
        const onLoaded = (obj3d) => {
          obj3d.position.set(entry.position.x, entry.position.y, entry.position.z);
          obj3d.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
          obj3d.scale.set(entry.scale.x, entry.scale.y, entry.scale.z);
          obj3d.traverse(child => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
          });

          const id = this._nextId++;
          obj3d.userData.editorPropId = id;
          this.scene.add(obj3d);
          this.props.push({
            id,
            fileName: entry.fileName,
            url: entry.url || entry.fileName,
            obj3d,
            isEditorProp: true,
          });
          if (this._ui) this._renderPropsList();
        };
        const onError = () => this._createPlaceholder(entry);

        switch (ext) {
          case "glb": case "gltf":
            this._gltfLoader.load(url, gltf => onLoaded(gltf.scene), undefined, onError);
            break;
          case "fbx":
            this._fbxLoader.load(url, group => onLoaded(group), undefined, onError);
            break;
          case "obj":
            this._objLoader.load(url, group => onLoaded(group), undefined, onError);
            break;
          default:
            this._createPlaceholder(entry);
        }
      } else {
        this._createPlaceholder(entry);
      }
    }).catch(() => this._createPlaceholder(entry));
  }

  /** Create a colored box placeholder when the original file can't be reloaded. */
  _createPlaceholder(entry) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6644, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
    mesh.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
    mesh.scale.set(entry.scale.x, entry.scale.y, entry.scale.z);

    const id = this._nextId++;
    mesh.userData.editorPropId = id;
    mesh.name = entry.fileName + " (placeholder)";
    this.scene.add(mesh);
    this.props.push({
      id,
      fileName: entry.fileName + " ⚠️",
      url: entry.url || entry.fileName,
      obj3d: mesh,
      isEditorProp: true,
    });
    if (this._ui) this._renderPropsList();
  }

  // -------------------------------------------------------------------------
  // IndexedDB for file persistence
  // -------------------------------------------------------------------------

  /**
   * Save a dropped file's binary data to IndexedDB so it persists across
   * page reloads without needing a server.
   */
  _saveFileToIDB(fileName, file) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("wasteland_editor_files", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "name" });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction("files", "readwrite");
        const store = tx.objectStore("files");
        store.put({ name: fileName, blob: file });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  _loadFileFromIDB(fileName) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("wasteland_editor_files", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "name" });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        const getReq = store.get(fileName);
        getReq.onsuccess = () => {
          if (getReq.result && getReq.result.blob) resolve(getReq.result.blob);
          else resolve(null);
        };
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  }

  // -------------------------------------------------------------------------
  // Enhanced file drop: also saves to IDB
  // -------------------------------------------------------------------------

  _loadDroppedFileWithPersistence(file) {
    // Save file to IDB for future reloads
    this._saveFileToIDB(file.name, file).catch(err => {
      console.warn("[Editor] Failed to persist file to IndexedDB:", err);
    });
    this._loadDroppedFile(file);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  _setStatus(msg) {
    if (this._ui) this._ui.status.textContent = msg;
  }

  /** Set the exit callback (called when user clicks Exit button). */
  onExit(cb) {
    this._onExitCallback = cb;
  }
}
