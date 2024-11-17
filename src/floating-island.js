import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

var container = { width: window.innerWidth, height: window.innerHeight };
const landScale = 1;

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

  console.log(position);
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
      <!-- <div>• Click on islands to navigate</div> -->
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
    this.camera.position.set(-35, 10, 35);
    this.camera.lookAt(this.scene.position);
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 35;
    this.controls.maxDistance = 100;
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
    this.light = new THREE.HemisphereLight("#ffffff", "#ffffff", 0.3); //b3858c
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
    this.initLegend();
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initControls();
    this.initLights();
    // this.initClickHandler();
  }

  initClickHandler() {
    this.cameraController = new CameraController(this.camera, this.controls);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let mouseDownTime = 0;

    // Add mousedown and mouseup listeners to detect dragging
    window.addEventListener("mousedown", () => {
      isDragging = false;
      mouseDownTime = performance.now();
    });

    window.addEventListener("mousemove", () => {
      if (mouseDownTime && performance.now() - mouseDownTime > 100) {
        isDragging = true;
      }
    });

    window.addEventListener("click", (event) => {
      // Skip if we were dragging
      if (isDragging) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);

      const meshes = [];
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          meshes.push(object);
        }
      });

      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        let current = intersects[0].object;
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
    });
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
      fadeStartDistance: 100,
      fadeEndDistance: 700,
      items: [], // Add this to store related items
      lightColor: "#ffb157",
      lightIntensity: 1.5,
      ...params,
    };

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

  addItem(item) {
    // console.log("addItem", item);
    item.parent?.remove(item);
    this.island.add(item);
    // this.params.items.push(item);
  }

  updateScale() {
    const distance = this.camera.position.distanceTo(this.island.position);
    const fadeStart = 300;
    const fadeEnd = 600;
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
      rotation: 0, // Added rotation parameter in radians
      text: "Sign text here",
      width: 7, // Default width
      height: 3.4, // Default height
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

    shadowSupport(this.signpost);
  }

  init() {
    this.drawPost();
    shadowSupport(this.signpost);
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
  });
  island.init();

  // Ground
  const ground = new GroundSurface({
    x: island.params.x,
    y: island.params.y,
    z: island.params.z,
  });
  island.addItem(ground.createGroundGeometry());

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
  island.addItem(bblock.bblock);

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
  island.addItem(bblockJen.bblock);

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
    x: 18,
    y: -2,
    z: 0,
    rotation: 1,
    text: "\n\nMore details\ncoming soon!",
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
};

// Island 2
const buildIsland_2 = () => {
  const island2 = new Island(scene.scene, scene.camera, {
    x: 35,
    y: -40,
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
};

// Island 3
const buildIsland_3 = () => {
  const island3 = new Island(scene.scene, scene.camera, {
    x: -70,
    y: 50,
    z: -500,
    herbs: 10,
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
};

buildIsland_1();
buildIsland_2();
buildIsland_3();

// Resize
window.addEventListener("resize", () => {
  container.width = window.innerWidth;
  container.height = window.innerHeight;
  scene.camera.aspect = container.width / container.height;
  scene.camera.updateProjectionMatrix();
  scene.renderer.setSize(window.innerWidth, window.innerHeight);
});
