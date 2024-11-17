import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as CANNON from "cannon-es";

console.clear();

// 2. Initialize physics world
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, 0, -19.82),
});
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Add these before the Car class definition
const carGeometry = new THREE.BoxGeometry(20, 10, 3);
const carMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Red car

const carTopGeometry = new THREE.BoxGeometry(12, 8, 4);
const carTopMaterial = new THREE.MeshPhongMaterial({ color: 0x990000 }); // Darker red top

const wheelGeometry = new THREE.CylinderGeometry(2, 2, 1, 16);
const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Dark grey wheels

// 3. Car class definition needs to be BEFORE any usage
class Car extends THREE.Object3D {
  constructor(color) {
    super();

    this.maxspeed = 5;
    this.speed = 0;
    this.angle = 0;
    this.steering = 0;
    this.lightsOn = true;

    let carBody = new THREE.Mesh(carGeometry, carMaterial);
    carBody.castShadow = true;
    carBody.receiveShadow = true;
    this.add(carBody);

    let carTop = new THREE.Mesh(carTopGeometry, carTopMaterial);
    carTop.position.x -= 2;
    carTop.position.z += 3.5;
    carTop.castShadow = true;
    carTop.receiveShadow = true;
    this.add(carTop);

    this.castShadow = true;
    this.receiveShadow = true;

    // Add light
    var light = new THREE.PointLight(0xffffff, 1, 0);
    light.position.z = 25;
    light.position.x = 5;
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 50;
    light.shadow.bias = 0.1;
    light.shadow.radius = 5;
    light.power = 3;
    this.add(light);

    // Add wheels
    this.wheels = Array(4)
      .fill(null)
      .map((wheel, i) => {
        wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.y = i < 2 ? 6 : -6;
        wheel.position.x = i % 2 ? 6 : -6;
        wheel.position.z = -2;
        this.add(wheel);
        return wheel;
      });

    // Add lights
    this.lights = Array(2)
      .fill(null)
      .map((light, i) => {
        light = new THREE.SpotLight(0xffffff, 600);
        light.position.x = 11;
        light.position.y = i < 1 ? -3 : 3;
        light.position.z = -2;
        light.angle = Math.PI / 4;
        light.penumbra = 0.2;
        light.decay = 1.2;
        light.distance = 200;

        light.castShadow = true;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 200;
        light.shadow.camera.fov = 30;
        light.shadow.bias = -0.001;

        light.target.position.x = 35;
        light.target.position.y = i < 1 ? -8 : 8;
        light.target.position.z = -9;

        this.add(light.target);
        this.add(light);
        return light;
      });

    // Modify the physics body setup
    const carShape = new CANNON.Box(new CANNON.Vec3(10, 5, 1.5));
    this.body = new CANNON.Body({
      mass: 500,
      position: new CANNON.Vec3(0, 0, 20),
      shape: carShape,
      material: new CANNON.Material({
        friction: 0.1,
        restitution: 0.2,
      }),
      angularDamping: 0.9,
      linearDamping: 0.2,
      fixedRotation: false,
    });

    this.body.shapeOffsets[0].z = -2.5; // Add this line after creating the body

    // Set initial velocity to zero
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);

    world.addBody(this.body);
  }

  update() {
    const forwardForce = 15000;
    const steerForce = 8000;

    // When no keys are pressed, apply additional damping
    if (!keys[38] && !keys[87] && !keys[40] && !keys[83]) {
      // Apply stronger damping when not accelerating
      //   this.body.velocity.scale(0.95, this.body.velocity);
    }

    // Apply forces based on car's current rotation
    if (keys[38] || keys[87]) {
      // Forward
      const forward = new CANNON.Vec3(forwardForce, 0, 0);
      this.body.quaternion.vmult(forward, forward); // Use vmult instead of applyQuaternion
      // Apply force at wheel level
      const forcePoint = new CANNON.Vec3(5, 0, -1.5); // Point near the bottom of the car
      this.body.applyForce(forward, forcePoint);
    }

    if (keys[40] || keys[83]) {
      // Backward
      const backward = new CANNON.Vec3(-forwardForce * 0.5, 0, 0);
      this.body.quaternion.vmult(backward, backward);
      this.body.applyForce(backward, this.body.position);
    }

    if (keys[39] || keys[68]) {
      // Right
      this.body.applyTorque(new CANNON.Vec3(0, 0, -steerForce));
    }

    if (keys[37] || keys[65]) {
      // Left
      this.body.applyTorque(new CANNON.Vec3(0, 0, steerForce));
    }

    // Get the angle from quaternion
    this.angle = 2 * Math.acos(this.body.quaternion.w);
    if (this.body.quaternion.z < 0) this.angle *= -1;

    // Update visual position
    this.position.copy(this.body.position);
    this.quaternion.copy(this.body.quaternion);

    // Keep the car at a minimum height
    if (this.body.position.z < 0) {
      this.body.position.z = 0;
      this.body.velocity.z = 0;
    }

    if (this.wheels) {
      this.wheels.forEach((wheel, i) => {
        wheel.rotation.y += 0.1 * this.speed;
      });
    }

    if (this.lights) {
      this.lights.forEach((light, i) => {
        light.rotation.z = this.angle;
        light.target.position.clone(this.position);
        light.target.position.x += 35;
        light.target.position.y += i < 1 ? -8 : 8;
        light.target.updateMatrixWorld();
      });

      if (keys[76]) {
        keys[76] = false;
        this.lightsOn = !this.lightsOn;

        TweenMax.staggerTo(
          this.lights,
          0.3,
          {
            intensity: this.lightsOn ? 1 : 0,
            ease: RoughEase.ease,
          },
          0.02
        );
      }
    }

    // Calculate camera position relative to car's orientation
    const cameraOffset = new THREE.Vector3(0, -90, 40); // Directly behind and above the car
    // cameraOffset.applywAxisAngle(new THREE.Vector3(0, 0, 1), -this.angle); // Rotate offset with car

    // Set camera position relative to car
    camera.position.x = this.position.x + cameraOffset.x;
    camera.position.y = this.position.y + cameraOffset.y;
    camera.position.z = cameraOffset.z;

    // Look at the car
    camera.lookAt(
      new THREE.Vector3(
        this.position.x, // + (xdir * 4),
        this.position.y, // - (ydir * 4),
        0 //Math.sin( (this.speed / this.maxspeed) * Math.PI*2 )+1/2 * 80)
      )
    );

    // Add directional friction
    const velocity = this.body.velocity;
    const forward = new CANNON.Vec3(1, 0, 0);
    this.body.quaternion.vmult(forward, forward);

    // Get sideways velocity component
    const sidewaysVel = new CANNON.Vec3();
    forward.cross(velocity, sidewaysVel);
    sidewaysVel.cross(forward, sidewaysVel);

    // Apply stronger resistance to sideways motion
    const sidewaysFriction = 0.95;
    sidewaysVel.scale(-sidewaysFriction, sidewaysVel);
    this.body.applyImpulse(sidewaysVel, this.body.position);
  }
}

// 4. Helper functions
function initScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x242426, 20, 200);
  return scene;
}

function initCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    10,
    600
  );
  camera.position.z = 90;
  return camera;
}

function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x242426);
  renderer.toneMapping = THREE.LinearToneMapping;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  document.body.appendChild(renderer.domElement);
  return renderer;
}

function initLighting(scene) {
  let hemiLight = new THREE.HemisphereLight(0xebf7fd, 0xebf7fd, 0.2);
  hemiLight.position.set(0, 20, 20);
  scene.add(hemiLight);
}

function handleResize(camera, renderer) {
  window.addEventListener(
    "resize",
    function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    false
  );
}

function initControls() {
  var keys = [];

  document.body.addEventListener("keydown", function (e) {
    keys[e.keyCode] = true;
    e.preventDefault();
  });

  document.body.addEventListener("keyup", function (e) {
    keys[e.keyCode] = false;
    e.preventDefault();
  });

  return keys;
}

const keys = initControls();

function initCar() {
  let car = new Car();
  scene.add(car);
  renderCalls.push(car.update.bind(car));
  return car;
}

// Add this function before snowyGround()
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

function snowyGround() {
  let noise = noiseMap(256, 20, 30);
  let geometry = new THREE.PlaneGeometry(2000, 2000, 40, 45);
  let positions = geometry.attributes.position;

  // Update vertices using the position attribute buffer
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i);
    let y = positions.getY(i);
    let z = positions.getZ(i);

    x += (Math.cos(i * i) + 1 / 2) * 2;
    y += (Math.cos(i) + 1 / 2) * 2;
    z = (Math.sin(i * i * i) + 1 / 2) * -4;

    positions.setXYZ(i, x, y, z);
  }

  // Update the geometry
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  let material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 80,
    bumpMap: noise,
    bumpScale: 5.15,
    shading: THREE.SmoothShading,
  });

  let plane = new THREE.Mesh(geometry, material);
  plane.receiveShadow = true;
  plane.position.z = -5;

  scene.add(plane);

  // Modify ground physics
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: new CANNON.Material({
      friction: 0.5,
      restitution: 0.2,
    }),
    position: new CANNON.Vec3(0, 0, -5),
  });

  // Rotate the ground to be flat (since we're using Z-up)
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), 0);
  world.addBody(groundBody);

  return plane;
}

function render() {
  requestAnimationFrame(render);

  try {
    // Step the physics world with smaller timestep
    world.step(1 / 120);

    renderCalls.forEach((callback) => {
      callback();
    });

    renderer.render(scene, camera);
  } catch (error) {
    console.error("Render error:", error);
  }
}

// 5. Main initialization
const scene = initScene();
const camera = initCamera();
const renderer = initRenderer();
let renderCalls = [];

handleResize(camera, renderer);
initLighting(scene);
initControls();

// Create ground first
snowyGround();

// Then create car
initCar();

// Add contact material to world for better physics interaction
const groundMaterial = new CANNON.Material();
const contactMaterial = new CANNON.ContactMaterial(
  groundMaterial,
  carMaterial,
  {
    friction: 0.7,
    restitution: 0.3,
  }
);
world.addContactMaterial(contactMaterial);

// Start render loop
render();
