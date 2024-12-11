import * as THREE from "three";
import { sendTelegramMessage } from "./telegram";

// Add this at the start of the file, after imports
const DEBUG = true;

// Add this function near the top
const debugLog = (message) => {
  if (!DEBUG) return;

  // Create or get debug console
  let debugConsole = document.getElementById("debug-console");
  if (!debugConsole) {
    debugConsole = document.createElement("div");
    debugConsole.id = "debug-console";
    debugConsole.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 10px;
            max-height: 150px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 5px;
            overflow-y: auto;
            z-index: 1000;
        `;
    document.body.appendChild(debugConsole);
  }

  // Add new message
  const msgElement = document.createElement("div");
  msgElement.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  debugConsole.appendChild(msgElement);

  // Keep only last 10 messages
  while (debugConsole.children.length > 10) {
    debugConsole.removeChild(debugConsole.firstChild);
  }

  // Scroll to bottom
  debugConsole.scrollTop = debugConsole.scrollHeight;
};

// Rotate arms / legs
const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Add shadow support to object
const shadowSupport = (group) => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
};

// Get random number
const randomize = (min, max, float = false) => {
  const val = Math.random() * (max - min) + min;
  if (float) {
    return val;
  }
  return Math.floor(val);
};

// Random MORE VERTICES
const map = (val, smin, smax, emin, emax) =>
  ((emax - emin) * (val - smin)) / (smax - smin) + emin;

// Update the jitter function to maintain connectivity
const jitter = (geo, per) => {
  const pos = geo.getAttribute("position");
  const arr = pos.array;
  const vertexCount = pos.count;

  // Create an array to store the jitter values for each unique vertex
  const jitterMap = new Map();

  // First pass: calculate and store jitter for each unique vertex position
  for (let i = 0; i < arr.length; i += 3) {
    const key = `${Math.round(arr[i] * 100)},${Math.round(
      arr[i + 1] * 100
    )},${Math.round(arr[i + 2] * 100)}`;

    if (!jitterMap.has(key)) {
      jitterMap.set(key, {
        x: map(Math.random(), 0, 1, -per, per),
        y: map(Math.random(), 0, 1, -per, per),
        z: map(Math.random(), 0, 1, -per, per),
      });
    }
  }

  // Second pass: apply the same jitter to shared vertices
  for (let i = 0; i < arr.length; i += 3) {
    const key = `${Math.round(arr[i] * 100)},${Math.round(
      arr[i + 1] * 100
    )},${Math.round(arr[i + 2] * 100)}`;
    const jitterVal = jitterMap.get(key);

    arr[i] += jitterVal.x; // x
    arr[i + 1] += jitterVal.y; // y
    arr[i + 2] += jitterVal.z; // z
  }

  pos.needsUpdate = true;
  return geo;
};

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

const showDietaryPopup = (user) => {
  const popup = document.getElementById("popup");
  const popupTitle = document.getElementById("popup-title");
  const popupText = document.getElementById("popup-text");

  popupTitle.textContent = "Dietary Requirements";

  // Create form content
  const formContent = `
    <form id="dietary-form">
    <br>
      <div class="radio-group">
        <label>
          <input type="radio" name="diet" value="all" ${user.dietaryRequirements === 'None' ? 'checked' : ''}>
          All food (no restrictions)
        </label>
        <label>
          <input type="radio" name="diet" value="vegetarian" ${user.dietaryRequirements === 'Vegetarian' ? 'checked' : ''}>
          Vegetarian/Vegan
        </label>
      </div>
      <div class="allergen-group">
        <label for="allergens">Allergies/Additional Requirements:</label>
        <input type="text" id="allergens" name="allergens" placeholder="e.g., nuts, shellfish, etc.">
      </div>
      <br>
      <button type="submit" class="submit-btn">Save Dietary Requirements</button>
    </form>
  `;

  popupText.innerHTML = formContent;

  // Add form submit handler
  const form = document.getElementById("dietary-form");
  form.onsubmit = async (e) => {
    e.preventDefault();

    const dietType = form.querySelector('input[name="diet"]:checked').value;
    const allergens = form.querySelector('#allergens').value.trim();

    // Combine diet type and allergens
    var dietaryRequirements = dietType

    if (allergens) {
      dietaryRequirements += ` - ${allergens}`;
    }

    // Update user using the class method
    user.setDietary(dietaryRequirements);

    // Send to Telegram
    try {
      await sendTelegramMessage(
        `<b>Dietary Update</b>\n` +
        `Name: ${user.name}${user.partnerName ? ' & ' + user.partnerName : ''}\n` +
        `Requirements: ${dietaryRequirements}`
      );
      hidePopup();
    } catch (error) {
      console.error('Error sending dietary requirements:', error);
      alert('There was an error saving your dietary requirements. Please try again.');
    }
  };

  popup.style.display = "block";
};

const showPopup = (title, content) => {
  const popup = document.getElementById("popup");
  const popupTitle = document.getElementById("popup-title");
  const popupText = document.getElementById("popup-text");

  popupTitle.textContent = title;
  popupText.innerHTML = content;

  popup.style.display = "block";
};

function hidePopup() {
  const popup = document.getElementById("popup");
  popup.style.display = "none";
}

export {
  debugLog,
  degreesToRadians,
  shadowSupport,
  randomize,
  map,
  jitter,
  noiseMap,
  showPopup,
  hidePopup,
  showDietaryPopup,
};
