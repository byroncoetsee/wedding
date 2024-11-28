import * as THREE from "three";
import { jitter, shadowSupport } from "./utils";
import { degreesToRadians } from "./utils";

class Cabin {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      scale: params.scale || 1,
      rotation: params.rotation || 0,
      woodColor: params.woodColor || 0x8b4513,
      roofColor: params.roofColor || 0x4a4a4a,
    };

    this.cabin = new THREE.Group();

    // Materials
    this.woodMaterial = new THREE.MeshLambertMaterial({
      color: this.params.woodColor,
    });
    this.roofMaterial = new THREE.MeshLambertMaterial({
      color: this.params.roofColor,
    });

    // Updated window material with emissive property
    this.windowMaterial = new THREE.MeshLambertMaterial({
      color: "#744b04",
      emissive: "#744b04", // Yellowish glow
      emissiveIntensity: 0.5, // Initial intensity
    });
  }

  drawCabin() {
    // Main cabin structure - even bigger now
    const cabinBody = new THREE.Mesh(
      new THREE.BoxGeometry(12, 8, 12),
      this.woodMaterial
    );
    cabinBody.position.y = 4;
    this.cabin.add(cabinBody);

    // Roof - adjusted for larger cabin
    const roofGeometry = new THREE.ConeGeometry(9, 4, 4, 1, false);
    const roof = new THREE.Mesh(roofGeometry, this.roofMaterial);
    roof.position.y = 10.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.cabin.add(roof);

    // Door - adjusted position
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x4a3b22 })
    );
    door.position.set(0, 2, 6.1);
    door.castShadow = true;
    this.cabin.add(door);

    // Windows - adjusted positions
    const windowGeometry = new THREE.BoxGeometry(2, 2, 0.3);

    // Front windows - adjusted positions
    const frontWindow1 = new THREE.Mesh(windowGeometry, this.windowMaterial);
    frontWindow1.position.set(-3.5, 4.5, 6);
    this.cabin.add(frontWindow1);

    const frontWindow2 = frontWindow1.clone();
    frontWindow2.position.x = 3.5;
    this.cabin.add(frontWindow2);

    // Side windows - adjusted positions
    // Right
    const sideWindow1 = frontWindow1.clone();
    sideWindow1.rotation.y = Math.PI / 2;
    sideWindow1.position.set(6.1, 4.5, 0);
    this.cabin.add(sideWindow1);

    // Left
    const sideWindow2 = sideWindow1.clone();
    sideWindow2.position.x = -6.1;
    this.cabin.add(sideWindow2);

    // Front logs (avoiding door)
    for (let i = 0; i < 15; i++) {
      const y = i * 0.6;
      const logGeometry = new THREE.CylinderGeometry(0.4, 0.4, 12, 8);
      // Full log above windows
      const log = new THREE.Mesh(logGeometry, this.woodMaterial);
      log.rotation.z = degreesToRadians(90);
      log.position.set(0, y, 5.7);
      jitter(log.geometry, 0.01);
      this.cabin.add(log);
    }

    // Back logs
    for (let i = 0; i < 15; i++) {
      const y = i * 0.6;
      const logGeometry = new THREE.CylinderGeometry(0.4, 0.4, 12, 8);
      // Full log above windows
      const log = new THREE.Mesh(logGeometry, this.woodMaterial);
      log.rotation.z = degreesToRadians(90);
      log.position.set(0, y, -5.7);
      jitter(log.geometry, 0.01);
      this.cabin.add(log);
    }

    // Side logs (avoiding windows)
    for (let i = 0; i < 15; i++) {
      const y = i * 0.6;
      const logGeometry = new THREE.CylinderGeometry(0.4, 0.4, 12, 8);
      // Below or above windows
      const leftLog = new THREE.Mesh(logGeometry, this.woodMaterial);
      const rightLog = new THREE.Mesh(logGeometry, this.woodMaterial);

      leftLog.rotation.x = Math.PI / 2;
      rightLog.rotation.x = Math.PI / 2;

      leftLog.position.set(-5.8, y, 0); // Inset from sides
      rightLog.position.set(5.8, y, 0);

      jitter(leftLog.geometry, 0.05);
      jitter(rightLog.geometry, 0.05);

      this.cabin.add(leftLog, rightLog);
    }

    // Position the entire cabin
    this.cabin.position.set(this.params.x, this.params.y, this.params.z);
    this.cabin.rotation.y = this.params.rotation;
    this.cabin.scale.set(
      this.params.scale,
      this.params.scale,
      this.params.scale
    );
  }

  flickerWindows() {
    const flickerSpeed = 0.1; // Speed of flickering
    const maxIntensity = 0.7; // Maximum emissive intensity
    const minIntensity = 0.4; // Minimum emissive intensity

    setInterval(() => {
      const intensity =
        minIntensity + Math.random() * (maxIntensity - minIntensity);
      this.windowMaterial.emissiveIntensity = intensity;
    }, flickerSpeed * 1000);
  }

  init() {
    this.drawCabin();
    this.flickerWindows(); // Start flickering effect
    shadowSupport(this.cabin);
    return this.cabin;
  }
}

export default Cabin;
