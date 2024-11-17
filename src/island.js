import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise";

let scene, camera, renderer, controls;

function init() {
  // Setup scene
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  camera.position.set(5, 5, 5);
  controls.update();

  // Create island geometry
  const geometry = new THREE.CircleGeometry(2, 32);
  const material = new THREE.MeshPhongMaterial({
    color: 0x91785b,
    shininess: 0,
  });
  const island = new THREE.Mesh(geometry, material);

  // Add some height variation to the island
  const positions = island.geometry.attributes.position.array;
  const perlin = new ImprovedNoise();
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    positions[i + 1] = perlin.noise(x * 0.5, z * 0.5, 0) * 0.3;
  }
  island.geometry.attributes.position.needsUpdate = true;
  scene.add(island);

  // Create water
  const waterGeometry = new THREE.CircleGeometry(4, 32);
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x0077be,
    transparent: true,
    opacity: 0.7,
    shininess: 90,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = -0.1;
  scene.add(water);

  // Create tree trunk
  const trunkGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
  const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x4d2926 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 0.25;
  scene.add(trunk);

  // Create tree top
  const leavesGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
  const leavesMaterial = new THREE.MeshPhongMaterial({ color: 0x2d5a27 });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.position.y = 0.7;
  scene.add(leaves);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    water.rotation.z += 0.001;
    renderer.render(scene, camera);
  }
  animate();

  // Handle window resizing
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

init();
