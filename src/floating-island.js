import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { sendTelegramMessage } from "./telegram.js";

var container = { width: window.innerWidth, height: window.innerHeight };
const startCamDistanceMultiplier = 2;
const landScale = 1;
let currentUser = null;

// Add this at the start of the file, after imports
const DEBUG = true;

// Add this function near the top
const debugLog = (message) => {
  if (!DEBUG) return;

  // Create or get debug console
  let debugConsole = document.getElementById("debug-console");
  if (!debugConsole) {
    debugConsole = document.createElement("div");
    debugConsole.id = "debug-console";
    debugConsole.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 10px;
            max-height: 150px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 5px;
            overflow-y: auto;
            z-index: 1000;
        `;
    document.body.appendChild(debugConsole);
  }

  // Add new message
  const msgElement = document.createElement("div");
  msgElement.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  debugConsole.appendChild(msgElement);

  // Keep only last 10 messages
  while (debugConsole.children.length > 10) {
    debugConsole.removeChild(debugConsole.firstChild);
  }

  // Scroll to bottom
  debugConsole.scrollTop = debugConsole.scrollHeight;
};

// Rotate arms / legs
const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Add shadow support to object
const shadowSupport = (group) => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
};

// Get random number
const randomize = (min, max, float = false) => {
  const val = Math.random() * (max - min) + min;
  if (float) {
    return val;
  }
  return Math.floor(val);
};

// Random MORE VERTICES
const map = (val, smin, smax, emin, emax) =>
  ((emax - emin) * (val - smin)) / (smax - smin) + emin;

// Update the jitter function to maintain connectivity
const jitter = (geo, per) => {
  const pos = geo.getAttribute("position");
  const arr = pos.array;
  const vertexCount = pos.count;

  // Create an array to store the jitter values for each unique vertex
  const jitterMap = new Map();

  // First pass: calculate and store jitter for each unique vertex position
  for (let i = 0; i < arr.length; i += 3) {
    const key = `${Math.round(arr[i] * 100)},${Math.round(
      arr[i + 1] * 100
    )},${Math.round(arr[i + 2] * 100)}`;

    if (!jitterMap.has(key)) {
      jitterMap.set(key, {
        x: map(Math.random(), 0, 1, -per, per),
        y: map(Math.random(), 0, 1, -per, per),
        z: map(Math.random(), 0, 1, -per, per),
      });
    }
  }

  // Second pass: apply the same jitter to shared vertices
  for (let i = 0; i < arr.length; i += 3) {
    const key = `${Math.round(arr[i] * 100)},${Math.round(
      arr[i + 1] * 100
    )},${Math.round(arr[i + 2] * 100)}`;
    const jitterVal = jitterMap.get(key);

    arr[i] += jitterVal.x; // x
    arr[i + 1] += jitterVal.y; // y
    arr[i + 2] += jitterVal.z; // z
  }

  pos.needsUpdate = true;
  return geo;
};

function noiseMap(size = 256, intensity = 20, repeat = 30) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  let imageData = ctx.createImageData(size, size);
  let data = imageData.data;

  for (let i = 0; i < size * size; i++) {
    let noise = Math.random() * intensity;
    let idx = i * 4;
    data[idx] = noise; // R
    data[idx + 1] = noise; // G
    data[idx + 2] = noise; // B
    data[idx + 3] = 255; // A
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);

  return texture;
}

const setupIslandLight = (
  scene,
  position,
  color = "#ffb157",
  intensity = 1.5
) => {
  if (intensity == 0) {
    return;
  }

  const directionalLight = new THREE.DirectionalLight(color, intensity);
  scene.add(directionalLight);

  // console.log(position);
  directionalLight.position.set(
    position.x + 10,
    position.y + 20,
    position.z + 10
  );
  directionalLight.castShadow = true;
  directionalLight.receiveShadow = true;

  // Create and set target position
  const target = new THREE.Object3D();
  target.position.set(position.x, position.y, position.z);
  scene.add(target);
  directionalLight.target = target;

  directionalLight.decay = 0;

  // Shadow settings
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 5;
  directionalLight.shadow.camera.far = 100;
  directionalLight.shadow.bias = -0.001;

  // Shadow camera frustum
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;

  // const helper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(helper);

  return directionalLight;
};

class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.partnerName = data.partnerName;
    this.hasPlusOne = data.partnerName !== null;
    this.isFamily = data.family;
    this.kidNames = data.kidNames;
    this.numberOfKids = data.kidNames.length;
    this.confirmed = data.confirmed;
    this.accommodation = data.accom;
    this.dietaryRequirements = data.dietary;
  }

  getTotalGuests() {
    let total = 1; // The main guest
    if (this.hasPlusOne) total++;
    total += this.numberOfKids;
    return total;
  }

  getFamilyString() {
    if (!this.hasPlusOne && this.numberOfKids === 0) {
      return this.name;
    }

    const names = [this.name];
    if (this.hasPlusOne) {
      names.push(this.partnerName);
    }
    names.push(...this.kidNames);

    // Split into pairs while maintaining comma placement
    const pairs = [];
    for (let i = 0; i < names.length; i += 2) {
      if (i + 2 < names.length) {
        // More names will follow, add comma
        pairs.push(`${names[i]}, ${names[i + 1]}`);
      } else if (i + 1 < names.length) {
        // Last two names
        pairs.push(`${names[i]} and ${names[i + 1]}`);
      } else {
        // Single name at the end
        pairs.push(names[i]);
      }
    }

    return pairs.join("\n");
  }

  isVIP() {
    return this.isFamily;
  }
}

const initUser = async () => {
  const userId = parseInt(localStorage.getItem("userId"));

  try {
    const response = await fetch("/data.json");
    const guestData = await response.json();
    const userData = guestData.find((guest) => guest.id === userId);
    if (userData) {
      currentUser = new User(userData);
    } else {
      currentUser = null;
    }
  } catch (error) {
    // Silently handle error
    currentUser = null;
  }
};

// Add this class before the Scene class
class RainEffect {
  constructor(
    scene,
    center = { x: 0, y: 0, z: 0 },
    radius = 30,
    dropCount = 1500
  ) {
    this.scene = scene;
    this.center = center;
    this.radius = radius;
    this.dropCount = dropCount;
    this.raindrops = new THREE.Group();
    this.createRain();
  }

  createRain() {
    // Create raindrop geometry and material
    const rainGeometry = new THREE.BufferGeometry();
    const rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.3,
      transparent: true,
      opacity: 0.7,
    });

    // Create vertices for raindrops
    const vertices = [];
    for (let i = 0; i < this.dropCount; i++) {
      // Random position within a cylinder
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * this.radius;
      const x = this.center.x + r * Math.cos(theta);
      const y = this.center.y + Math.random() * 80; // Height range
      const z = this.center.z + r * Math.sin(theta);

      vertices.push(x, y, z);
    }

    rainGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    this.raindrops = new THREE.Points(rainGeometry, rainMaterial);
    // this.scene.add(this.raindrops);
  }

  animate() {
    const positions = this.raindrops.geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
      // Move raindrop down
      positions[i + 1] -= 0.3; // Speed of fall

      // Reset raindrop to top when it falls below threshold
      if (positions[i + 1] < this.center.y - 40) {
        positions[i + 1] = this.center.y + 40;
      }
    }

    this.raindrops.geometry.attributes.position.needsUpdate = true;
  }
}

class Scene {
  constructor(params) {
    this.params = {
      x: 0,
      y: 0,
      z: 0,
      aspectRatio: container.width / container.height,
      fieldOfView: 70,
      nearPlane: 0.1,
      farPlane: 3000,
      ...params,
    };
    this.camera;
    this.scene;
    this.controls;
    this.renderer;
    this.autoRotationEnabled = true;
  }

  initLegend() {
    // Create legend container
    const legend = document.createElement("div");
    legend.style.position = "absolute";
    legend.style.top = "10px";
    legend.style.left = "10px";
    legend.style.padding = "15px";
    legend.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
    legend.style.color = "rgba(255, 255, 255, 0.7)";
    legend.style.borderRadius = "5px";
    legend.style.fontFamily = "Arial, sans-serif";
    legend.style.fontSize = "14px";
    legend.style.zIndex = "1000";

    // Add instructions text
    legend.innerHTML = `
      <div style="margin-bottom: 8px"><b>Controls:</b></div>
      <div>• Click and drag to rotate view</div>
      <div>• Scroll to zoom in/out</div>
      <div>• Press space bar to toggle auto rotation</div>
      <div>• Click on islands to travel between them</div>
      <div>• Click on (some) signposts to interact</div>
    `;

    document.body.appendChild(legend);
  }

  initStats() {
    // STATS
    this.stats = new Stats();
    this.stats.setMode(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    // align top-left
    this.stats.domElement.style.position = "absolute";
    this.stats.domElement.style.left = "0px";
    this.stats.domElement.style.top = "0px";
    // document.body.appendChild(this.stats.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    const topColor = new THREE.Color("#6dd5fa");
    const bottomColor = new THREE.Color("#ffefff");
    const gradientTexture = new THREE.CanvasTexture(
      (() => {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 512;
        const context = canvas.getContext("2d");
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, topColor.getStyle());
        gradient.addColorStop(1, bottomColor.getStyle());
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);
        return canvas;
      })()
    );
    this.scene.background = gradientTexture;
    this.scene.fog = new THREE.FogExp2("#6dd5fa", 0.007);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      this.params.fieldOfView,
      this.params.aspectRatio,
      this.params.nearPlane,
      this.params.farPlane
    );
    //this.camera.position.set(0, 3.5, 22);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(
      -25 * startCamDistanceMultiplier,
      10 + 5 * startCamDistanceMultiplier,
      25 * startCamDistanceMultiplier
    );
    this.camera.lookAt(this.scene.position);
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 35;
    this.controls.maxDistance = 150;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = -0.2;

    // Add space bar event listener
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        this.autoRotationEnabled = !this.autoRotationEnabled;
        this.controls.autoRotate = this.autoRotationEnabled;
      }
    });
  }

  initRenderer() {
    let pixelRatio = window.devicePixelRatio;
    let AA = true;
    if (pixelRatio > 1) {
      AA = false;
    }
    const canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: AA,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(container.width, container.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    //renderer.setClearColor(0xc5f5f5, 0);
    this.renderer.physicallyCorrectLights;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.soft = true;
    document.body.appendChild(canvas);
  }

  initLights() {
    this.light = new THREE.HemisphereLight("#ffa600", "#ffffff", 0.3); //b3858c
    this.scene.add(this.light);
  }

  render() {
    this.stats.begin();
    this.controls.update();
    requestAnimationFrame(this.render.bind(this));
    this.renderer.render(this.scene, this.camera);
    this.stats.end();
  }

  init() {
    this.initStats();
    // this.initLegend();
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initControls();
    this.initLights();
    this.initClickHandler();
  }

  initClickHandler() {
    this.cameraController = new CameraController(this.camera, this.controls);
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let startPosition = { x: 0, y: 0 };

    const handleClick = (event) => {
      // Get click coordinates
      const x = event.clientX || (event.touches && event.touches[0].clientX);
      const y = event.clientY || (event.touches && event.touches[0].clientY);

      // Convert to normalized device coordinates
      mouse.x = (x / window.innerWidth) * 2 - 1;
      mouse.y = -(y / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);

      // Find all meshes in the scene
      const meshes = [];
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          meshes.push(object);
        }
      });

      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Handle signpost clicks
        if (clickedObject.userData.onClick) {
          clickedObject.userData.onClick();
          return;
        }

        // Handle island navigation
        let current = clickedObject;
        while (current.parent && !current.__islandInstance) {
          current = current.parent;
        }

        if (
          current.__islandInstance &&
          !this.cameraController.isAtPosition(current.position)
        ) {
          this.cameraController.moveTo(current.position);
        }
      }
    };

    const handleDragStart = (event) => {
      isDragging = false;
      startPosition = {
        x: event.clientX || (event.touches && event.touches[0].clientX),
        y: event.clientY || (event.touches && event.touches[0].clientY),
      };
    };

    const handleDragMove = (event) => {
      if (!startPosition) return;

      const currentX =
        event.clientX || (event.touches && event.touches[0].clientX);
      const currentY =
        event.clientY || (event.touches && event.touches[0].clientY);

      if (
        Math.abs(currentX - startPosition.x) > 10 ||
        Math.abs(currentY - startPosition.y) > 10
      ) {
        isDragging = true;
      }
    };

    const handleDragEnd = (event) => {
      if (!isDragging) {
        handleClick(event);
      }
      startPosition = null;
    };

    const canvas = this.renderer.domElement;

    canvas.addEventListener("mousedown", handleDragStart);
    canvas.addEventListener("mousemove", handleDragMove);
    canvas.addEventListener("mouseup", handleDragEnd);

    canvas.addEventListener("touchstart", handleDragStart, { passive: true });
    canvas.addEventListener("touchmove", handleDragMove, { passive: true });
    canvas.addEventListener("touchend", handleDragEnd);
  }
}

class CameraController {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.isAnimating = false;
    this.currentTarget = null;
  }

  isAtPosition(position) {
    // Check if we're already focused on this position
    if (!this.currentTarget) return false;

    const tolerance = 0.1; // Adjust this value as needed
    return position.distanceTo(this.currentTarget) < tolerance;
  }

  moveTo(targetPosition, duration = 2000) {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.currentTarget = targetPosition.clone();

    // Store initial positions
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    // Calculate target look-at point (slightly above the island)
    const targetLookAt = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + 5,
      targetPosition.z
    );

    // Calculate camera position (offset from target)
    const cameraOffset = new THREE.Vector3(-40, 8.5, 25);
    const finalCameraPos = targetPosition.clone().add(cameraOffset);

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease function (cubic)
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Update camera position
      this.camera.position.lerpVectors(startPosition, finalCameraPos, ease);

      // Update controls target (look-at point)
      this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }
}

class Island {
  constructor(scene, camera, params) {
    this.params = {
      x: 0,
      y: 0,
      z: 0,
      herbs: 2,
      fadeStartDistance: 200,
      fadeEndDistance: 400,
      items: [],
      lightColor: "#ffb157",
      lightIntensity: 1.5,
      enableLightning: false,
      ...params,
    };

    // Add lightning light
    if (this.params.enableLightning) {
      this.lightningLight = new THREE.PointLight("#72b4ff", 0, 100, 0);
      this.lightningLight.position.set(
        this.params.x,
        this.params.y + 10,
        this.params.z
      );
      scene.add(this.lightningLight);

      // Start lightning animation
      this.animateLightning();
    }

    setupIslandLight(
      scene,
      {
        x: this.params.x,
        y: this.params.y,
        z: this.params.z,
      },
      this.params.lightColor,
      this.params.lightIntensity
    );

    // Create group and add to scene
    this.island = new THREE.Group();
    scene.add(this.island);

    // Position according to params
    this.island.position.x = this.params.x;
    this.island.position.y = this.params.y;
    this.island.position.z = this.params.z;

    // Store camera reference
    this.camera = camera;

    // Scale the entire island
    this.island.scale.set(landScale, landScale, landScale);

    // TEXTURES
    this.cloudMaterial = new THREE.MeshPhongMaterial({
      color: 0xdef9ff,
      transparent: true,
      opacity: 0.8,
      flatShading: true,
    });

    this.greenMaterial = new THREE.MeshPhongMaterial({
      color: 0x379351,
      shininess: 80,
      bumpMap: noiseMap(768, 60, 30),
      bumpScale: 150.45,
      flatShading: true,
    });

    this.plainGreenMaterial = new THREE.MeshPhongMaterial({
      color: 0x379351,
      flatShading: true,
    });

    this.earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x664e31,
      flatShading: true,
    });

    this.stoneMaterial = new THREE.MeshPhongMaterial({
      color: 0x9eaeac,
      shadowSide: THREE.FrontSide,
    });

    // Add the instance reference to the group
    this.island.__islandInstance = this;

    // Add update method to animation loop
    const animate = () => {
      this.updateScale();
      requestAnimationFrame(animate);
    };
    animate();
  }

  animateLightning() {
    const createLightningFlash = () => {
      // Random delay between flashes (3-15 seconds)
      const delay = Math.random() * 12000 + 3000;

      setTimeout(() => {
        // Create a sequence of flashes
        const flashSequence = () => {
          const flashes = Math.floor(Math.random() * 3) + 1; // 1-3 flashes
          let flashCount = 0;

          const flash = () => {
            // Random intensity for each flash
            this.lightningLight.intensity = Math.random() * 5 + 5;

            // Quick decay of the flash
            setTimeout(() => {
              this.lightningLight.intensity = 0;
              flashCount++;

              // Continue sequence if more flashes remain
              if (flashCount < flashes) {
                setTimeout(flash, Math.random() * 100);
              }
            }, 50);
          };

          flash();
        };

        flashSequence();
        createLightningFlash(); // Schedule next lightning
      }, delay);
    };

    createLightningFlash(); // Start the first lightning
  }

  addItem(item) {
    // console.log("addItem", item);
    item.parent?.remove(item);
    this.island.add(item);
    // this.params.items.push(item);
  }

  updateScale() {
    const distance = this.camera.position.distanceTo(this.island.position);
    const fadeStart = 400;
    const fadeEnd = 700;
    const scale = 1 - (distance - fadeStart) / (fadeEnd - fadeStart);
    this.island.scale.setScalar(Math.max(0, Math.min(1, scale)) * landScale);
  }

  createGroundParticle() {
    const particles = new THREE.Group();

    for (let i = 0; i < 60; i++) {
      const geoGroundParticule = new THREE.TetrahedronGeometry(
        randomize(1, 2.7), // Smaller size range
        randomize(2, 3)
      );
      jitter(geoGroundParticule, 0.0);

      const particule = new THREE.Mesh(geoGroundParticule, this.earthMaterial);

      particule.scale.set(
        randomize(0.3, 0.6, true),
        randomize(0.3, 0.6, true),
        randomize(0.3, 0.6, true)
      );

      // Spread particles around more
      particule.position.set(
        randomize(randomize(-40, -15, true), randomize(15, 40, true), true),
        randomize(-75, 6, true),
        randomize(randomize(-40, -15, true), randomize(15, 40, true), true)
      );

      particles.add(particule);
    }

    return particles;
  }

  drawGround() {
    this.ground = new THREE.Group();

    // Create earth base
    const geoGround = new THREE.CylinderGeometry(21, 6, 27, 12, 5);
    jitter(geoGround, 1.8);
    geoGround.translate(0, -1.5, 0);
    const earth = new THREE.Mesh(geoGround, this.earthMaterial);

    // Add ground particle
    const particule = this.createGroundParticle();
    this.ground.add(particule);

    // Combine meshes
    this.ground.add(earth);
    this.ground.position.y = -16.8;
    shadowSupport(this.ground);
    this.island.add(this.ground);
  }

  drawCloud() {
    this.clouds = new THREE.Group();

    const geoCloud = new THREE.SphereGeometry(6, 6, 6);
    jitter(geoCloud, 0.6);
    const cloud = new THREE.Mesh(geoCloud, this.cloudMaterial);
    cloud.scale.set(1, 0.8, 1);

    const cloud2 = cloud.clone();
    cloud2.scale.set(0.75, 0.5, 1);
    cloud2.position.set(5.85, -1.5, 0);

    const cloud3 = cloud.clone();
    cloud3.scale.set(0.75, 0.5, 1);
    cloud3.position.set(-5.55, -3, 0);

    this.clouds.add(cloud);
    this.clouds.add(cloud2);
    this.clouds.add(cloud3);

    this.clouds.position.x = -15;
    this.clouds.position.y = 24;
    this.clouds.position.z = -13.8;

    this.island.add(this.clouds);

    const cloneCloudGroup = this.clouds.clone();
    cloneCloudGroup.scale.set(1, 1.2, 1.2);
    cloneCloudGroup.position.x = 18;
    cloneCloudGroup.position.y = 27;
    cloneCloudGroup.position.z = 12;

    const cloneCloudGroup2 = this.clouds.clone();
    cloneCloudGroup2.scale.set(1, 0.7, 0.7);
    cloneCloudGroup2.position.x = randomize(-15, 27, true);
    cloneCloudGroup2.position.y = 15;
    cloneCloudGroup2.position.z = randomize(-27, 27, true);

    this.island.add(cloneCloudGroup);
    this.island.add(cloneCloudGroup2);
  }

  drawRocks() {
    this.rocks = new THREE.Group();
    const geoRocks = new THREE.DodecahedronGeometry(3, 0);

    const rock = new THREE.Mesh(geoRocks, this.stoneMaterial);
    rock.scale.set(randomize(0.8, 1.2, true), randomize(0.9, 2.8, true), 1);

    const rock2 = rock.clone();
    rock2.scale.set(randomize(0.8, 1.2, true), randomize(1, 3, true), 1);
    rock2.position.set(5, 0, -5);
    rock2.rotation.set(0, randomize(-0.7, 0.7, true), 0);

    this.rocks.add(rock);
    this.rocks.add(rock2);
    this.rocks.position.x = -15;
    this.rocks.position.y = -1;
    this.rocks.position.z = -7.5;

    this.island.add(this.rocks);
  }

  drawHerbs(position = { x: 3.3, y: 0, z: 0 }) {
    const width = 0.6;
    this.herbs = new THREE.Group();
    const geoHerbs = new THREE.ConeGeometry(width, 3, 6);
    const herb = new THREE.Mesh(geoHerbs, this.greenMaterial);
    herb.position.set(0, -1.2, 0);
    herb.rotation.set(0, randomize(-0.7, 0.7, true), 0);
    this.herbs.add(herb);

    let i;

    for (i = 0; i < 4; i++) {
      const herbX = herb.clone();
      herbX.position.set(
        randomize(-1.5, 1.5, true),
        -1.2,
        randomize(-1.5, 1.5, true)
      );
      herbX.rotation.set(
        randomize(-0.2, 0.2, true),
        randomize(-0.7, 0.7, true),
        randomize(-0.2, 0.2, true)
      );
      this.herbs.add(herbX);
    }

    this.herbs.position.x = position.x;
    this.herbs.position.y = position.y;
    this.herbs.position.z = position.z;
    shadowSupport(this.herbs);
    this.island.add(this.herbs);
  }

  init() {
    this.drawGround();
    this.drawCloud();
    this.drawRocks();

    this.drawHerbs();
    let i;
    for (i = 0; i < this.params.herbs; i++) {
      this.drawHerbs({
        x: randomize(-15, 15, true),
        y: 0,
        z: randomize(-15, 15, true),
      });
    }

    shadowSupport(this.island);
  }
}

class GroundSurface {
  constructor(params = {}) {
    this.params = {
      x: 0,
      y: 0,
      z: 0,
      groundColor: 0x379351,
      material:
        params.material ||
        new THREE.MeshPhongMaterial({
          color: params.groundColor || 0x379351,
          flatShading: true,
        }),
      ...params,
    };

    // this.params.material.shadowSide = THREE.FrontSide;
    // this.params.material.needsUpdate = true;
  }

  createGroundGeometry() {
    const geoGreen = new THREE.CylinderGeometry(22.2, 16.5, 9.0, 36, 3);
    jitter(geoGreen, 0.6);
    geoGreen.translate(0, -7.5, 0);
    geoGreen.scale(1.05, 1, 1.05);
    const mesh = new THREE.Mesh(geoGreen, this.params.material);
    shadowSupport(mesh);
    return mesh;
  }
}

class Bblock {
  constructor(scenesss, params) {
    this.params = {
      x: 0,
      y: -1,
      z: 0,
      bun: false,
      hairDown: false,
      hairColor: 0xffffff,
      lookAngle: 0,
      ...params,
    };
    // Create group and add to scene
    this.bblock = new THREE.Group();
    scenesss.add(this.bblock);

    // Position according to params
    this.bblock.position.x = this.params.x;
    this.bblock.position.y = this.params.y;
    this.bblock.position.z = this.params.z;

    this.arms = [];
    this.legs = [];

    // TEXTURES
    this.skinMaterial = new THREE.MeshPhongMaterial({
      color: 0xffdbac,
      flatShading: false,
    });
    this.hairMaterial = new THREE.MeshPhongMaterial({
      color: this.params.hairColor,
      flatShading: false,
    });
    this.pantsMaterial = new THREE.MeshPhongMaterial({
      color: Math.random() * 0xffffff,
      flatShading: false,
    });
    this.sweatMaterial = new THREE.MeshPhongMaterial({
      color: Math.random() * 0xffffff,
      flatShading: false,
    });
    this.shoesMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      flatShading: false,
    });

    // Add individual frequencies for each arm with random variation
    this.armFrequencies = [
      3 + Math.random() * 2, // Random frequency between 3-5
      4.5 + Math.random() * 2, // Random frequency between 4.5-6.5
    ];
  }
  drawHead() {
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.5, 2.5),
      this.skinMaterial
    );
    this.head.castShadow = true;
    this.head.receiveShadow = true;
    this.head.position.set(0, 4.8, 0);

    this.hair = new THREE.Mesh(
      new THREE.BoxGeometry(2.95, 2.5, 2.3),
      this.hairMaterial
    );
    this.hair.castShadow = true;
    this.hair.receiveShadow = true;
    this.hair.position.set(0, 0.5, -0.3);

    this.hairFront = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.5, 0.8),
      this.hairMaterial
    );
    this.hairFront.castShadow = true;
    this.hairFront.receiveShadow = true;
    this.hairFront.position.set(0, 1.5, 0.9);

    const tuft1 = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const tuft2 = new THREE.BoxGeometry(0.8, 0.8, 0.8);

    const tuft1Mesh = new THREE.Mesh(tuft1, this.hairMaterial);
    const tuft2Mesh = new THREE.Mesh(tuft2, this.hairMaterial);

    this.hairBun = new THREE.Group();
    this.hairBun.add(tuft1Mesh);
    this.hairBun.add(tuft2Mesh);

    tuft1Mesh.position.set(0, 0, 0);
    tuft2Mesh.position.set(0, 0.7, -0.5);

    this.hairBun.position.set(0, 1.3, -1.3);
    shadowSupport(this.hairBun);

    // Create long hair at back
    this.hairDown = new THREE.Group();
    const longHair = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 4, 0.8),
      this.hairMaterial
    );
    this.hairDown.add(longHair);
    longHair.position.set(0, -1.5, -1);
    this.hairDown.position.set(0, 1, 0);
    shadowSupport(this.hairDown);
    this.head.add(this.hair);
    this.head.add(this.hairFront);
    if (this.params.bun) {
      this.head.add(this.hairBun);
    }
    if (this.params.hairDown) {
      this.head.add(this.hairDown);
    }
    this.bblock.add(this.head);
  }
  drawEyes() {
    this.retines = new THREE.Group();
    this.eyesbrow = new THREE.Group();
    const geoRetine = new THREE.BoxGeometry(0.2, 0.5, 0.1);
    const geoEyebrow = new THREE.BoxGeometry(0.8, 0.25, 0.1);

    let i;

    for (i = 0; i < 2; i++) {
      const retine = new THREE.Mesh(
        geoRetine,
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      const eyebrow = new THREE.Mesh(geoEyebrow, this.hairMaterial);

      this.retines.add(retine);
      this.eyesbrow.add(eyebrow);

      const m = i % 2 === 0 ? 0.5 : -0.5;
      retine.position.x = m;
      eyebrow.position.x = m;
    }

    this.head.add(this.retines);
    this.head.add(this.eyesbrow);

    shadowSupport(this.eyesbrow);

    this.retines.position.y = 0;
    this.retines.position.z = 1.3;
    this.eyesbrow.position.y = 0.7;
    this.eyesbrow.position.z = 1.3;
  }
  drawBody() {
    this.body = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 2, 2.2),
      this.sweatMaterial
    );
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.position.set(0, 2.5, 0);
    this.bblock.add(this.body);
  }
  drawArms() {
    const height = 1.9;
    const geoArms = new THREE.BoxGeometry(0.45, height, 0.85);
    const geoHands = new THREE.BoxGeometry(0.45, 0.2, 0.65);

    let i;

    for (i = 0; i < 2; i++) {
      const armGroup = new THREE.Group();
      const arm = new THREE.Mesh(geoArms, this.sweatMaterial);
      const hand = new THREE.Mesh(geoHands, this.skinMaterial);

      armGroup.add(arm);
      armGroup.add(hand);
      this.arms.push(armGroup);
      this.bblock.add(armGroup);

      shadowSupport(armGroup);

      const m = i % 2 === 0 ? 1 : -1;
      armGroup.position.x = m * 1.4;
      armGroup.position.y = 3.5;
      arm.position.y = height * -0.5;
      hand.position.y = -height - 0.1;
    }
  }
  drawLegs() {
    const height = 1.8;
    const geoPants = new THREE.BoxGeometry(0.9, height, 1.6);
    const geoFoot = new THREE.BoxGeometry(0.75, 0.45, 1.9);

    let i;

    for (i = 0; i < 2; i++) {
      const legGroup = new THREE.Group();
      const leg = new THREE.Mesh(geoPants, this.pantsMaterial);
      const foot = new THREE.Mesh(geoFoot, this.shoesMaterial);

      legGroup.add(leg);
      legGroup.add(foot);
      this.legs.push(legGroup);
      this.bblock.add(legGroup);

      shadowSupport(legGroup);

      const m = i % 2 === 0 ? 0.5 : -0.5;
      legGroup.position.x = m;
      legGroup.position.y = 1.4;
      leg.position.y = height * -0.45;
      foot.position.y = -height - 0.1;
      foot.position.z = 0.2;
    }
  }
  moveArms(angle) {
    this.arms.forEach((arm, i) => {
      const m = i % 2 === 0 ? 1 : -1;
      arm.rotation.x = degreesToRadians(angle * m);
    });
  }
  moveLegs(angle) {
    this.legs.forEach((leg, i) => {
      const m = i % 2 === 0 ? 1 : -1;
      leg.rotation.x = degreesToRadians(angle * m);
    });
  }

  rotateHead(angle) {
    if (this.head) {
      this.head.rotation.y = degreesToRadians(angle);
    }
  }

  animateArms() {
    const time = Date.now() * 0.001; // Convert to seconds

    this.arms.forEach((arm, i) => {
      // Each arm uses its own frequency plus some random variation
      const randomOffset = Math.random() * 0.2 - 5; // Random value between -0.1 and 0.1
      const angle = Math.sin(time * this.armFrequencies[i] + randomOffset) * 30;
      const m = i % 2 === 0 ? 1 : -1;
      arm.rotation.x = degreesToRadians(angle * m);
    });
  }

  animateHead() {
    const time = Date.now() * 0.001; // Convert to seconds
    const cycleLength = 30; // Length of full cycle in seconds
    const activeTime = 2; // Time spent moving in seconds
    const delayTime = 0.5; // Time to pause at peak in seconds

    // Get position in current cycle
    const cyclePosition = time % cycleLength;

    // Only animate during active portion of cycle
    if (cyclePosition < activeTime) {
      // Calculate normalized position in movement (0 to 1)
      const normalizedPosition = cyclePosition / activeTime;

      // Add delay at peak by modifying the curve
      let angle;
      if (normalizedPosition < 0.5 - delayTime / activeTime) {
        // First half of movement
        angle = Math.sin(
          ((normalizedPosition / (0.5 - delayTime / activeTime)) * Math.PI) / 2
        );
      } else if (normalizedPosition > 0.5 + delayTime / activeTime) {
        // Second half of movement
        angle = Math.cos(
          (((normalizedPosition - (0.5 + delayTime / activeTime)) /
            (0.5 - delayTime / activeTime)) *
            Math.PI) /
            2
        );
      } else {
        angle = 1;
      }

      angle = angle * Math.abs(this.params.lookAngle);
      if (this.params.lookAngle < 0) {
        angle *= -1;
      }

      // If lookAngle is positive, clamp between 0 and lookAngle
      // If lookAngle is negative, clamp between lookAngle and 0
      const clampedAngle =
        this.params.lookAngle >= 0
          ? Math.max(0, Math.min(angle, this.params.lookAngle))
          : Math.min(0, Math.max(angle, this.params.lookAngle));
      this.rotateHead(clampedAngle);
    }
  }

  init() {
    this.drawHead();
    this.drawEyes();
    this.drawBody();
    this.drawArms();
    this.drawLegs();

    // Add animation to render loop
    const animate = () => {
      this.animateArms();
      this.animateHead();
      requestAnimationFrame(animate);
    };
    animate();

    shadowSupport(this.bblock);
  }
}

class SignPost {
  constructor(scenesss, params) {
    this.params = {
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
      text: "Sign text here",
      width: 7,
      height: 3.4,
      onClick: null,
      identifier: null,
      ...params,
    };

    // Create group and add to scene
    this.signpost = new THREE.Group();
    scenesss.add(this.signpost);

    // Position according to params
    this.signpost.position.x = this.params.x;
    this.signpost.position.y = this.params.y;
    this.signpost.position.z = this.params.z;

    // Apply rotation around Y axis
    this.signpost.rotation.y = this.params.rotation;

    // Materials
    this.woodMaterial = new THREE.MeshPhongMaterial({
      color: 0x4d2926,
      flatShading: true,
    });

    this.textMaterial = new THREE.MeshPhongMaterial({
      color: 0x000000,
      flatShading: true,
    });
  }

  drawPost() {
    // Create post
    const postGeometry = new THREE.BoxGeometry(0.3, 6, 0.4);
    const post1 = new THREE.Mesh(postGeometry, this.woodMaterial);
    post1.position.y = 2;
    post1.position.z = -0.2;
    post1.position.x = -this.params.width / 2 + 2;

    const post2 = new THREE.Mesh(postGeometry, this.woodMaterial);
    post2.position.y = 2;
    post2.position.z = -0.2;
    post2.position.x = this.params.width / 2 - 2;

    // Create sign board using params
    const signGeometry = new THREE.BoxGeometry(
      this.params.width,
      this.params.height,
      0.2
    );
    const sign = new THREE.Mesh(signGeometry, this.woodMaterial);
    sign.position.y = 4;

    // Add text
    const loader = new FontLoader();
    loader.load("./text-paint.json", (font) => {
      // Split text into lines
      const lines = this.params.text.split("\n");
      const lineHeight = 0.5; // Height between lines

      // Create group to hold all text lines
      const textGroup = new THREE.Group();

      // Create and position each line
      lines.forEach((line, index) => {
        const textGeometry = new TextGeometry(line, {
          font: font,
          size: 0.4,
          depth: 0.05,
          curveSegments: 12,
          bevelEnabled: false,
        });

        // Center align the line
        textGeometry.computeBoundingBox();
        const lineWidth =
          textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;

        const textMesh = new THREE.Mesh(
          textGeometry,
          new THREE.MeshPhongMaterial({
            color: 0xffffff,
            flatShading: true,
          })
        );

        // Center each line horizontally and stack vertically
        textMesh.position.x = -lineWidth / 2;
        textMesh.position.y = 5.1 - index * lineHeight;
        textMesh.position.z = 0.15;

        textGroup.add(textMesh);
      });

      this.signpost.add(textGroup);
    });

    this.signpost.add(post1);
    this.signpost.add(post2);
    this.signpost.add(sign);

    // Add identifier to the sign mesh
    sign.userData.identifier = this.params.identifier;
    sign.userData.onClick = this.params.onClick;

    shadowSupport(this.signpost);
  }

  init() {
    this.drawPost();
    shadowSupport(this.signpost);
  }
}

class Sheep {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      scale: params.scale || 1, // Reset back to 1
      rotation: params.rotation || 0,
      woolColor: params.woolColor || 0xf3f2f7,
      skinColor: params.skinColor || 0x5a6e6c,
    };

    this.sheep = new THREE.Group();
    this.eyeballs = [];
    this.eyes = [];
  }

  drawSheep() {
    const mat_wool = new THREE.MeshLambertMaterial({
      color: this.params.woolColor,
    });
    const mat_skin = new THREE.MeshLambertMaterial({
      color: this.params.skinColor,
    });

    // Head
    const geo_head = new THREE.IcosahedronGeometry(1.2, 0); // Increased from 1 to 1.2
    const head = new THREE.Mesh(geo_head, mat_skin);
    head.scale.z = 0.6;
    head.scale.y = 1.1;
    head.position.y = 2.5;
    head.rotation.x = -0.2;
    head.castShadow = true;
    this.sheep.add(head);

    // Body
    const geo_body = new THREE.IcosahedronGeometry(4, 0); // Increased from 3.5 to 4
    const body = new THREE.Mesh(geo_body, mat_wool);
    body.position.set(0, head.position.y, -2.2);
    body.scale.set(0.5, 0.5, 0.6);
    body.rotation.set(0, 0, Math.PI / 3);
    body.castShadow = true;
    this.sheep.add(body);

    // Tail
    const geo_tail = new THREE.IcosahedronGeometry(0.6, 0); // Increased from 0.5 to 0.6
    const tail = new THREE.Mesh(geo_tail, mat_wool);
    tail.position.set(head.position.x, head.position.y + 1.2, -3.8);
    tail.castShadow = true;
    this.sheep.add(tail);

    // Hair/Wool tufts
    const geo_hair = new THREE.IcosahedronGeometry(0.5, 0); // Increased from 0.4 to 0.5
    const hairPositions = [
      { x: -0.4, y: 0.9, z: -0.1, scale: 0.6 },
      { x: 0, y: 1, z: -0.1, scale: 1 },
      { x: 0.4, y: 0.9, z: -0.1, scale: 0.8 },
      { x: -0.1, y: 0.9, z: -0.4, scale: 0.7 },
      { x: 0.12, y: 0.9, z: -0.4, scale: 0.6 },
    ];

    hairPositions.forEach((pos) => {
      const hair = new THREE.Mesh(geo_hair, mat_wool);
      hair.position.set(pos.x, head.position.y + pos.y, pos.z);
      hair.rotation.set(
        Math.PI / 12,
        pos.x === 0 ? Math.PI / 6 : 0,
        Math.PI / 3
      );
      hair.scale.set(pos.scale, pos.scale, pos.scale);
      hair.castShadow = true;
      this.sheep.add(hair);
    });

    // Legs
    const geo_leg = new THREE.CylinderGeometry(0.18, 0.12, 1.2, 5); // Increased width and height
    const legPositions = [
      { x: 0.5, y: 1.1, z: -1.5 },
      { x: -0.5, y: 1.1, z: -1.5 },
      { x: 0.8, y: 1.1, z: -3 },
      { x: -0.8, y: 1.1, z: -3 },
    ];

    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(geo_leg, mat_skin);
      leg.position.set(pos.x, pos.y, pos.z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.sheep.add(leg);

      // Add feet
      const geo_foot = new THREE.DodecahedronGeometry(0.24, 0); // Increased from 0.2 to 0.24
      const foot = new THREE.Mesh(geo_foot, mat_skin);
      foot.scale.set(1, 0.8, 1);
      foot.position.set(pos.x, pos.y - 0.5, pos.z + 0.09);
      foot.castShadow = true;
      foot.receiveShadow = true;
      this.sheep.add(foot);
    });

    // Eyes
    const geo_eye = new THREE.CylinderGeometry(0.35, 0.25, 0.05, 8); // Increased from 0.3/0.2 to 0.35/0.25
    [-0.3, 0.3].forEach((x) => {
      const eye = new THREE.Mesh(geo_eye, mat_wool);
      eye.position.set(x, head.position.y + 0.1, 0.6);
      eye.rotation.set(
        Math.PI / 2 - Math.PI / 15,
        0,
        x < 0 ? Math.PI / 15 : -Math.PI / 15
      );
      eye.castShadow = true;
      this.eyes.push(eye);
      this.sheep.add(eye);

      // Eyeballs
      const geo_eyeball = new THREE.SphereGeometry(0.2, 8.1, 8.1); // Increased from 0.11 to 0.13
      const eyeball = new THREE.Mesh(geo_eyeball, mat_skin);
      eyeball.position.set(x, head.position.y + 0.1, 0.52);
      eyeball.castShadow = true;
      this.eyeballs.push(eyeball);
      this.sheep.add(eyeball);
    });

    // Position and rotate the sheep
    this.sheep.position.set(this.params.x, this.params.y, this.params.z);
    this.sheep.rotation.y = this.params.rotation;
    this.sheep.scale.set(
      this.params.scale,
      this.params.scale,
      this.params.scale
    );
  }

  init() {
    this.drawSheep();
    shadowSupport(this.sheep);
  }
}

// Tree class for creating decorative trees
class Tree {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      scale: params.scale || 1,
      rotation: params.rotation || Math.random() * Math.PI * 2,
      trunkColor: params.trunkColor || 0xf3f2f7,
      crownColor: params.crownColor || 0xfeb42b,
    };

    this.treeGroup = new THREE.Group();
    this.mat_trunk = new THREE.MeshLambertMaterial({
      color: this.params.trunkColor,
    });
    this.mat_crown = new THREE.MeshLambertMaterial({
      color: this.params.crownColor,
    });
  }

  createSingleTree(scale = 1, rotation = 0, position = { x: 0, y: 0, z: 0 }) {
    const tree = new THREE.Group();

    // Trunk
    const geo_trunk = new THREE.IcosahedronGeometry(9, 0);
    const trunk = new THREE.Mesh(geo_trunk, this.mat_trunk);
    trunk.rotation.x = Math.PI / 2;
    trunk.position.y = 5;
    trunk.scale.set(0.03, 0.03, 1);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Crown
    const geo_crown = new THREE.IcosahedronGeometry(2.5, 0);
    const crown = new THREE.Mesh(geo_crown, this.mat_crown);
    crown.scale.y = 0.4;
    crown.rotation.z = -0.5;
    crown.rotation.x = -0.2;
    crown.position.set(trunk.position.x, 12, trunk.position.z);
    crown.castShadow = true;
    tree.add(crown);

    // Leaf
    const leaf = new THREE.Group();
    const mainStem = new THREE.Mesh(geo_trunk, this.mat_trunk);
    mainStem.scale.set(0.007, 0.007, 0.16);
    mainStem.rotation.x = Math.PI / 2;
    mainStem.castShadow = true;
    leaf.add(mainStem);

    const geo_blade = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 12);
    const blade = new THREE.Mesh(geo_blade, this.mat_crown);
    blade.rotation.z = Math.PI / 2;
    blade.scale.x = 1.2;
    blade.position.set(-0.05, 0.4, 0);
    blade.castShadow = true;
    leaf.add(blade);

    // Sub stems
    const subStems = [];
    for (let i = 0; i < 8; i++) {
      subStems[i] = mainStem.clone();
      subStems[i].scale.set(0.0055, 0.0055, 0.01);
      subStems[i].castShadow = true;
      leaf.add(subStems[i]);
    }

    subStems[0].rotation.x = -Math.PI / 4;
    subStems[0].scale.z = 0.04;
    subStems[0].position.set(0, 0.8, 0.2);

    subStems[2].rotation.x = -Math.PI / 6;
    subStems[2].scale.z = 0.05;
    subStems[2].position.set(0, 0.5, 0.25);

    subStems[4].rotation.x = -Math.PI / 8;
    subStems[4].scale.z = 0.055;
    subStems[4].position.set(0, 0.2, 0.3);

    subStems[6].rotation.x = -Math.PI / 10;
    subStems[6].scale.z = 0.045;
    subStems[6].position.set(0, -0.1, 0.26);

    for (let i = 1; i < 8; i += 2) {
      subStems[i].rotation.x = -subStems[i - 1].rotation.x;
      subStems[i].scale.z = subStems[i - 1].scale.z;
      subStems[i].position.set(
        0,
        subStems[i - 1].position.y,
        -subStems[i - 1].position.z
      );
    }

    leaf.rotation.x = Math.PI / 3;
    leaf.rotation.z = 0.2;
    leaf.position.set(trunk.position.x - 0.2, 5, trunk.position.z + 1);
    tree.add(leaf);

    const leaf_1 = leaf.clone();
    leaf_1.rotation.x = -Math.PI / 3;
    leaf_1.position.set(trunk.position.x - 0.2, 6, trunk.position.z - 1);
    tree.add(leaf_1);

    tree.position.set(position.x, position.y, position.z);
    tree.rotation.y = rotation;
    tree.scale.set(scale, scale, scale);

    return tree;
  }

  drawTrees() {
    // Create three trees with different scales, rotations and positions
    const tree1 = this.createSingleTree(1.2, Math.PI / 6, {
      x: -2,
      y: 0,
      z: 0,
    });
    const tree2 = this.createSingleTree(0.8, Math.PI / 3, {
      x: 2,
      y: 0,
      z: -1,
    });
    const tree3 = this.createSingleTree(1.0, -Math.PI / 4, {
      x: 0,
      y: 0,
      z: 2,
    });

    this.treeGroup.add(tree1);
    this.treeGroup.add(tree2);
    this.treeGroup.add(tree3);

    // Position and rotate the entire group
    this.treeGroup.position.set(this.params.x, this.params.y, this.params.z);
    this.treeGroup.rotation.y = this.params.rotation;
    this.treeGroup.scale.set(
      this.params.scale,
      this.params.scale,
      this.params.scale
    );
  }

  init() {
    this.drawTrees();
    shadowSupport(this.treeGroup);
  }
}

class HugeText {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      text: params.text || "TEXT",
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      size: params.size || 5,
      color: params.color || 0xffffff,
      rotation: params.rotation || 0,
    };
    this.textGroup = new THREE.Group();
  }

  init() {
    const loader = new FontLoader();
    loader.load("./lucky-guy.json", (font) => {
      const textGeometry = new TextGeometry(this.params.text, {
        font: font,
        size: this.params.size,
        depth: this.params.size * 0.3, // Increased depth for taller text
        curveSegments: 12,
        bevelEnabled: false,
      });

      textGeometry.computeBoundingBox();
      const textWidth =
        textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;

      const textMaterial = new THREE.MeshPhongMaterial({
        color: this.params.color,
        flatShading: true,
      });

      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.x = this.params.x - textWidth / 2;
      textMesh.position.y = this.params.y;
      textMesh.position.z = this.params.z;
      textMesh.rotation.y = this.params.rotation;
      textMesh.scale.y = 2; // Scale vertically to make text taller

      this.textGroup.add(textMesh);

      shadowSupport(this.textGroup);
    });
  }
}

// Scene
const scene = new Scene();
scene.init();
scene.render();

const buildIsland_1 = () => {
  // Island
  const island = new Island(scene.scene, scene.camera, {
    x: 0,
    y: 0,
    z: 0,
    herbs: 10,
    lightColor: "#ffb039",
    lightIntensity: 2.5,
    enableLightning: true,
  });
  island.init();

  // Ground
  const ground = new GroundSurface({
    x: island.params.x,
    y: island.params.y,
    z: island.params.z,
  });
  island.addItem(ground.createGroundGeometry());

  // Welcome Signpost
  const signpost = new SignPost(scene.scene, {
    x: 0,
    y: -3,
    z: 20,
    rotation: 0,
    text: "Byron + Jen\n\nLittle razzle dazzle\n29-31 July 2025\n\nSave the date",
  });
  signpost.init();
  island.addItem(signpost.signpost);

  // More Details Signpost
  const signpost2 = new SignPost(scene.scene, {
    x: 20,
    y: -2,
    z: 1,
    rotation: 1.4,
    text: currentUser
      ? `${
          currentUser.numberOfKids > 0 ? "" : "\n"
        }${currentUser.getFamilyString()}\n\nMore details\ncoming soon!`
      : "\n\nMore details\ncoming soon!",
  });
  signpost2.init();
  island.addItem(signpost2.signpost);

  // Expansion Signpost
  const signpost3 = new SignPost(scene.scene, {
    x: 4,
    y: -3,
    z: -19,
    rotation: 3,
    text: "...either by email\nor here depending \non how many more\nhours i want to\nspend on this :)",
  });
  signpost3.init();
  island.addItem(signpost3.signpost);

  // Add rain effect
  const rain = new RainEffect(scene.scene);
  island.addItem(rain.raindrops);

  // Add rain animation to the render loop
  const originalRender = scene.render.bind(scene);
  scene.render = function () {
    rain.animate();
    originalRender();
  };
};

// Island 2
const buildIsland_2 = () => {
  const island2 = new Island(scene.scene, scene.camera, {
    x: 35,
    y: 30,
    z: -200,
    herbs: 10,
    lightColor: "#fffdfa",
    lightIntensity: 0.8,
  });
  island2.init();

  const ground = new GroundSurface({
    x: island2.params.x,
    y: island2.params.y,
    z: island2.params.z,
    groundColor: 0xffffff,
  });
  island2.addItem(ground.createGroundGeometry());

  // Add "Yes" signpost
  const signpostYes = new SignPost(scene.scene, {
    x: -15,
    y: -3,
    z: 6,
    rotation: -0.5,
    text: "\n\nI'll be there!",
    identifier: "rsvp-yes",
    onClick: () => {
      alert(`See you there, ${currentUser.name}!`);
      sendTelegramMessage(`${currentUser.name} RSVP: Yes`);
    },
  });
  signpostYes.init();
  island2.addItem(signpostYes.signpost);

  // Add "No" signpost
  const signpostNo = new SignPost(scene.scene, {
    x: 0,
    y: -3,
    z: 18,
    rotation: -0.8,
    text: "\n\nGot better things\nto do tbh",
    identifier: "rsvp-no",
    onClick: () => {
      alert(`Cheaper for us, ${currentUser.name}.`);
      sendTelegramMessage(`${currentUser.name} RSVP: No`);
    },
  });
  signpostNo.init();
  island2.addItem(signpostNo.signpost);

  // Huge Text
  const hugeText = new HugeText(scene.scene, {
    x: 12,
    y: -4,
    z: -23,
    rotation: -0.6,
    size: 12,
    text: "RSVP",
  });
  hugeText.init();
  island2.addItem(hugeText.textGroup);

  // Byron
  const bblock = new Bblock(scene.scene, {
    x: 0,
    y: -2,
    z: 0,
    hairColor: 0xed4928,
    bun: false,
    lookAngle: 55,
  });
  bblock.init();
  island2.addItem(bblock.bblock);

  // Jen
  const bblockJen = new Bblock(scene.scene, {
    x: 5,
    y: -2,
    z: 0,
    hairColor: 0x5e3014,
    bun: true,
    hairDown: true,
    lookAngle: -55,
  });
  bblockJen.init();
  island2.addItem(bblockJen.bblock);
};

// Island 3
const buildIsland_3 = () => {
  const island3 = new Island(scene.scene, scene.camera, {
    x: 150,
    y: 70,
    z: -120,
    herbs: 1,
    lightColor: "#ffd599",
    lightIntensity: 0.5,
  });
  island3.init();

  const ground = new GroundSurface({
    x: island3.params.x,
    y: island3.params.y,
    z: island3.params.z,
    groundColor: "#ffc582",
  });
  island3.addItem(ground.createGroundGeometry());

  // Add signpost with click handler
  const signpost = new SignPost(scene.scene, {
    x: -5,
    y: -3,
    z: 20,
    rotation: -0.4,
    text: "You're very far from\nwhere you should be.\n\nI said go away!",
  });
  signpost.init();
  island3.addItem(signpost.signpost);

  // Add sheep
  const sheep = new Sheep(scene.scene, {
    x: -5,
    y: -3,
    z: 5,
  });
  sheep.init();
  island3.addItem(sheep.sheep);

  // Add sheep
  const sheep2 = new Sheep(scene.scene, {
    x: -7,
    y: -3,
    z: 12,
    rotation: 2,
  });
  sheep2.init();
  island3.addItem(sheep2.sheep);

  // Add sheep
  const sheep3 = new Sheep(scene.scene, {
    x: 5,
    y: -3,
    z: 10,
    rotation: -0.5,
  });
  sheep3.init();
  island3.addItem(sheep3.sheep);

  // Tree
  const tree = new Tree(scene.scene, {
    x: 10,
    y: -3,
    z: 0,
  });
  tree.init();
  island3.addItem(tree.treeGroup);
};

// Island 4
const buildIsland_4 = () => {
  const island4 = new Island(scene.scene, scene.camera, {
    x: -120,
    y: 70,
    z: -300,
    herbs: 100,
    lightColor: "#33c5e6",
    lightIntensity: 0.6,
    enableLightning: true,
  });

  island4.init();

  const ground = new GroundSurface({
    x: island4.params.x,
    y: island4.params.y,
    z: island4.params.z,
  });
  island4.addItem(ground.createGroundGeometry());

  // Add signpost
  const signpost = new SignPost(scene.scene, {
    x: -8,
    y: -3,
    z: 20,
    rotation: -0.5,
    text: "\nWhy you snooping?\n\nGo away!",
  });
  signpost.init();
  island4.addItem(signpost.signpost);

  // Add rain effect
  const rain = new RainEffect(scene.scene);
  island4.addItem(rain.raindrops);

  // Add rain animation to the render loop
  const originalRender = scene.render.bind(scene);
  scene.render = function () {
    rain.animate();
    originalRender();
  };
};

initUser()
  .then(() => {
    if (currentUser) {
      console.log("User initialized: " + currentUser.name);
      buildIsland_1();
      buildIsland_2();
      buildIsland_3();
      buildIsland_4();
    }
  })
  .catch((e) => {
    console.error("Error starting app: " + e);
  });

// Resize
window.addEventListener("resize", () => {
  container.width = window.innerWidth;
  container.height = window.innerHeight;
  scene.camera.aspect = container.width / container.height;
  scene.camera.updateProjectionMatrix();
  scene.renderer.setSize(window.innerWidth, window.innerHeight);
});
