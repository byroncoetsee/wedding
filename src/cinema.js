import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { TextureLoader } from "three";

class Cinema {
  constructor(scene, params = {}) {
    this.scene = scene;
    this.params = {
      x: params.x || 0,
      y: params.y || 0,
      z: params.z || 0,
      rotation: params.rotation || 0,
      text: params.text || "",
      width: params.width || 20,
      height: params.height || 10,
      ...params,
    };

    // Create main group
    this.screenGroup = new THREE.Group();
    this.screenGroup.position.y = 5;
    this.cinemaGroup = new THREE.Group();
    this.cinemaGroup.add(this.screenGroup);
    this.scene.add(this.cinemaGroup);

    // Position according to params
    this.cinemaGroup.position.set(this.params.x, this.params.y, this.params.z);
    this.cinemaGroup.rotation.y = this.params.rotation;

    // Materials
    this.screenMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.8,
    });

    this.frameMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
    });

    this.projectorMaterial = new THREE.MeshPhongMaterial({
      color: 0x222222,
    });

    this.init();
  }

  init() {
    this.createScreen();
    this.createSpotlight();
    this.addText();
  }

  createScreen() {
    const textureLoader = new TextureLoader();
    textureLoader.load("./FAE_cinema.jpg", (texture) => {
      this.screenMaterial.map = texture;
      this.screenMaterial.needsUpdate = true;
    });

    // Create screen
    const screenGeometry = new THREE.PlaneGeometry(
      this.params.width,
      this.params.height
    );
    const screen = new THREE.Mesh(screenGeometry, this.screenMaterial);
    screen.receiveShadow = true;
    this.screen = screen;

    // Create frame
    const frameThickness = 0.5;
    const frameGeometry = new THREE.BoxGeometry(
      this.params.width + frameThickness,
      this.params.height + frameThickness,
      frameThickness
    );
    const frame = new THREE.Mesh(frameGeometry, this.frameMaterial);
    frame.position.z = -frameThickness / 2 - 0.1;
    frame.castShadow = true;

    // Add to group
    this.screenGroup.add(screen);
    this.screenGroup.add(frame);
  }

  createSpotlight() {
    const lightSourcePosition = new THREE.Vector3(0, 0, 15);

    this.spotlight = new THREE.SpotLight(0xffffff, 0.1);
    this.spotlight.position.set(
      lightSourcePosition.x,
      lightSourcePosition.y + 2,
      lightSourcePosition.z - 1
    );
    this.spotlight.target = this.screen;
    this.spotlight.angle = 0.8;
    this.spotlight.penumbra = 0.2;
    this.spotlight.decay = 0.5;
    this.spotlight.distance = 50;
    this.spotlight.castShadow = true;

    // Create projector body
    const projectorBody = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 2),
      this.projectorMaterial
    );
    projectorBody.position.set(
      lightSourcePosition.x,
      lightSourcePosition.y,
      lightSourcePosition.z
    );
    projectorBody.castShadow = true;

    // Create projector lens
    const projectorLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16),
      this.projectorMaterial
    );
    projectorLens.rotation.x = Math.PI / 2;
    projectorLens.position.set(
      lightSourcePosition.x,
      lightSourcePosition.y,
      lightSourcePosition.z - 1
    );
    projectorLens.castShadow = true;

    this.cinemaGroup.add(this.spotlight);
    this.cinemaGroup.add(projectorBody);
    this.cinemaGroup.add(projectorLens);

    // Add spotlight camera helper for shadow debugging
    // const spotlightHelper = new THREE.SpotLightHelper(this.spotlight);
    // this.cinemaGroup.add(spotlightHelper);

    // Start flickering animation
    this.animateSpotlight();
  }

  animateSpotlight() {
    const flicker = () => {
      // Increased base intensity and variation
      this.spotlight.intensity = 0.5 + Math.random() * 3;

      // Schedule next flicker
      setTimeout(flicker, 100);
    };

    flicker();
  }

  addText() {
    // Remove existing text if any
    this.screenGroup.children.forEach((child) => {
      if (child.isTextMesh) {
        this.screenGroup.remove(child);
      }
    });

    const loader = new FontLoader();
    loader.load("./text-paint.json", (font) => {
      // Split text into lines
      const lines = this.params.text.split("\n");
      const lineHeight = 1.2;

      // Create text group
      const textGroup = new THREE.Group();
      textGroup.isTextMesh = true;

      lines.forEach((line, index) => {
        const textGeometry = new TextGeometry(line, {
          font: font,
          size: 0.8,
          depth: 0.1,
          curveSegments: 12,
          bevelEnabled: false,
        });

        // Center align text
        textGeometry.computeBoundingBox();
        const lineWidth =
          textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;

        const textMesh = new THREE.Mesh(
          textGeometry,
          new THREE.MeshPhongMaterial({ color: 0x000000 })
        );

        // Position text
        textMesh.position.x = -lineWidth / 2;
        textMesh.position.y = (lines.length / 2 - index) * lineHeight;
        textMesh.position.z = 0.1;

        textGroup.add(textMesh);
      });

      this.screenGroup.add(textGroup);
    });
  }

  updateText(newText) {
    this.params.text = newText;
    this.addText();
  }
}

export default Cinema;
