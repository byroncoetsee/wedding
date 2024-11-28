import * as THREE from "three";
import { shadowSupport } from "./utils.js";

class House {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      scale: params.scale || 1,
      rotation: params.rotation || 0,
      wallColor: params.wallColor || 0xe8eef2, // Light blue-gray
      roofColor: params.roofColor || 0x2f4f4f, // Dark slate gray
      windowColor: params.windowColor || 0xa5d6f2, // Light blue for windows
    };

    this.house = new THREE.Group();

    this.materials = {
      walls: new THREE.MeshLambertMaterial({
        color: this.params.wallColor,
      }),
      roof: new THREE.MeshLambertMaterial({
        color: this.params.roofColor,
      }),
      windows: new THREE.MeshPhongMaterial({
        color: this.params.windowColor,
        shininess: 100,
      }),
    };
  }

  drawMainStructure() {
    // Main building body
    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(20, 12, 10),
      this.materials.walls
    );
    mainBody.position.y = 6;
    this.house.add(mainBody);

    // Side wings
    const leftWing = new THREE.Mesh(
      new THREE.BoxGeometry(8, 10, 8),
      this.materials.walls
    );
    leftWing.position.set(-14, 5, 0);
    this.house.add(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.set(14, 5, 0);
    this.house.add(rightWing);
  }

  drawRoof() {
    // Main roof
    const mainRoof = new THREE.Mesh(
      new THREE.ConeGeometry(14, 6, 4),
      this.materials.roof
    );
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.position.y = 15;
    this.house.add(mainRoof);

    // Wing roofs
    const wingRoof = new THREE.Mesh(
      new THREE.ConeGeometry(6, 4, 4),
      this.materials.roof
    );
    wingRoof.rotation.y = Math.PI / 4;
    wingRoof.position.set(-14, 12, 0);
    this.house.add(wingRoof);

    const rightWingRoof = wingRoof.clone();
    rightWingRoof.position.set(14, 12, 0);
    this.house.add(rightWingRoof);
  }

  drawWindows() {
    // Main building windows
    const windowGeometry = new THREE.BoxGeometry(2, 3, 0.1);
    const windowPositions = [
      [-6, 7, 5.1],
      [-2, 7, 5.1],
      [2, 7, 5.1],
      [6, 7, 5.1],
      [-6, 7, -5.1],
      [-2, 7, -5.1],
      [2, 7, -5.1],
      [6, 7, -5.1],
    ];

    windowPositions.forEach((pos) => {
      const window = new THREE.Mesh(windowGeometry, this.materials.windows);
      window.position.set(...pos);
      this.house.add(window);
    });
  }

  init() {
    this.drawMainStructure();
    this.drawRoof();
    this.drawWindows();

    // Position and rotate house according to params
    this.house.position.set(this.params.x, this.params.y, this.params.z);
    this.house.scale.setScalar(this.params.scale);
    this.house.rotation.y = this.params.rotation;

    // Add the house group to the scene
    // this.scene.add(this.house);
    shadowSupport(this.house);
    return this.house;
  }
}

export default House;
