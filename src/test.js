// import {
//   WebGLRenderer,
//   PerspectiveCamera,
//   Scene,
//   BoxGeometry,
//   MeshBasicMaterial,
//   Mesh,
//   Color,
// } from "https://cdn.skypack.dev/three@0.137";
import * as THREE from "three";

// Create scene
const scene = new Scene();
scene.background = new Color(0x808080);

// Create camera
const camera = new PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

// Create renderer
const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a cube
const geometry = new BoxGeometry();
const material = new MeshBasicMaterial({ color: 0x00ff00 });
const cube = new Mesh(geometry, material);
scene.add(cube);

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Rotate cube
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render(scene, camera);
}
animate();
