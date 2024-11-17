import * as THREE from "three";
import { createNoise4D } from "simplex-noise";
import chroma from "chroma-js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

document.addEventListener("DOMContentLoaded", () => {
  App({ el: "background" });
});

function App(conf) {
  conf = {
    fov: 75,
    cameraZ: 75,
    xyCoef: 50,
    zCoef: 10,
    lightIntensity: 0.9,
    ambientColor: 0x000000,
    light1Color: 0x0e09dc,
    light2Color: 0x1cd1e1,
    light3Color: 0x18c02c,
    light4Color: 0xee3bcf,
    ...conf,
  };

  let renderer, scene, camera, controls;
  let width, height, wWidth, wHeight;

  let plane;
  const simplex = {
    noise4D: createNoise4D(),
  };

  const mouse = new THREE.Vector2();
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const mousePosition = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();

  init();

  function init() {
    // Create canvas element if it doesn't exist
    let canvas = document.getElementById(conf.el);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = conf.el;
      document.body.appendChild(canvas);
    }

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    camera = new THREE.PerspectiveCamera(conf.fov);
    camera.position.z = conf.cameraZ;

    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 50;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    updateSize();
    window.addEventListener("resize", updateSize, false);

    document.addEventListener("mousemove", (e) => {
      const v = new THREE.Vector3();
      camera.getWorldDirection(v);
      v.normalize();
      mousePlane.normal = v;
      mouse.x = (e.clientX / width) * 2 - 1;
      mouse.y = -(e.clientY / height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(mousePlane, mousePosition);
    });

    initScene();
    animate();
  }

  function initScene() {
    scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    initLights();

    // Create a gradient texture
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#1e4877");
    gradient.addColorStop(0.5, "#4584b4");
    gradient.addColorStop(1, "#83B9E5");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      map: texture,
      shininess: 50,
      specular: 0x333333,
    });

    const geometry = new THREE.PlaneGeometry(
      wWidth,
      wHeight,
      wWidth / 2,
      wHeight / 2
    );
    plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    plane.rotation.x = -Math.PI / 2 - 0.2;
    plane.position.y = -25;
    camera.position.z = 60;
  }

  function initLights() {
    const radius = 30;
    const yOffset = 10;
    const lightDistance = 200;

    // Increase light intensity if needed
    const intensity = 2.0; // Increased from 0.9

    const light1 = new THREE.PointLight(
      conf.light1Color,
      intensity,
      lightDistance
    );
    light1.position.set(0, yOffset, radius);
    scene.add(light1);

    const light2 = new THREE.PointLight(
      conf.light2Color,
      intensity,
      lightDistance
    );
    light2.position.set(0, -yOffset, -radius);
    scene.add(light2);

    const light3 = new THREE.PointLight(
      conf.light3Color,
      intensity,
      lightDistance
    );
    light3.position.set(radius, yOffset, 0);
    scene.add(light3);

    const light4 = new THREE.PointLight(
      conf.light4Color,
      intensity,
      lightDistance
    );
    light4.position.set(-radius, yOffset, 0);
    scene.add(light4);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    animatePlane();
    animateLights();
    renderer.render(scene, camera);
  }

  function animatePlane() {
    const gArray = plane.geometry.attributes.position.array;
    const time = Date.now() * 0.0002;

    for (let i = 0; i < gArray.length; i += 3) {
      gArray[i + 2] =
        simplex.noise4D(
          gArray[i] / conf.xyCoef,
          gArray[i + 1] / conf.xyCoef,
          time,
          mouse.x + mouse.y
        ) * conf.zCoef;
    }

    plane.geometry.attributes.position.needsUpdate = true;
  }

  function animateLights() {
    const time = Date.now() * 0.001;
    const distance = 50;

    const lights = scene.children.filter(
      (child) => child instanceof THREE.PointLight
    );

    lights.forEach((light, index) => {
      const offset = index * 0.2;
      light.position.x = Math.sin(time * (0.1 + offset)) * distance;
      light.position.z = Math.cos(time * (0.2 + offset)) * distance;
    });
  }

  function updateLightsColors() {
    const lights = scene.children.filter(
      (child) => child instanceof THREE.PointLight
    );

    lights.forEach((light, index) => {
      const newColor = chroma.random().hex();
      conf[`light${index + 1}Color`] = newColor;
      light.color = new THREE.Color(newColor);
    });
  }

  function updateSize() {
    width = window.innerWidth;
    height = window.innerHeight;

    if (renderer && camera) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const [newWidth, newHeight] = getRendererSize();
      wWidth = newWidth;
      wHeight = newHeight;
    }
  }

  function getRendererSize() {
    const cam = new THREE.PerspectiveCamera(camera.fov, camera.aspect);
    const vFOV = (cam.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFOV / 2) * Math.abs(conf.cameraZ);
    const width = height * cam.aspect;
    return [width, height];
  }
}
