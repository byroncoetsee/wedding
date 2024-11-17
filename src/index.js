import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

let scene, camera, renderer, controls;
let mesh, texture;

const worldWidth = 256;
const worldDepth = 256;
const clock = new THREE.Clock();

function generateHeight(width, height) {
  let seed = Math.PI / 4;
  window.Math.random = function () {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const size = width * height;
  const data = new Uint8Array(size);
  const perlin = new ImprovedNoise();
  const z = Math.random() * 100;

  let quality = 1;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = ~~(i / width);
      data[i] += Math.abs(
        perlin.noise(x / quality, y / quality, z) * quality * 0.5 // Reduced multiplier for gentler terrain
      );
    }
    quality *= 5;
  }

  return data;
}

function generateTexture(data, width, height) {
  let context, image, imageData, shade;

  const vector3 = new THREE.Vector3(0, 0, 0);
  const sun = new THREE.Vector3(1, 1, 1);
  sun.normalize();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);

  image = context.getImageData(0, 0, canvas.width, canvas.height);
  imageData = image.data;

  for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
    vector3.x = data[j - 2] - data[j + 2];
    vector3.y = 2;
    vector3.z = data[j - width * 2] - data[j + width * 2];
    vector3.normalize();

    shade = vector3.dot(sun);

    // Adjusted colors for sand-like appearance
    imageData[i] = (210 + shade * 45) * (0.5 + data[j] * 0.007); // More red
    imageData[i + 1] = (180 + shade * 40) * (0.5 + data[j] * 0.007); // Less green
    imageData[i + 2] = (140 + shade * 35) * (0.5 + data[j] * 0.007); // Even less blue
  }

  context.putImageData(image, 0, 0);

  const canvasScaled = document.createElement("canvas");
  canvasScaled.width = width * 1;
  canvasScaled.height = height * 1;

  context = canvasScaled.getContext("2d");
  context.scale(4, 4);
  context.drawImage(canvas, 0, 0);

  image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
  imageData = image.data;

  for (let i = 0, l = imageData.length; i < l; i += 4) {
    const v = ~~(Math.random() * 5);
    imageData[i] += v;
    imageData[i + 1] += v;
    imageData[i + 2] += v;
  }

  context.putImageData(image, 0, 0);
  return canvasScaled;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xefd1b5);
  //   scene.fog = new THREE.FogExp2(0xefd1b5, 0.0025);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  // Adjusted camera position to look at corner
  camera.position.set(100, 200, 100);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const data = generateHeight(worldWidth, worldDepth);

  const geometry = new THREE.PlaneGeometry(
    1000,
    1000,
    worldWidth - 1,
    worldDepth - 1
  );
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
    vertices[j + 1] = data[i] * 1;
  }

  texture = new THREE.CanvasTexture(
    generateTexture(data, worldWidth, worldDepth)
  );
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
    })
  );
  scene.add(mesh);

  // Add trees distributed across terrain
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 900 + 50;
    const z = Math.random() * 900 + 50;

    const xIndex = Math.floor(((x - 50) / 900) * worldWidth);
    const zIndex = Math.floor(((z - 50) / 900) * worldDepth);
    const heightIndex = Math.min(
      zIndex * worldWidth + xIndex,
      worldWidth * worldDepth - 1
    );
    const y = data[heightIndex] * 1 - 10; // Increased the offset to -10 to bring trees down

    createTree(x, y, z);
  }
}

function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0xfff0e0, 0.5);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff6e6, 1.0);
  const distance = 20;
  sunLight.position.set(distance, distance, distance);
  sunLight.castShadow = true;
  scene.add(sunLight);
}

function createTree(x, y, z) {
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3219,
    roughness: 0.8,
  });
  const pyramidMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f5c0f,
    roughness: 0.8,
  });

  const treeHeight = Math.random() * 1 + 1.25;

  const geo1 = new THREE.CylinderGeometry(0, 1.5, treeHeight, 3);
  geo1.translate(0, treeHeight * 0 + 2, 0);

  const geo2 = new THREE.CylinderGeometry(0, 1.15, treeHeight, 3);
  geo2.translate(0, treeHeight * 0.6 + 2, 0);

  const geo3 = new THREE.CylinderGeometry(0, 0.8, treeHeight, 3);
  geo3.translate(0, treeHeight * 1.25 + 2, 0);

  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;

  const pyramid1 = new THREE.Mesh(geo1, pyramidMaterial);
  pyramid1.castShadow = true;

  const pyramid2 = new THREE.Mesh(geo2, pyramidMaterial);
  pyramid2.castShadow = true;

  const pyramid3 = new THREE.Mesh(geo3, pyramidMaterial);
  pyramid3.castShadow = true;

  const tree = new THREE.Group();
  tree.add(trunk);
  tree.add(pyramid1);
  tree.add(pyramid2);
  tree.add(pyramid3);

  tree.position.set(x, y, z);
  tree.rotation.y = Math.random() * Math.PI * 2;
  tree.scale.setScalar(Math.random() * 0.5 + 0.5);

  scene.add(tree);
}

function clouds() {
  let geo = new THREE.SphereGeometry(0, 0, 0);
  let count = Math.floor(Math.pow(Math.random(), 0.45) * 4);

  for (let i = 0; i < count; i++) {
    const puff1 = new THREE.SphereGeometry(1.2, 7, 7);
    const puff2 = new THREE.SphereGeometry(1.5, 7, 7);
    const puff3 = new THREE.SphereGeometry(0.9, 7, 7);

    puff1.translate(-1.85, Math.random() * 0.3, 0);
    puff2.translate(0, Math.random() * 0.3, 0);
    puff3.translate(1.85, Math.random() * 0.3, 0);

    const cloudGeo = BufferGeometryUtils.mergeGeometries([puff1, puff2, puff3]);
    cloudGeo.translate(
      Math.random() * 20 - 10,
      Math.random() * 7 + 7,
      Math.random() * 20 - 10
    );
    cloudGeo.rotateY(Math.random() * Math.PI * 2);

    geo = BufferGeometryUtils.mergeGeometries([geo, cloudGeo]);
  }

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
    })
  );

  scene.add(mesh);
}

function setupCamera() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 2000;
  controls.maxPolarAngle = Math.PI / 2;
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function init() {
  initScene();
  setupLighting();
  clouds();
  setupCamera();
  window.addEventListener("resize", handleResize);
  animate();
}

init();
