import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

var container = { width: window.innerWidth, height: window.innerHeight };
const landScale = 3.5;

// Rotate arms / legs
const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};
// Add shadow support to object
const shadowSupport = (group) => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
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
// Box Helper
const boxHelperSupport = (group) => {
  const box = new THREE.BoxHelper(group, 0xffff00);
  scene.add(box);
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
// Cut Object helpers
const chopBottom = (geo, bottom) => {
  const pos = geo.getAttribute("position");
  const arr = pos.array;

  for (let i = 1; i < arr.length; i += 3) {
    arr[i] = Math.max(arr[i], bottom);
  }

  pos.needsUpdate = true;
  return geo;
};
const chopTop = (geo, top) => {
  const pos = geo.getAttribute("position");
  const arr = pos.array;

  for (let i = 1; i < arr.length; i += 3) {
    arr[i] = Math.min(arr[i], top);
  }

  pos.needsUpdate = true;
  return geo;
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
  }
  initStats() {
    // STATS
    this.stats = new Stats();
    this.stats.setMode(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    // align top-left
    this.stats.domElement.style.position = "absolute";
    this.stats.domElement.style.left = "0px";
    this.stats.domElement.style.top = "0px";
    document.body.appendChild(this.stats.domElement);
  }
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null; /*new THREE.Color(0xa3e2ff)*/
    this.scene.fog = new THREE.FogExp2(0x6dd5fa, 0.015);
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
    this.camera.position.set(-40, 8.5, 25);
    this.camera.lookAt(this.scene.position);
  }
  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // Force control
    // controls.minPolarAngle = -Math.PI*.45;
    // controls.maxPolarAngle = Math.PI*.45;
    this.controls.enableDamping = false; // adds smooth movement
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 100;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = -2;
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
    this.renderer
      .physicallyCorrectLights; /*accurate lighting that uses SI units.*/
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.soft = true;
    document.body.appendChild(canvas);
  }
  initLights() {
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5, 100);
    this.light = new THREE.HemisphereLight(0xffffff, 0xb3858c, 1.5);

    this.scene.add(this.light);
    this.scene.add(this.directionalLight);

    this.directionalLight.position.set(10, 12, 8);
    this.directionalLight.castShadow = true;
    this.directionalLight.receiveShadow = true;
    this.directionalLight.shadow.mapSize.width = 512; // default
    this.directionalLight.shadow.mapSize.height = 512; // default
    this.directionalLight.shadow.camera.near = 0.5; // default
    this.directionalLight.shadow.camera.far = 500;
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
  constructor(scenesss, params) {
    this.params = {
      x: 0,
      y: 0,
      z: 0,
      herbs: 2,
      ...params,
    };

    // Create group and add to scene
    this.island = new THREE.Group();
    scenesss.add(this.island);

    // Position according to params
    this.island.position.x = this.params.x;
    this.island.position.y = this.params.y;
    this.island.position.z = this.params.z;

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
      flatShading: true,
    });
    this.earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x664e31,
      flatShading: true,
    });
    this.stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x9eaeac });

    // Add the instance reference to the group
    this.island.__islandInstance = this;
  }

  createGroundParticle() {
    const geoGroundParticule = new THREE.TetrahedronGeometry(
      randomize(0.5, 2.5), // Reduced max size from 5.5 to 2.5
      randomize(2, 3)
    );
    jitter(geoGroundParticule, 0.0);
    geoGroundParticule.translate(
      -5,
      randomize(-4, -1, true),
      randomize(-2, 2, true)
    );
    const particule = new THREE.Mesh(geoGroundParticule, this.earthMaterial);
    particule.scale.set(
      randomize(1, 1.5, true),
      randomize(1, 1.8, true),
      randomize(1, 1.5, true)
    );
    particule.position.set(-5, randomize(-4, -1, true), randomize(-2, 2, true));
    return particule;
  }

  drawGround() {
    this.ground = new THREE.Group();

    // Create earth base
    const geoGround = new THREE.CylinderGeometry(7, 2, 9, 12, 5);
    jitter(geoGround, 0.6);
    geoGround.translate(0, -0.5, 0);
    const earth = new THREE.Mesh(geoGround, this.earthMaterial);

    // Create grass top
    const geoGreen = new THREE.CylinderGeometry(7.4, 5.5, 3.0, 36, 3);
    jitter(geoGreen, 0.3);
    geoGreen.translate(0, 3.3, 0);
    const green = new THREE.Mesh(geoGreen, this.greenMaterial);
    geoGreen.scale(1.05, 1, 1.05);

    // Add ground particle
    const particule = this.createGroundParticle();
    this.ground.add(particule);

    // Combine meshes
    this.ground.add(earth);
    this.ground.add(green);
    this.ground.position.y = -5.6;
    shadowSupport(this.ground);
    this.island.add(this.ground);
  }

  drawCloud() {
    this.clouds = new THREE.Group();

    const geoCloud = new THREE.SphereGeometry(2, 6, 6);
    jitter(geoCloud, 0.2);
    const cloud = new THREE.Mesh(geoCloud, this.cloudMaterial);
    cloud.scale.set(1, 0.8, 1);

    const cloud2 = cloud.clone();
    cloud2.scale.set(0.75, 0.5, 1);
    cloud2.position.set(1.95, -0.5, 0);

    const cloud3 = cloud.clone();
    cloud3.scale.set(0.75, 0.5, 1);
    cloud3.position.set(-1.85, -1, 0);

    this.clouds.add(cloud);
    this.clouds.add(cloud2);
    this.clouds.add(cloud3);

    shadowSupport(this.clouds);

    this.clouds.position.x = -5;
    this.clouds.position.y = 8;
    this.clouds.position.z = -4.6;

    this.island.add(this.clouds);

    const cloneCloudGroup = this.clouds.clone();
    cloneCloudGroup.scale.set(1, 1.2, 1.2);
    cloneCloudGroup.position.x = 6;
    cloneCloudGroup.position.y = -9;
    cloneCloudGroup.position.z = 4;

    this.island.add(cloneCloudGroup);
  }
  drawRocks() {
    this.rocks = new THREE.Group();
    const geoRocks = new THREE.DodecahedronGeometry(1, 0);
    const rock = new THREE.Mesh(geoRocks, this.stoneMaterial);
    rock.scale.set(randomize(0.8, 1.2, true), randomize(0.5, 3, true), 1);
    const rock2 = rock.clone();
    rock2.scale.set(randomize(0.8, 1.2, true), randomize(0.5, 3, true), 1);
    rock2.position.set(1.2, 0, -1.3);

    this.rocks.add(rock);
    this.rocks.add(rock2);
    this.rocks.position.x = -5;
    this.rocks.position.y = 0;
    this.rocks.position.z = -2.5;

    shadowSupport(this.rocks);
    this.island.add(this.rocks);
  }
  drawHerbs(position = { x: 1.1, y: 0, z: 0 }) {
    const width = 0.2;
    this.herbs = new THREE.Group();
    const geoHerbs = new THREE.ConeGeometry(width, 1, 6);
    const herb = new THREE.Mesh(geoHerbs, this.greenMaterial);
    herb.position.set(0, -0.4, 0);
    herb.rotation.set(0, randomize(-0.7, 0.7, true), 0);
    this.herbs.add(herb);

    let i;

    for (i = 0; i < 4; i++) {
      const herbX = herb.clone();
      herbX.position.set(
        randomize(-0.5, 0.5, true),
        -0.4,
        randomize(-0.5, 0.5, true)
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
        x: randomize(-5, 5, true),
        y: 0,
        z: randomize(-5, 5, true),
      });
    }
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
    this.hair.position.set(0, 5.3, -0.3);

    this.hairFront = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.5, 0.8),
      this.hairMaterial
    );
    this.hairFront.castShadow = true;
    this.hairFront.receiveShadow = true;
    this.hairFront.position.set(0, 6.3, 0.85);

    const tuft1 = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const tuft2 = new THREE.BoxGeometry(0.8, 0.8, 0.8);

    const tuft1Mesh = new THREE.Mesh(tuft1, this.hairMaterial);
    const tuft2Mesh = new THREE.Mesh(tuft2, this.hairMaterial);

    this.hairBun = new THREE.Group();
    this.hairBun.add(tuft1Mesh);
    this.hairBun.add(tuft2Mesh);

    tuft1Mesh.position.set(0, 0, 0);
    tuft2Mesh.position.set(0, 0.5, -0.5);

    this.hairBun.position.set(0, 6.3, -1.3);
    shadowSupport(this.hairBun);

    // Create long hair at back
    this.hairDown = new THREE.Group();
    const longHair = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 4, 0.8),
      this.hairMaterial
    );
    this.hairDown.add(longHair);
    longHair.position.set(0, -1.5, -1);
    this.hairDown.position.set(0, 6, 0);
    shadowSupport(this.hairDown);

    this.bblock.add(this.head);
    this.bblock.add(this.hair);
    this.bblock.add(this.hairFront);
    if (this.params.bun) {
      this.bblock.add(this.hairBun);
    }
    if (this.params.hairDown) {
      this.bblock.add(this.hairDown);
    }
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
  init() {
    this.drawHead();
    this.drawEyes();
    this.drawBody();
    this.drawArms();
    this.drawLegs();
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
          height: 0.05,
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
        textMesh.position.y = 4.98 - index * lineHeight;
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
  }
}

/**
 * GENERATOR
 * ------------------------------------------------------------------------
 */
// Generate Scene
const scene = new Scene();
scene.init();
scene.render();

// Generate Island
const island = new Island(scene.scene, { x: 0, y: 0, z: 0, herbs: 10 });
island.init();
// Generate Bblock
const bblock = new Bblock(scene.scene, {
  x: 0,
  y: -2,
  z: 0,
  hairColor: 0xed4928,
  bun: false,
});
bblock.init();
const bblockJen = new Bblock(scene.scene, {
  x: 5,
  y: -2,
  z: 0,
  hairColor: 0x593127,
  bun: true,
  hairDown: true,
});
bblockJen.init();

// Generate SignPost
const signpost = new SignPost(scene.scene, {
  x: 0,
  y: -3,
  z: 20,
  rotation: 0,
  text: "Byron + Jen\n\nLittle razzle dazzle\n29-31 July 2025\nCape Town",
});
signpost.init();

// Generate SignPost
const signpost2 = new SignPost(scene.scene, {
  x: 20,
  y: -3,
  z: 0,
  rotation: 1,
  text: "More details\ncoming soon!",
});
signpost2.init();

// Generate SignPost
const signpost3 = new SignPost(scene.scene, {
  x: 4,
  y: -3,
  z: -20,
  rotation: 3,
  text: "Either by email\nor here\ndepending on\nhow many more\nhours i want to\nspend on this :)",
});
signpost3.init();

// Other Island Example
const island2 = new Island(scene.scene, { x: 25, y: -40, z: -70, herbs: 10 });
island2.init();

const signpost4 = new SignPost(scene.scene, {
  x: 25,
  y: -43,
  z: -70,
  rotation: 2,
  text: "Welcome to\nIsland 2!",
});
signpost4.init();

const island3 = new Island(scene.scene, { x: -70, y: 20, z: -100, herbs: 10 });
island3.init();

const signpost5 = new SignPost(scene.scene, {
  x: -70,
  y: 17,
  z: -100,
  rotation: 4,
  text: "Welcome to\nIsland 3!",
});
signpost5.init();

// Resize
window.addEventListener("resize", () => {
  container.width = window.innerWidth;
  container.height = window.innerHeight;
  scene.camera.aspect = container.width / container.height;
  scene.camera.updateProjectionMatrix();
  scene.renderer.setSize(window.innerWidth, window.innerHeight);
});
