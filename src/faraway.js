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
      columns: new THREE.MeshLambertMaterial({
        color: 0xffffff, // White columns
      }),
      chimney: new THREE.MeshLambertMaterial({
        color: 0xc0c0c0, // Light gray
      }),
    };
  }

  drawMainStructure() {
    // Central mansion body (two stories)
    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(30, 20, 15),
      this.materials.walls
    );
    mainBody.position.y = 10;
    this.house.add(mainBody);

    // Side wings (slightly lower)
    const wingGeometry = new THREE.BoxGeometry(12, 16, 12);
    const leftWing = new THREE.Mesh(wingGeometry, this.materials.walls);
    leftWing.position.set(-21, 8, 0);
    this.house.add(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.set(21, 8, 0);
    this.house.add(rightWing);

    // Add columns to front facade
    this.addColumns();

    // Add chimneys
    this.addChimneys();
  }

  addColumns() {
    const columnGeometry = new THREE.CylinderGeometry(0.5, 0.5, 16, 8);
    const columnPositions = [
      [-8, 8, 7.6],
      [-4, 8, 7.6],
      [0, 8, 7.6],
      [4, 8, 7.6],
      [8, 8, 7.6],
    ];

    columnPositions.forEach((pos) => {
      const column = new THREE.Mesh(columnGeometry, this.materials.columns);
      column.position.set(...pos);
      this.house.add(column);
    });
  }

  addChimneys() {
    const chimneyGeometry = new THREE.BoxGeometry(2, 4, 2);
    const chimneyPositions = [
      [-10, 22, -2],
      [10, 22, -2],
      [-21, 18, -2],
      [21, 18, -2],
    ];

    chimneyPositions.forEach((pos) => {
      const chimney = new THREE.Mesh(chimneyGeometry, this.materials.chimney);
      chimney.position.set(...pos);
      this.house.add(chimney);
    });
  }

  drawRoof() {
    // Main roof (more complex hip roof)
    const mainRoofGeometry = new THREE.ConeGeometry(18, 8, 4);
    const mainRoof = new THREE.Mesh(mainRoofGeometry, this.materials.roof);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.position.y = 24;
    mainRoof.scale.set(1.2, 1, 0.8);
    this.house.add(mainRoof);

    // Wing roofs
    const wingRoofGeometry = new THREE.ConeGeometry(8, 6, 4);
    const leftWingRoof = new THREE.Mesh(wingRoofGeometry, this.materials.roof);
    leftWingRoof.rotation.y = Math.PI / 4;
    leftWingRoof.position.set(-21, 19, 0);
    this.house.add(leftWingRoof);

    const rightWingRoof = leftWingRoof.clone();
    rightWingRoof.position.set(21, 19, 0);
    this.house.add(rightWingRoof);
  }

  drawWindows() {
    // Create detailed window frames
    const windowUnit = this.createWindowUnit();

    // Main building windows (two rows)
    const windowPositions = [
      // First floor
      [-10, 5, 7.6],
      [-5, 5, 7.6],
      [0, 5, 7.6],
      [5, 5, 7.6],
      [10, 5, 7.6],
      // Second floor
      [-10, 15, 7.6],
      [-5, 15, 7.6],
      [0, 15, 7.6],
      [5, 15, 7.6],
      [10, 15, 7.6],
      // Wings
      [-21, 5, 6.1],
      [-21, 15, 6.1],
      [21, 5, 6.1],
      [21, 15, 6.1],
    ];

    windowPositions.forEach((pos) => {
      const window = windowUnit.clone();
      window.position.set(...pos);
      this.house.add(window);
    });
  }

  createWindowUnit() {
    const windowGroup = new THREE.Group();

    // Window frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(3, 4, 0.2),
      this.materials.columns
    );

    // Window glass
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.6, 0.1),
      this.materials.windows
    );
    glass.position.z = 0.1;

    windowGroup.add(frame);
    windowGroup.add(glass);

    return windowGroup;
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
