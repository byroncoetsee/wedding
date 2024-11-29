// import { GLTFLoader } from "./jsm/loaders/GLTFLoader.js";
// import { DRACOLoader } from "./jsm/loaders/DRACOLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";

class Mansion {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      scale: params.scale || 1,
      rotation: params.rotation || 0,
    };

    this.mansion = new THREE.Group();
  }

  async init() {
    // Initialize Draco loader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
    );

    // Initialize GLTF loader and set Draco loader
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // Return a promise that resolves when the model is loaded
    return new Promise((resolve, reject) => {
      loader.load(
        // Resource URL
        "/models/Home.glb",

        // Called when resource is loaded
        (gltf) => {
          // Add model to group
          this.mansion.add(gltf.scene);

          // Apply transforms from params
          this.mansion.position.set(
            this.params.x,
            this.params.y,
            this.params.z
          );
          this.mansion.rotation.y = this.params.rotation;
          this.mansion.scale.set(
            this.params.scale,
            this.params.scale,
            this.params.scale
          );

          // Enable shadows
          this.mansion.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          resolve(gltf);
        },

        // Called while loading is progressing
        (xhr) => {
          console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },

        // Called when loading has errors
        (error) => {
          console.error("Error loading model:", error);
          reject(error);
        }
      );
    });
  }
}

export default Mansion;
