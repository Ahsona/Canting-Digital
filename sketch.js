//
// p5.js code
//

let waxLayers = [];
let paintLayers = [];
let sketchLayers = [];

let waxLocked = [];
let paintLocked = [];

let waxLayerSnapshots = [];
let paintLayerSnapshots = [];

// Default values
let currentTool = "cantingTool";
let currentNozzleType = 1;
let paintColor = "#0523b8";

let brushCursorSize = 10;
let showBrushCursor = false;
let cantingCursorAngle = 0;
let wasDrawing = false;

let activeLayer;
let waxVisible = true;

let paintVisible = [];
let sketchVisible = [];
let sketchOpacity = [];

let currentWaxLayer = 0;
let currentPaintLayer = 0;
let currentSketchLayer = 0;

let defaultPattern;

// Canvas size and responsive web design
let canvasWidth = 900;
let canvasHeight = 600;

let artX = 0;
let artY = 0;

let prevArtX = 0;
let prevArtY = 0;

// Fabric and boilling animation
let fabricTexture;

let waxRemovalAnimation = false;
let waxRemovalPhase = 0;
let waxRemovalStartTime = 0;

let clothOffsetY = 0;
let waxRemovedDuringAnimation = false;

let steamParticles = [];

// Wet Simulations
let waxSimulations = [];
let paintSimulations = [];
let fabricNoise;

// Your display canvas remains 900 × 600.
// The paint simulation itself runs at half resolution.
const PAINT_SIM_SCALE = 1.0;

// 20 simulation steps per second.
const PAINT_UPDATE_INTERVAL = 50;

// Paint becomes inactive below this wetness.
const PAINT_SLEEP_WETNESS = 1.5;

// Minimum wetness required for diffusion.
const PAINT_SPREAD_THRESHOLD = 6;

// How long a newly touched simulation is allowed
// to remain active as a safety limit.
const PAINT_SLEEP_TIMEOUT = 3000;

// Brush interpolation distance.
// Larger = fewer deposits while dragging quickly.
const PAINT_STAMP_SPACING = 3;

const sliderRefs = {
  pencilTool: document.querySelector("#pencilSizeSlider"),
  eraserTool: document.querySelector("#eraserSizeSlider"),
  cantingTool: document.querySelector("#cantingSizeSlider"),
  paintDabberTool: document.querySelector("#paintDabberSizeSlider"),
};

let isPatternLibraryOpen = false;

let needsThumbnailUpdate = false;
const THUMBNAIL_UPDATE_INTERVAL = 120; // frames

function requestThumbnailUpdate() {
  needsThumbnailUpdate = true;
}

// Add warning to prevent refreshing webpage
window.addEventListener("beforeunload", (event) => {
  event.preventDefault();
  event.returnValue = "";
});

// Load default pattern when the app opens
function preload() {
  defaultPattern = loadImage(
    "images/PresetPatterns/Simplified Patterns 900x600/Simple Mega Mendung 900x600.png"
  );
}

// Setup
function setup() {
  pixelDensity(1);
  canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("canvasContainer");
  canvas.mouseOver(() => {
    showBrushCursor = true;
  });
  canvas.mouseOut(() => {
    showBrushCursor = false;
  });
  // Create default pattern sketch layer
  ensureSketchLayer();

  // Draw the default pattern onto the layer
  sketchLayers[currentSketchLayer].image(
    defaultPattern,
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  // Set the default pattern layer opacity
  sketchOpacity[currentSketchLayer] = 35;

  // Update opacity slider
  const opacitySlider = document.querySelector("#opacitySlider");
  const opacityValue = document.querySelector(".opacityValue");

  if (opacitySlider && opacityValue) {
    opacitySlider.value = 35;
    opacityValue.textContent = "35%";
  }

  // Refresh layer thumbnails
  updateLayerThumbnails();

  // Download button
  const downloadButton =
    document.getElementById("downloadButton");

  downloadButton.addEventListener("click", () => {
    saveCanvas("my-batik", "png");
  });

  // Reset Button
  const resetButton = document.querySelector("#resetButton");

  resetButton.addEventListener("click", function() {
    location.reload();
  });

  //Fabric noise
  fabricNoise = new Float32Array(
    canvasWidth * canvasHeight
  );
  for (let i = 0; i < fabricNoise.length; i++) {
    fabricNoise[i] = random(0.5, 1.5);
  }

  // Fabric texture background
  fabricTexture =
    createGraphics(
      canvasWidth,
      canvasHeight
    );

  fabricTexture.loadPixels();

  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {

      const i =
        (x + y * canvasWidth) * 4;

      const weave =
        sin(x * 0.18) *
        sin(y * 0.18);

      const grain =
        random(-8, 8);

      const shade =
        235 +
        weave * 2 +
        grain;

      fabricTexture.pixels[i + 0] = shade;
      fabricTexture.pixels[i + 1] = shade;
      fabricTexture.pixels[i + 2] = shade;
      fabricTexture.pixels[i + 3] = 200;
    }
  }
  fabricTexture.updatePixels();
}

function ensureWaxLayer() {
  if (waxLayers.length === 0) {
    const newWaxLayer = createGraphics(canvasWidth, canvasHeight);
    newWaxLayer.clear();
    waxLayers.push(newWaxLayer);
    const sim =
      createWaxSimulation(
        canvasWidth,
        canvasHeight
      );
    waxSimulations.push(sim);
    waxLocked.push(false);
    waxLayerSnapshots.push(null);
    currentWaxLayer = 0;
    updateLayerThumbnails();
  }
}

function ensurePaintLayer() {
  if (paintLayers.length === 0) {

    const newPaintLayer =
      createGraphics(
        canvasWidth,
        canvasHeight
      );

    newPaintLayer.clear();

    paintLayers.push(
      newPaintLayer
    );

    paintVisible.push(true);
    paintLocked.push(false);

    paintLayerSnapshots.push(null);

    // Create simulation for this layer
    const sim =
      createPaintSimulation(
        canvasWidth,
        canvasHeight
      );
    paintSimulations.push(sim);
    currentPaintLayer = 0;
    updateLayerThumbnails();
  }
}

function ensureSketchLayer() {
  if (sketchLayers.length === 0) {
    const newSketchLayer =
      createGraphics(canvasWidth, canvasHeight);
    newSketchLayer.clear();
    sketchLayers.push(newSketchLayer);
    sketchVisible.push(true);
    sketchOpacity.push(100);
    currentSketchLayer = 0;
    // Reset opacity UI
    const opacitySlider =
      document.querySelector("#opacitySlider");
    const opacityValue =
      document.querySelector(".opacityValue");
    if (opacitySlider && opacityValue) {
      opacitySlider.value = 100;
      opacityValue.textContent = "100%";
    }
    updateLayerThumbnails();
  }
}

function draw() {
  if (isPatternLibraryOpen) return;
  updateArtworkCoordinates();
  background(240);
  // Base cloth
  image(
    fabricTexture,
    0,
    0
  );
  // Draw with currently selected tool
  if (!waxRemovalAnimation && mouseIsPressed && isInsideCanvas() && touches.length <= 1) {
    // CANTING / WAX
    if (
      currentTool === "cantingTool" &&
      waxVisible
    ) {
      ensureWaxLayer();
      if (!waxLocked[currentWaxLayer]) {
        activeLayer = waxLayers[currentWaxLayer];
        const slider = sliderRefs.cantingTool;
        if (slider) {
          const size = getCantingSize();
          drawCantingStroke(
            activeLayer,
            color("rgb(193, 158, 77)"),
            size,
            currentNozzleType
          );
        }
        requestThumbnailUpdate();
      }
    }
    // PAINT DABBER / PAINT
   else if (
      currentTool === "paintDabberTool" &&
      paintVisible
    ) {
      ensurePaintLayer();
      if (
        !paintLocked[currentPaintLayer]
      ) {
        const slider =
          sliderRefs.paintDabberTool;
        if (slider) {
          const size =
            Number(slider.value);
          const sim =
            paintSimulations[
              currentPaintLayer
            ];
          drawPaintStroke(
            sim,
            color(paintColor),
            size
          );
        }
        requestThumbnailUpdate();
      }
    }
    // PENCIL / SKETCH
    else if (
      currentTool === "pencilTool"
    ) {
      ensureSketchLayer();
      if (sketchVisible[currentSketchLayer]) {
        activeLayer = sketchLayers[currentSketchLayer];
        const slider = sliderRefs.pencilTool;
        if (slider) {
          const size = Number(slider.value);
          drawStroke(
            activeLayer,
            color("#565656"),
            size
          );
        }
        requestThumbnailUpdate();
      }
    }
    // ERASER / SKETCH
    else if (
      currentTool === "eraserTool"
    ) {
      if (
        sketchLayers.length > 0 &&
        sketchLayers[currentSketchLayer] &&
        sketchVisible[currentSketchLayer]
      ) {
        activeLayer = sketchLayers[currentSketchLayer];
        const slider = sliderRefs.eraserTool;
        if (slider) {
          const size = Number(slider.value);
          eraseStroke(
            activeLayer,
            size
          );
        }
        requestThumbnailUpdate();
      }
    }
  }
  // Paint simulation
  updatePaintSimulations();
  // Wax simulation
  for (let i = 0; i < waxLayers.length; i++) {
    if (waxSimulations[i]) {
      spreadWax(waxSimulations[i]);
      renderWaxSimulation(
        waxSimulations[i],
        waxLayers[i]
      );
    }
  }
  // Composite PAINT layers
  for (let i = 0; i < paintLayers.length; i++) {
    if (paintVisible[i]) {
      image(paintLayers[i], 0, 0);
    }
  }
  // Composite SKETCH layers
  for (let i = 0; i < sketchLayers.length; i++) {
    if (sketchVisible[i]) {
      const alpha = map(sketchOpacity[i], 0, 100, 0, 255);
      push();
      tint(255, alpha);
      image(sketchLayers[i], 0, 0);
      pop();
    }
  }
  noTint();
  // Composite current WAX
  if (
    waxVisible &&
    waxLayers.length > 0 &&
    waxLayers[currentWaxLayer]
  ) {
    image(waxLayers[currentWaxLayer], 0, 0);
  }
  drawBrushCursor();

  // Do the expensive DOM/thumbnail refresh only periodically
  // while a stroke is in progress, not on every single frame.
  if (needsThumbnailUpdate && frameCount % THUMBNAIL_UPDATE_INTERVAL === 0) {
    updateLayerThumbnails();
    needsThumbnailUpdate = false;
  }
  updateWaxRemovalAnimation();
  // Fabric texture overlay
  push();
  tint(255, 255);
  blendMode(MULTIPLY);
  image(fabricTexture, 0, 0);
  pop();
}

// Make sure the UI catches up the moment a stroke ends,
// even if it didn't land on a throttled frame.
function mouseReleased() {
  if (needsThumbnailUpdate) {
    updateLayerThumbnails();
    needsThumbnailUpdate = false;
  }
}

// Save art as jpg.
function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('my-batik', 'png');
  }
}

// Remove Wax Button
const removeWaxButton = document.querySelector("#removeWaxButton");
removeWaxButton.addEventListener(
  "click",
  function() {
    if (
      waxLayers.length === 0 ||
      !waxLayers[currentWaxLayer]
    ) {
      return;
    }
    waxRemovalAnimation = true;
    waxRemovalPhase = 0;
    waxRemovalStartTime =
      millis();
    clothOffsetY = 0;
    waxRemovedDuringAnimation =
      false;
    createSteamParticles();
  }
);

function actuallyRemoveWax() {
  // Save a snapshot of the current wax BEFORE clearing it
  waxLayerSnapshots[currentWaxLayer] =
    waxLayers[currentWaxLayer].get();
  // Lock the current wax layer
  waxLocked[currentWaxLayer] = true;
  // Remove resist
  const oldSim =
    waxSimulations[currentWaxLayer];
  if (oldSim) {
    oldSim.resistMask.fill(0);
  }
  // Clear the actual working wax layer
  waxLayers[currentWaxLayer].clear();
  // Create a new empty wax layer
  const newWaxLayer = createGraphics(
    canvasWidth,
    canvasHeight
  );
  newWaxLayer.clear();
  // Add the new layer
  waxLayers.push(newWaxLayer);
  // New layer is editable
  waxLocked.push(false);
  // New layer has no snapshot yet
  waxLayerSnapshots.push(null);
  const sim =
  createWaxSimulation(
    canvasWidth,
    canvasHeight
  );
  waxSimulations.push(sim);
  // Make the new layer current
  currentWaxLayer = waxLayers.length - 1;
  updateLayerThumbnails();
}

// Boiling animation
function createSteamParticles() {
  const overlay =
    document.querySelector("#steamOverlay");
  overlay.innerHTML = "";
  for (let i = 0; i < 20; i++) {
    const bubble =
      document.createElement("div");
    bubble.classList.add("steam");
    bubble.style.left =
      `${50 + random(-25,25)}%`;
    bubble.style.bottom = "-20px";
    bubble.style.animationDelay =
      `${random(0.5, 1.5)}s`;
    overlay.appendChild(bubble);
  }
}

function drawSteamParticles() {
  noStroke();
  for (const p of steamParticles) {
    fill(
      255,
      p.alpha
    );
    ellipse(
      p.x,
      p.y,
      p.size * 0.8,
      p.size * 2.5
    );
    ellipse(
      p.x + 4,
      p.y - 8,
      p.size * 0.6,
      p.size * 1.8
    );
    p.y -= p.speed;
    p.x += sin(
      frameCount * 0.03 +
      p.y * 0.05
    ) * 0.4;
    p.alpha -= 0.5;
  }
  steamParticles =
    steamParticles.filter(
      p => p.alpha > 0
    );
}

function updateWaxRemovalAnimation() {
  if (!waxRemovalAnimation) {
    return;
  }
  const elapsed =
    millis() -
    waxRemovalStartTime;

  // PHASE 0
  // Cloth sinking
  if (waxRemovalPhase === 0) {
    clothOffsetY =
      lerp(
        0,
        height + 100,
        min(elapsed / 800, 1)
      );
  const canvas =
    document.querySelector(
      "#canvasContainer canvas"
    );
  canvas.style.transform =
    `translateY(${clothOffsetY}px)`;

    if (elapsed > 800) {
      waxRemovalPhase = 1;
      waxRemovalStartTime =
        millis();
    }
  }
  // PHASE 1
  // Boiling
  else if (waxRemovalPhase === 1) {
    if (!waxRemovedDuringAnimation) {
      actuallyRemoveWax();
      waxRemovedDuringAnimation =
        true;
    }
    drawSteamParticles();
    if (elapsed > 1000) {
      waxRemovalPhase = 2;
      waxRemovalStartTime =
        millis();
    }
    const canvas =
      document.querySelector(
        "#canvasContainer canvas"
      );
    canvas.style.transform =
      `translateY(${height + 100 +
      sin(frameCount * 0.3) * 8}px)`;
  }
  // PHASE 2
  // Rising
  else if (waxRemovalPhase === 2) {
    clothOffsetY =
      lerp(
        height + 100,
        0,
        min(elapsed / 800, 1)
      );
  const canvas =
    document.querySelector(
      "#canvasContainer canvas"
    );
  canvas.style.transform =
    `translateY(${clothOffsetY}px)`;

    drawSteamParticles();
    if (elapsed > 800) {
      clothOffsetY = 0;
      waxRemovalAnimation =
        false;
    }
  }
}

// // Fix Color Button
// const fixColorButton = document.querySelector("#fixColorButton");
// fixColorButton.addEventListener("click", function() {
//   // Make sure a paint layer actually exists
//   if (
//     paintLayers.length === 0 ||
//     !paintLayers[currentPaintLayer]
//   ) {
//     return;
//   }
//   // Save a snapshot BEFORE creating the new layer
//   paintLayerSnapshots[currentPaintLayer] =
//     paintLayers[currentPaintLayer].get();
//   // Lock the current color layer
//   paintLocked[currentPaintLayer] = true;
//   // Create a new empty color layer
//   const newPaintLayer = createGraphics(
//     canvasWidth,
//     canvasHeight
//   );
//   newPaintLayer.clear();
//   // Add the new layer
//   paintLayers.push(newPaintLayer);
//   // New layer is editable
//   paintLocked.push(false);
//   // New layer has no snapshot yet
//   paintLayerSnapshots.push(null);
//   // Make the new layer current
//   currentPaintLayer = paintLayers.length - 1;
//   updateLayerThumbnails();
// });

// + Add Sketch Layer Button
const addSketchLayerButton = document.querySelector("#addSketchLayerButton");
addSketchLayerButton.addEventListener("click", function() {
  // Create a new empty sketch layer
  const newSketchLayer = createGraphics(
    canvasWidth,
    canvasHeight
  );
  newSketchLayer.clear();
  // Add it to the sketch layer arrays
  sketchLayers.push(newSketchLayer);
  sketchVisible.push(true);
  sketchOpacity.push(100);
  // Make the new layer the current sketch layer
  currentSketchLayer = sketchLayers.length - 1;
  // Reset Opacity UI
  const opacitySlider =
    document.querySelector("#opacitySlider");
  const opacityValue =
    document.querySelector(".opacityValue");
  if (opacitySlider && opacityValue) {
    opacitySlider.value = 100;
    opacityValue.textContent = "100%";
  }
  updateLayerThumbnails();
});

// + Add Color Layer Button
const addPaintLayerButton =
  document.querySelector("#addPaintLayerButton");

addPaintLayerButton.addEventListener("click", function() {

  // Create a new empty color layer
  const newPaintLayer = createGraphics(
    canvasWidth,
    canvasHeight
  );

  newPaintLayer.clear();

  // Add it to the paint layer array
  paintLayers.push(newPaintLayer);

  // Initialize visibility
  paintVisible.push(true);

  // Create a corresponding paint simulation
  const newPaintSimulation =
    createPaintSimulation(
      canvasWidth,
      canvasHeight
    );

  paintSimulations.push(newPaintSimulation);

  // Initialize lock and snapshot states
  paintLocked.push(false);
  paintLayerSnapshots.push(null);

  // Make the new layer the current paint layer
  currentPaintLayer = paintLayers.length - 1;

  // Update layer thumbnails and UI
  updateLayerThumbnails();

});

// =====================================
// PATTERN LIBRARY
// =====================================

// Add your patterns here
const patternLibrary = [
  {
    name: "Kawung",
    src: "images/PresetPatterns/Simplified Patterns 900x600/Simple Kawung 900x600.png"
  },
  {
    name: "Parang",
    src: "images/PresetPatterns/Simplified Patterns 900x600/Simple Parang 900x600.png"
  },
  {
    name: "Mega Mendung",
    src: "images/PresetPatterns/Simplified Patterns 900x600/Simple Mega Mendung 900x600.png"
  },
  {
    name: "Tujuh Rupa",
    src: "images/PresetPatterns/Simplified Patterns 900x600/Simple Tujuh Rupa 900x600.png"
  },
  {
    name: "Ikan Bali",
    src: "images/PresetPatterns/Simplified Patterns 900x600/Simple Ikan Bali 900x600.png"
  },
  {
    name: "Fuji",
    src: "images/PresetPatterns/Simplified Patterns 900x600/Simple Fuji 900x600.png"
  }
];

let selectedPattern = null;

// =====================================
// HTML ELEMENTS
// =====================================
const insertImageButton =
  document.querySelector("#insertImage");
const patternLibraryModal =
  document.querySelector("#patternLibraryModal");
const patternGrid =
  document.querySelector("#patternGrid");
const closePatternLibrary =
  document.querySelector("#closePatternLibrary");
const cancelPatternButton =
  document.querySelector("#cancelPatternButton");
const insertPatternButton =
  document.querySelector("#insertPatternButton");

// =====================================
// OPEN PATTERN LIBRARY
// =====================================
insertImageButton.addEventListener("click", function() {
  selectedPattern = null;
  insertPatternButton.disabled = true;
  renderPatternLibrary();

  isPatternLibraryOpen = true;
  patternLibraryModal.classList.add("active");
});

// =====================================
// DISPLAY PATTERNS
// =====================================
function renderPatternLibrary() {
  patternGrid.innerHTML = "";
  patternLibrary.forEach(function(pattern) {
    const card = document.createElement("div");
    card.classList.add("patternCard");
    const thumbnail = document.createElement("img");
    thumbnail.src = pattern.src;
    thumbnail.alt = pattern.name;
    const name = document.createElement("p");
    name.textContent = pattern.name;
    card.appendChild(thumbnail);
    card.appendChild(name);
    // Select pattern
    card.addEventListener("click", function() {
      // Remove previous selection
      document.querySelectorAll(".patternCard")
        .forEach(function(item) {
          item.classList.remove("selected");
        });
      // Highlight selected pattern
      card.classList.add("selected");
      selectedPattern = pattern;
      insertPatternButton.disabled = false;
    });
    patternGrid.appendChild(card);
  });
}

// =====================================
// CLOSE PATTERN LIBRARY
// =====================================

function closePatternLibraryModal() {
  patternLibraryModal.classList.remove("active");
  selectedPattern = null;
  insertPatternButton.disabled = true;

  isPatternLibraryOpen = false;
}

closePatternLibrary.addEventListener(
  "click",
  closePatternLibraryModal
);

cancelPatternButton.addEventListener(
  "click",
  closePatternLibraryModal
);


// =====================================
// INSERT SELECTED PATTERN
// =====================================
insertPatternButton.addEventListener("click", function() {
  if (!selectedPattern) {
    return;
  }
  const pattern = selectedPattern;
  ensureSketchLayer();
  loadImage(pattern.src, function(img) {
    const layer = sketchLayers[currentSketchLayer];
    // Clear existing sketch layer
    layer.clear();
    // Insert image
    layer.image(
      img,
      0,
      0,
      canvasWidth,
      canvasHeight
    );
    updateLayerThumbnails();
    closePatternLibraryModal();

  });
});

// Brush Strokes
function drawStroke(layer, strokeColor, size) {
  layer.stroke(strokeColor);
  layer.strokeWeight(size);
  layer.strokeCap(ROUND);
  layer.strokeJoin(ROUND);
  // Main wax line
  layer.line(
    prevArtX,
    prevArtY,
    artX,
    artY
  );
  // Very subtle irregularity
  if (size >= 2) {
    layer.strokeWeight(
      size * 0.35
    );
    layer.point(
      mouseX + random(-0.5, 0.5),
      mouseY + random(-0.5, 0.5)
    );
  }
}

// ---------------------------------------------------------
// Shared nozzle-layout logic (previously duplicated between
// drawCantingStroke and drawBrushCursor).
// ---------------------------------------------------------
function getNozzlePositions(nozzleType, spacing) {
  if (nozzleType === 1) {
    // ●
    return [{ x: 0, y: 0 }];
  }
  if (nozzleType === 2) {
    // ●
    // ●
    return [
      { x: 0, y: -spacing / 2 },
      { x: 0, y: spacing / 2 }
    ];
  }
  if (nozzleType === 3) {
    // ●
    // ●
    // ●
    return [
      { x: 0, y: -spacing },
      { x: 0, y: 0 },
      { x: 0, y: spacing }
    ];
  }
  if (nozzleType === 4) {
    //    ●
    //  ●   ●
    return [
      { x: 0, y: -spacing * 0.75 },
      { x: -spacing / 2, y: spacing * 0.5 },
      { x: spacing / 2, y: spacing * 0.5 }
    ];
  }
  return [];
}

// Wet Wax
function drawCantingStroke(
  layer,
  strokeColor,
  size,
  nozzleType
) {

  const sim =
    waxSimulations[currentWaxLayer];

  const spacing = size * 1.5;

  const dx = mouseX - pmouseX;
  const dy = mouseY - pmouseY;

  const distance =
    sqrt(dx * dx + dy * dy);

  let dirX = 1;
  let dirY = 0;

  if (distance > 0) {
    dirX = dx / distance;
    dirY = dy / distance;
  }

  const perpX = -dirY;
  const perpY = dirX;

  const nozzlePositions =
    getNozzlePositions(
      nozzleType,
      spacing
    );

  const amountMap = {
    3: 2,
    4: 5,
    5: 8,
    6: 11,
    7: 14
  };
  const radius = max(1, floor(size * 0.2));
  for (const nozzle of nozzlePositions) {
    const offsetX =
      dirX * nozzle.x +
      perpX * nozzle.y;
    const offsetY =
      dirY * nozzle.x +
      perpY * nozzle.y;
    const px =
      pmouseX + offsetX;
    const py =
      pmouseY + offsetY;
    const cx =
      mouseX + offsetX;
    const cy =
      mouseY + offsetY;
    const steps =
      max(1, floor(distance));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x =
        lerp(px, cx, t);
      const y =
        lerp(py, cy, t);
      const jitter =
        size * 0.02;
      depositWax(
        sim,
        x + random(-jitter, jitter),
        y + random(-jitter, jitter),
        strokeColor,
        random(
          amountMap[size] * 0.6,
          amountMap[size] * 1.2
        ),
        radius
      );
    }
  }
}

function createWaxSimulation(w, h) {
  return {
    width: w,
    height: h,
    paint: new Float32Array(w * h * 4),
    nextPaint: new Float32Array(w * h * 4),
    dry: new Float32Array(w * h),
    resistMask: new Uint8Array(w * h)
  };
}

function depositWax(sim, x, y, colorValue, amount, radius) {
  const centerX = x;
  const centerY = y;
  for (let ox = -radius; ox <= radius; ox++) {
    for (let oy = -radius; oy <= radius; oy++) {
      const distSq = ox * ox + oy * oy;
      if (distSq > radius * radius)
        continue;
      const px = floor(centerX + ox);
      const py = floor(centerY + oy);
      
      if (
        px < 0 ||
        py < 0 ||
        px >= sim.width ||
        py >= sim.height
      ) {
        continue;
      }
      const idx = (px + py * sim.width) * 4;
      const radiusSq = radius * radius + 0.5;
      const falloff =  max(0, 1 - distSq / radiusSq);

      sim.paint[idx + 0] =
        lerp(
          sim.paint[idx + 0],
          red(colorValue),
          0.5 * falloff
        );

      sim.paint[idx + 1] =
        lerp(
          sim.paint[idx + 1],
          green(colorValue),
          0.5 * falloff
        );

      sim.paint[idx + 2] =
        lerp(
          sim.paint[idx + 2],
          blue(colorValue),
          0.5 * falloff
        );

      sim.paint[idx + 3] +=
        amount * falloff;
    }
  }
}

function spreadWax(sim) {
  const src = sim.paint;
  const next = sim.nextPaint;
  next.set(src);
  const DRY_RATE = 0.03;
  const SPREAD_THRESHOLD = 5;

  for (let x = 1; x < sim.width - 1; x++) {

    for (let y = 1; y < sim.height - 1; y++) {

      const i =
        (x + y * sim.width) * 4;

      let wetness = src[i + 3];

      if (wetness > SPREAD_THRESHOLD) {
        spreadTo(src, next, i, i + 4, 0.15);
        spreadTo(src, next, i, i - 4, 0.15);

        spreadTo(src, next, i, i + sim.width * 4, 0.15);
        spreadTo(src, next, i, i - sim.width * 4, 0.15);

        spreadTo(src, next, i, i + sim.width * 4 + 4, 0.10);
        spreadTo(src, next, i, i + sim.width * 4 - 4, 0.10);
        spreadTo(src, next, i, i - sim.width * 4 + 4, 0.10);
        spreadTo(src, next, i, i - sim.width * 4 - 4, 0.10);
      }
      next[i + 3] -= DRY_RATE;
      if (next[i + 3] < 0) {
        next[i + 3] = 0;
      }
      if (
        wetness > 0 &&
        next[i + 3] === 0
      ) {
        const cell = x + y * sim.width;
        sim.dry[cell] = 255;
        // Permanently remember that wax existed here.
        sim.resistMask[cell] = 1;
      }
    }
  }
  const temp = sim.paint;
  sim.paint = sim.nextPaint;
  sim.nextPaint = temp;
}

function spreadTo(src, dst, source, target, transfer) {
  dst[target + 3] += transfer;
  dst[source + 3] -= transfer;
  dst[target + 0] =
    lerp(
      dst[target + 0],
      src[source + 0],
      0.25
    );
  dst[target + 1] =
    lerp(
      dst[target + 1],
      src[source + 1],
      0.25
    );
  dst[target + 2] =
    lerp(
      dst[target + 2],
      src[source + 2],
      0.25
    );
}

function renderWaxSimulation(sim, layer) {
  layer.clear();
  layer.loadPixels();
  for (let x = 0; x < sim.width; x++) {
    for (let y = 0; y < sim.height; y++) {
      const idx =
        (x + y * sim.width) * 4;
      const wetness = sim.paint[idx + 3];
      const dryWax =  sim.dry[x + y * sim.width];
      if (dryWax > 0) { //rgb(188, 157, 86)
        layer.pixels[idx + 0] = 188;
        layer.pixels[idx + 1] = 157;
        layer.pixels[idx + 2] = 86;
        layer.pixels[idx + 3] = 205;
      }
      else if (wetness > 0) {
        layer.pixels[idx + 0] =
          sim.paint[idx + 0];
        layer.pixels[idx + 1] =
          sim.paint[idx + 1];
        layer.pixels[idx + 2] =
          sim.paint[idx + 2];
        layer.pixels[idx + 3] = 220;
      }
    }
  }
  layer.updatePixels();
}

// Wet Paint
function depositPaint(
  sim,
  x,
  y,
  paintR,
  paintG,
  paintB,
  radius
) {

  const cx =
    paintX(
      sim,
      x
    );

  const cy =
    paintY(
      sim,
      y
    );

  // Convert display radius to simulation radius.
  const r =
    max(
      1,
      floor(radius)
    );

  const radiusSq = r * r;

  for (
    let oy = -r;
    oy <= r;
    oy++
  ) {

    const py =
      cy + oy;

    if (
      py < 0 ||
      py >= sim.height
    ) {
      continue;
    }

    for (
      let ox = -r;
      ox <= r;
      ox++
    ) {

      const px =
        cx + ox;

      if (
        px < 0 ||
        px >= sim.width
      ) {
        continue;
      }

      const distSq =
        ox * ox +
        oy * oy;

      if (
        distSq >
        radiusSq
      ) {
        continue;
      }

      const distance =
        sqrt(
          distSq
        ) / r;

      const falloff =
        pow(
          max(
            0,
            1 - distance
          ),
          1.5
        );


      const addedWetness =
        14 *
        falloff;


      if (
        addedWetness <= 0
      ) {
        continue;
      }

      const cell =
        px +
        py *
        sim.width;

      if (isWaxBlockingPaint(cell)) {
        continue;
      }

      markPaintDirty(
        sim,
        px,
        py
      );

      const idx =
        cell * 4;

      const oldWetness =
        sim.paint[
          idx + 3
        ];

      // ------------------------------------------------
      // New paint
      // ------------------------------------------------

      if (
        oldWetness <= 0.01
      ) {

        sim.paint[
          idx + 0
        ] =
          paintR;

        sim.paint[
          idx + 1
        ] =
          paintG;

        sim.paint[
          idx + 2
        ] =
          paintB;

      }

      // ------------------------------------------------
      // Mix with existing paint
      // Darker paint covers lighter paint more easily.
      // Lighter paint cannot easily cover darker paint.
      // ------------------------------------------------

      else {
        // Calculate perceived brightness
        const existingBrightness =
          0.299 * sim.paint[idx + 0] +
          0.587 * sim.paint[idx + 1] +
          0.114 * sim.paint[idx + 2];

        const incomingBrightness =
          0.299 * paintR +
          0.587 * paintG +
          0.114 * paintB;

        // Original wet-paint mixing strength
        const baseMix =
          addedWetness /
          (oldWetness + addedWetness);

        // Darker colors have more influence.
        // Lighter colors still blend, but more gently.
        const brightnessDifference =
          existingBrightness - incomingBrightness;

        const influence =
          constrain(
            1 + brightnessDifference / 200,
            0.15,
            1.75
          );

        const mix =
          min(0.95, baseMix * influence);

        sim.paint[idx + 0] =
          lerp(sim.paint[idx + 0], paintR, mix);

        sim.paint[idx + 1] =
          lerp(sim.paint[idx + 1], paintG, mix);

        sim.paint[idx + 2] =
          lerp(sim.paint[idx + 2], paintB, mix);
      }
      sim.paint[
        idx + 3
      ] +=
        addedWetness;


      // ------------------------------------------------
      // This cell needs simulation.
      // ------------------------------------------------

      activatePaintCell(
        sim,
        cell
      );
    }
  }

  // Wake the simulation.
  sim.active =
    true;

  sim.stillFrames =
    0;

  sim.sleepAfter =
    millis() +
    PAINT_SLEEP_TIMEOUT;
}

function drawPaintStroke(
  sim,
  strokeColor,
  radius
) {

  const dx =
    mouseX -
    pmouseX;

  const dy =
    mouseY -
    pmouseY;

  const distance =
    sqrt(
      dx * dx +
      dy * dy
    );


  // Instead of one stamp per pixel,
  // use one stamp every ~3 display pixels.
  const stampSpacing =
    max(
      1,
      radius * 0.5
    );

  const steps =
    max(
      1,
      ceil(
        distance /
        stampSpacing
      )
    );


  for (
    let i = 0;
    i <= steps;
    i++
  ) {

    const t =
      i / steps;

    const x =
      lerp(
        pmouseX,
        mouseX,
        t
      );

    const y =
      lerp(
        pmouseY,
        mouseY,
        t
      );

    depositPaint(
      sim,
      x,
      y,
      strokeColor.levels[0],
      strokeColor.levels[1],
      strokeColor.levels[2],
      radius
    );
  }
}

function spreadPaint(
  sim
) {

  if (
    !sim.active ||
    sim.activeCells.length === 0
  ) {

    sim.active =
      false;

    return;
  }


  // Safety timeout.
  if (
    millis() >
    sim.sleepAfter
  ) {

    sim.active =
      false;

    return;
  }


  sim.tick++;

  // Avoid an extremely unlikely
  // Uint32 overflow issue.
  if (
    sim.tick >=
    0xffffffff
  ) {

    sim.touched.fill(0);

    sim.tick = 1;
  }


  const src =
    sim.paint;

  const dst =
    sim.next;


  const current =
    sim.activeCells;

  const next =
    sim.nextCells;


  // Clear next queue.
  next.length = 0;


  // --------------------------------------------------
  // Diffusion strength.
  //
  // These preserve the wetter appearance you liked.
  // --------------------------------------------------

  const CORE_SPREAD =
    0.065;

  const EDGE_SPREAD =
    0.008;

  const DRY_RATE =
    0.045;


  let maxMovement =
    0;


  // --------------------------------------------------
  // Process ONLY active cells.
  // --------------------------------------------------

  for (
    let n = 0;
    n < current.length;
    n++
  ) {

    const cell =
      current[n];

    const idx =
      cell * 4;


    // This flag belongs to the old queue.
    sim.activeFlags[cell] =
      0;


    const wetness =
      src[idx + 3];


    if (
      wetness <=
      PAINT_SLEEP_WETNESS
    ) {
      continue;
    }


    // ------------------------------------------------
    // Wetness controls spreading.
    // ------------------------------------------------

    const wetFactor =
      constrain(
        (
          wetness -
          PAINT_SPREAD_THRESHOLD
        ) / 30,
        0,
        1
      );


    const spreadStrength =
      lerp(
        EDGE_SPREAD,
        CORE_SPREAD,
        wetFactor *
        wetFactor
      );


    const transfer =
      min(
        1.5,
        wetness *
        spreadStrength
      );


    const x =
      cell %
      sim.width;

    const y =
      floor(
        cell /
        sim.width
      );


    // ------------------------------------------------
    // Four directions.
    //
    // This is intentionally based on Steve's
    // four-direction diffusion rather than eight.
    // ------------------------------------------------

    if (
      x <
      sim.width - 1
    ) {

      diffusePaint(
        sim,
        cell,
        cell + 1,
        transfer * random(0.3, 1.5)
      );
    }


    if (
      x > 0
    ) {

      diffusePaint(
        sim,
        cell,
        cell - 1,
        transfer * random(0.3, 1.5)
      );
    }


    if (
      y <
      sim.height - 1
    ) {

      diffusePaint(
        sim,
        cell,
        cell + sim.width,
        transfer * random(0.3, 1.5)
      );
    }


    if (
      y > 0
    ) {

      diffusePaint(
        sim,
        cell,
        cell - sim.width,
        transfer * random(0.3, 1.5)
      );
    }


    // ------------------------------------------------
    // Initialize the source cell if diffusion
    // didn't already touch it.
    // ------------------------------------------------

    if (
      sim.touched[cell] !==
      sim.tick
    ) {

      sim.touched[cell] =
        sim.tick;

      dst[idx + 0] =
        src[idx + 0];

      dst[idx + 1] =
        src[idx + 1];

      dst[idx + 2] =
        src[idx + 2];

      dst[idx + 3] =
        src[idx + 3];
    }


    // ------------------------------------------------
    // Drying.
    // ------------------------------------------------

    dst[idx + 3] =
      max(
        0,
        dst[idx + 3] -
        DRY_RATE
      );
  }


  // --------------------------------------------------
  // Finalize touched cells.
  // --------------------------------------------------

  //
  // We need to inspect the cells touched by diffusion.
  // They are exactly the cells whose stamp equals tick.
  //
  // To avoid scanning the entire canvas, we use the
  // current active cells plus their four neighbors.
  //

  for (
    let n = 0;
    n < current.length;
    n++
  ) {

    const cell =
      current[n];

    finalizePaintCell(
      sim,
      cell
    );


    const x =
      cell %
      sim.width;

    const y =
      floor(
        cell /
        sim.width
      );


    if (
      x <
      sim.width - 1
    ) {
      finalizePaintCell(
        sim,
        cell + 1
      );
    }


    if (
      x > 0
    ) {
      finalizePaintCell(
        sim,
        cell - 1
      );
    }


    if (
      y <
      sim.height - 1
    ) {
      finalizePaintCell(
        sim,
        cell + sim.width
      );
    }


    if (
      y > 0
    ) {
      finalizePaintCell(
        sim,
        cell - sim.width
      );
    }
  }


  // --------------------------------------------------
  // Swap queues.
  // --------------------------------------------------

  sim.activeCells =
    next;

  sim.nextCells =
    current;


  // --------------------------------------------------
  // Determine whether the simulation should sleep.
  // --------------------------------------------------

  if (
    sim.activeCells.length === 0
  ) {

    sim.active =
      false;

    return;
  }


  // If the active queue becomes very small,
  // consider the paint settled.
  if (
    sim.activeCells.length <
    4
  ) {

    sim.stillFrames++;

  }
  else {

    sim.stillFrames =
      0;
  }


  if (
    sim.stillFrames >= 8
  ) {

    sim.active =
      false;

    return;
  }
}

function isWaxBlockingPaint(cell) {
  for (let w = 0; w < waxSimulations.length; w++) {
    const waxSim = waxSimulations[w];

    if (
      waxSim &&
      waxSim.resistMask[cell]
    ) {
      return true;
    }
  }

  return false;
}

function diffusePaint(
  sim,
  sourceCell,
  targetCell,
  requestedTransfer
) {
  const src =
    sim.paint;

  const dst =
    sim.next;


  const source =
    sourceCell * 4;

  const target =
    targetCell * 4;


  const sourceWet =
    src[source + 3];

  const targetWet =
    src[target + 3];

  // --------------------------------------------------
  // Wax blocks paint from spreading.
  // --------------------------------------------------

  if (
    isWaxBlockingPaint(sourceCell) ||
    isWaxBlockingPaint(targetCell)
  ) {
    return;
  }

  if (
    sourceWet <=
    PAINT_SPREAD_THRESHOLD
  ) {
    return;
  }


  const difference =
    sourceWet -
    targetWet;


  if (
    difference <= 0.5
  ) {
    return;
  }


  let transfer =
    requestedTransfer *
    constrain(
      difference / 25,
      0,
      1
    );


  transfer =
    min(
      transfer,
      sourceWet * 0.15
    );


  if (
    transfer <= 0.001
  ) {
    return;
  }

  const texture =
    fabricNoise[targetCell];

  transfer *= texture;
  

  // --------------------------------------------------
  // Initialize target in the reusable next buffer
  // the first time this tick touches it.
  // --------------------------------------------------

  if (
    sim.touched[targetCell] !==
    sim.tick
  ) {

    sim.touched[targetCell] =
      sim.tick;

    dst[target + 0] =
      src[target + 0];

    dst[target + 1] =
      src[target + 1];

    dst[target + 2] =
      src[target + 2];

    dst[target + 3] =
      src[target + 3];
  }


  // --------------------------------------------------
  // Initialize source as well.
  // --------------------------------------------------

  if (
    sim.touched[sourceCell] !==
    sim.tick
  ) {

    sim.touched[sourceCell] =
      sim.tick;

    dst[source + 0] =
      src[source + 0];

    dst[source + 1] =
      src[source + 1];

    dst[source + 2] =
      src[source + 2];

    dst[source + 3] =
      src[source + 3];
  }


  // --------------------------------------------------
  // Move wetness.
  // --------------------------------------------------

  dst[source + 3] -=
    transfer;

  dst[target + 3] +=
    transfer;

  markPaintDirty(
    sim,
    sourceCell % sim.width,
    floor(sourceCell / sim.width)
  );

  markPaintDirty(
    sim,
    targetCell % sim.width,
    floor(targetCell / sim.width)
  );

  // --------------------------------------------------
  // Empty destination receives source color.
  // --------------------------------------------------

  if (
    targetWet <= 0.01
  ) {

    dst[target + 0] =
      src[source + 0];

    dst[target + 1] =
      src[source + 1];

    dst[target + 2] =
      src[source + 2];

  }

  // --------------------------------------------------
  // Existing destination mixes.
  // --------------------------------------------------

  else {

    const mix =
      constrain(
        transfer /
        (
          targetWet +
          transfer
        ),
        0,
        1
      );


    dst[target + 0] =
      lerp(
        dst[target + 0],
        src[source + 0],
        mix
      );

    dst[target + 1] =
      lerp(
        dst[target + 1],
        src[source + 1],
        mix
      );

    dst[target + 2] =
      lerp(
        dst[target + 2],
        src[source + 2],
        mix
      );
  }
}

function createPaintSimulation(
  displayWidth,
  displayHeight
) {

  const simWidth =
    max(
      1,
      floor(
        displayWidth *
        PAINT_SIM_SCALE
      )
    );

  const simHeight =
    max(
      1,
      floor(
        displayHeight *
        PAINT_SIM_SCALE
      )
    );

  const cellCount =
    simWidth *
    simHeight;

  const bufferSize =
    cellCount * 4;

  const image =
    createImage(
      simWidth,
      simHeight
    );
  image.pixelDensity(1);

  return {

  // --------------------------------------------------
  // Simulation dimensions
  // --------------------------------------------------

  width:
    simWidth,

  height:
    simHeight,

  displayWidth:
    displayWidth,

  displayHeight:
    displayHeight,


  // --------------------------------------------------
  // Double buffers
  // --------------------------------------------------

  paint:
    new Float32Array(
      bufferSize
    ),

  next:
    new Float32Array(
      bufferSize
    ),

  // --------------------------------------------------
  // Permanent wax-resist mask
  //
  // 1 = paint has been permanently removed here
  // 0 = normal paint area
  // --------------------------------------------------

  resisted:
    new Uint8Array(
      cellCount
    ),

    // --------------------------------------------------
    // Stamp tracking
    //
    // This lets us initialize only cells touched
    // during the current simulation step.
    // --------------------------------------------------

    touched:
      new Uint32Array(
        cellCount
      ),

    tick:
      0,


    // --------------------------------------------------
    // Active-cell queue
    // --------------------------------------------------

    activeCells:
      [],

    nextCells:
      [],

    activeFlags:
      new Uint8Array(
        cellCount
      ),

    nextFlags:
      new Uint8Array(
        cellCount
      ),


    // --------------------------------------------------
    // Simulation state
    // --------------------------------------------------

    active:
      false,

    dirtyMinX: simWidth,
    dirtyMaxX: 0,

    dirtyMinY: simHeight,
    dirtyMaxY: 0,

    lastUpdate:
      0,

    sleepAfter:
      0,

    // Number of consecutive low-motion steps.
    stillFrames:
      0,


    // --------------------------------------------------
    // Rendering image
    // --------------------------------------------------

    image,
    hasDirtyPixels: false,
  };
}

// function applyWaxResistToPaint(
//   paintSim,
//   waxLayer
// ) {

//   if (
//     !paintSim ||
//     !waxLayer
//   ) {
//     return;
//   }

//   waxLayer.loadPixels();

//   const waxPixels =
//     waxLayer.pixels;
  
//   let resistedCount = 0;

//   for (
//     let y = 0;
//     y < paintSim.height;
//     y++
//   ) {

//     for (
//       let x = 0;
//       x < paintSim.width;
//       x++
//     ) {

//       const displayX =
//         floor(
//           x /
//           PAINT_SIM_SCALE
//         );

//       const displayY =
//         floor(
//           y /
//           PAINT_SIM_SCALE
//         );

//       const waxIndex =
//         (
//           displayX +
//           displayY *
//           waxLayer.width
//         ) * 4;

//       const waxAlpha =
//         waxPixels[
//           waxIndex + 3
//         ];

//       if (
//         waxAlpha > 0
//       ) {

//         resistedCount++;

//         const cell =
//           x +
//           y *
//           paintSim.width;

//         const paintIndex =
//           cell * 4;

//         // Permanently mark this area
//         // as having been resisted.
//         paintSim.resisted[cell] = 1;

//         // Permanently remove the existing
//         // simulated paint.
//         paintSim.paint[
//           paintIndex + 3
//         ] = 0;

//         markPaintDirty(
//           paintSim,
//           x,
//           y
//         );

//         paintSim.next[
//           paintIndex + 3
//         ] = 0;
//       }
//     }
//   }
//   paintSim.hasDirtyPixels = true;
// }

function renderPaintSimulation(
  sim,
  layer
) {

  if (!sim.hasDirtyPixels) {
    return;
  }

  const img =
    sim.image;

  img.loadPixels();

  const pixels =
    img.pixels;


  // --------------------------------------------------
  // The simulation image is only 450 × 300.
  // --------------------------------------------------

  for (
    let y = sim.dirtyMinY;
    y <= sim.dirtyMaxY;
    y++
  ) {

    for (
      let x = sim.dirtyMinX;
      x <= sim.dirtyMaxX;
      x++
    ) {

      const cell =
        x +
        y * sim.width;

      const i =
        cell * 4;

      const wetness =
        sim.paint[i + 3];

      if (
        sim.resisted[cell] ||
        wetness <= 0.01
      ) {

        pixels[i + 0] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0;

        continue;
      }

      pixels[i + 0] =
        sim.paint[i + 0];

      pixels[i + 1] =
        sim.paint[i + 1];

      pixels[i + 2] =
        sim.paint[i + 2];

      const normalized =
        wetness < 30
          ? wetness / 30
          : 1;

      pixels[i + 3] =
        255 *
        normalized *
        normalized *
        normalized;
    }
  }

  img.updatePixels();

  sim.dirtyMinX =
    sim.width;

  sim.dirtyMaxX =
    0;

  sim.dirtyMinY =
    sim.height;

  sim.dirtyMaxY =
    0;

  // --------------------------------------------------
  // Draw the low-resolution simulation to the
  // existing 900 × 600 paint layer.
  // --------------------------------------------------

  layer.clear();
  layer.noSmooth();
  layer.image(
    img,
    0,
    0,
    sim.displayWidth,
    sim.displayHeight
  );
  sim.hasDirtyPixels = false;
}

function expandPaintBounds(
  sim,
  x,
  y,
  radius
) {

  const padding =
    radius + 2;

  const minX =
    max(
      0,
      floor(x - padding)
    );

  const maxX =
    min(
      sim.width - 1,
      ceil(x + padding)
    );

  const minY =
    max(
      0,
      floor(y - padding)
    );

  const maxY =
    min(
      sim.height - 1,
      ceil(y + padding)
    );

  if (minX < sim.minX)
    sim.minX = minX;

  if (maxX > sim.maxX)
    sim.maxX = maxX;

  if (minY < sim.minY)
    sim.minY = minY;

  if (maxY > sim.maxY)
    sim.maxY = maxY;
}

function updatePaintSimulations() {

  const now =
    millis();


  for (
    let i = 0;
    i < paintSimulations.length;
    i++
  ) {

    const sim =
      paintSimulations[i];


    if (
      !sim ||
      !sim.active
    ) {
      continue;
    }


    if (
      now -
      sim.lastUpdate <
      PAINT_UPDATE_INTERVAL
    ) {
      continue;
    }


    sim.lastUpdate =
      now;


    spreadPaint(
      sim
    );


    if (
      paintLayers[i]
    ) {

      renderPaintSimulation(
        sim,
        paintLayers[i]
      );
    }
  }
}

function paintX(sim, x) {
  return constrain(
    floor(x),
    0,
    sim.width - 1
  );
}

function paintY(sim, y) {
  return constrain(
    floor(y),
    0,
    sim.height - 1
  );
}

function activatePaintCell(
  sim,
  cell
) {

  if (
    sim.activeFlags[cell]
  ) {
    return;
  }

  sim.activeFlags[cell] = 1;

  sim.activeCells.push(
    cell
  );
}

function activatePaintCellNext(
  sim,
  cell
) {

  if (
    sim.nextFlags[cell]
  ) {
    return;
  }

  sim.nextFlags[cell] = 1;

  sim.nextCells.push(
    cell
  );
}

function finalizePaintCell(
  sim,
  cell
) {

  if (
    cell < 0 ||
    cell >=
      sim.width *
      sim.height
  ) {
    return;
  }


  if (
    sim.touched[cell] !==
    sim.tick
  ) {
    return;
  }


  const idx =
    cell * 4;


  const wetness =
    sim.next[
      idx + 3
    ];


  // --------------------------------------------------
  // Copy from next → current.
  // --------------------------------------------------

  sim.paint[
    idx + 0
  ] =
    sim.next[
      idx + 0
    ];

  sim.paint[
    idx + 1
  ] =
    sim.next[
      idx + 1
    ];

  sim.paint[
    idx + 2
  ] =
    sim.next[
      idx + 2
    ];

  sim.paint[
    idx + 3
  ] =
    wetness;


  // --------------------------------------------------
  // Only continue simulating cells that are still wet.
  // --------------------------------------------------

  if (
    wetness >
    PAINT_SLEEP_WETNESS
  ) {

    activatePaintCellNext(
      sim,
      cell
    );
  }
}

function markPaintDirty(sim, x, y) {
  sim.hasDirtyPixels = true;
  if (x < sim.dirtyMinX)
    sim.dirtyMinX = x;
  if (x > sim.dirtyMaxX)
    sim.dirtyMaxX = x;
  if (y < sim.dirtyMinY)
    sim.dirtyMinY = y;
  if (y > sim.dirtyMaxY)
    sim.dirtyMaxY = y;
}

// Erase strokes
function eraseStroke(layer, size) {
  const ctx = layer.drawingContext;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  layer.strokeWeight(size);
  layer.strokeCap(ROUND);
  layer.stroke(255);
  layer.line(
    prevArtX,
    prevArtY,
    artX,
    artY
  );
  ctx.restore();
}

function isInsideCanvas() {
  return (
    mouseX >= 0 &&
    mouseX <= width &&
    mouseY >= 0 &&
    mouseY <= height
  );
}

function updateArtworkCoordinates() {
  prevArtX = artX;
  prevArtY = artY;

  artX = mouseX;
  artY = mouseY;
}

// Adding Layers System
function updateWaxLayersUI() {
  const container = document.querySelector("#waxLayersContainer");
  // Clear current UI
  container.innerHTML = "";
  // Show newest layer first
  for (let i = waxLayers.length - 1; i >= 0; i--) {
    // Main layer row
    const layerRow = document.createElement("div");
    layerRow.classList.add("layers");
    // -------------------------
    // Eye / Lock button
    // -------------------------
    const layerButton = document.createElement("button");
    layerButton.classList.add("viewLayer");
    const layerIcon = document.createElement("img");
    if (waxLocked[i]) {
      // Locked layer
      layerIcon.src = "images/LockIcon.png";
    } else {
      // Current editable layer
      if (waxVisible) {
        layerIcon.src = "images/OpenEyeIcon.png";
      } else {
        layerIcon.src = "images/ClosedEyeIcon.png";
      }
      // Allow visibility toggle only for current layer
      layerButton.addEventListener("click", function() {
        waxVisible = !waxVisible;
        updateWaxLayersUI();
      });
    }
    layerButton.appendChild(layerIcon);
    // -------------------------
    // Thumbnail
    // -------------------------
    const thumbnail = document.createElement("div");
    thumbnail.classList.add("layerThumbnail");
    const thumbnailImage = document.createElement("img");
    if (waxLocked[i] && waxLayerSnapshots[i]) {
      // Show the saved snapshot for completed wax layers
      thumbnailImage.src = waxLayerSnapshots[i].canvas.toDataURL();
    } else {
      // Show the current editable layer
      thumbnailImage.src = waxLayers[i].canvas.toDataURL();
    }
    thumbnail.appendChild(thumbnailImage);
    // -------------------------
    // Assemble layer
    // -------------------------
    layerRow.appendChild(layerButton);
    layerRow.appendChild(thumbnail);

    // Grey out locked layers
    if (waxLocked[i]) {
      layerRow.style.opacity = "0.45";
    }
    container.appendChild(layerRow);
  }
}

function layerHasContent(layer) {
  layer.loadPixels();
  for (let i = 3; i < layer.pixels.length; i += 4) {
    if (layer.pixels[i] > 0) {
      return true;
    }
  }
  return false;
}

function updateLayerButtons() {
  const removeWaxButton = document.querySelector("#removeWaxButton");
  // const fixColorButton = document.querySelector("#fixColorButton");
  // Wax
  if (
    waxLayers.length === 0 ||
    !waxLayers[currentWaxLayer]
  ) {
    removeWaxButton.disabled = true;
  } else {
    removeWaxButton.disabled =
      !layerHasContent(waxLayers[currentWaxLayer]);
  }
  // // Paint
  // if (
  //   paintLayers.length === 0 ||
  //   !paintLayers[currentPaintLayer]
  // ) {
  //   fixColorButton.disabled = true;
  // } else {
  //   fixColorButton.disabled =
  //     !layerHasContent(paintLayers[currentPaintLayer]);
  // }
}

function updatePaintLayersUI() {
  const container =
    document.querySelector("#paintLayersContainer");

  // Clear current UI
  container.innerHTML = "";

  // Show newest layer first
  for (let i = paintLayers.length - 1; i >= 0; i--) {

    // Main layer row
    const layerRow = document.createElement("div");
    layerRow.classList.add("layers");

    // Highlight currently selected layer
    if (i === currentPaintLayer) {
      layerRow.classList.add("selectedLayer");
    }

    // -------------------------
    // Eye / visibility button
    // -------------------------
    const layerButton = document.createElement("button");
    layerButton.classList.add("viewLayer");

    const layerIcon = document.createElement("img");

    if (paintVisible[i]) {
      layerIcon.src = "images/OpenEyeIcon.png";
    } else {
      layerIcon.src = "images/ClosedEyeIcon.png";
    }

    layerButton.appendChild(layerIcon);

    // Toggle individual layer visibility
    layerButton.addEventListener("click", function(event) {
      event.stopPropagation();

      paintVisible[i] = !paintVisible[i];

      updatePaintLayersUI();
    });

    // -------------------------
    // Thumbnail
    // -------------------------
    const thumbnail = document.createElement("div");
    thumbnail.classList.add("layerThumbnail");

    const thumbnailImage = document.createElement("img");

    thumbnailImage.src =
      paintLayers[i].canvas.toDataURL();

    thumbnail.appendChild(thumbnailImage);

    // -------------------------
    // Assemble layer row
    // -------------------------
    layerRow.appendChild(layerButton);
    layerRow.appendChild(thumbnail);

    // -------------------------
    // Select layer
    // -------------------------
    layerRow.addEventListener("click", function() {
      currentPaintLayer = i;
      updatePaintLayersUI();
    });

    container.appendChild(layerRow);
  }
}

// Thumbnail Functions
function updateLayerThumbnails() {
  updateWaxLayersUI();
  updatePaintLayersUI();
  updateSketchLayersUI();
  updateLayerButtons();
}

function updateThumbnail(sourceLayer, thumbnailID) {
  const thumbnail = document.getElementById(thumbnailID);
  thumbnail.innerHTML = "";
  const img = document.createElement("img");
  img.src = sourceLayer.canvas.toDataURL();
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  thumbnail.appendChild(img);
}

function updateSketchLayersUI() {
  const container = document.querySelector("#sketchLayersContainer");
  // Clear current UI
  container.innerHTML = "";
  // Show newest layer first
  for (let i = sketchLayers.length - 1; i >= 0; i--) {
    // Main layer row
    const layerRow = document.createElement("div");
    layerRow.classList.add("layers");
    // Highlight currently selected layer
    if (i === currentSketchLayer) {
      layerRow.classList.add("selectedLayer");
    }
    // -------------------------
    // Eye / visibility button
    // -------------------------
    const layerButton = document.createElement("button");
    layerButton.classList.add("viewLayer");
    const layerIcon = document.createElement("img");
    if (sketchVisible[i]) {
      layerIcon.src = "images/OpenEyeIcon.png";
    } else {
      layerIcon.src = "images/ClosedEyeIcon.png";
    }
    layerButton.appendChild(layerIcon);
    // Toggle visibility
    layerButton.addEventListener("click", function(event) {
      event.stopPropagation();
      sketchVisible[i] = !sketchVisible[i];
      updateSketchLayersUI();
    });
    // -------------------------
    // Thumbnail
    // -------------------------
    const thumbnail = document.createElement("div");
    thumbnail.classList.add("layerThumbnail");
    const thumbnailImage = document.createElement("img");
    thumbnailImage.src = sketchLayers[i].canvas.toDataURL();
    thumbnail.appendChild(thumbnailImage);
    // -------------------------
    // Assemble layer row
    // -------------------------
    layerRow.appendChild(layerButton);
    layerRow.appendChild(thumbnail);
    // -------------------------
    // Select layer
    // -------------------------
    layerRow.addEventListener("click", function() {
      currentSketchLayer = i;
      // Update opacity slider to match selected layer
      const opacitySlider = document.querySelector("#opacitySlider");
      const opacityValue = document.querySelector(".opacityValue");
      if (opacitySlider && opacityValue) {
        opacitySlider.value = sketchOpacity[currentSketchLayer];
        opacityValue.textContent =
          `${sketchOpacity[currentSketchLayer]}%`;
      }
      updateSketchLayersUI();
    });
    container.appendChild(layerRow);
  }
}

//
// Javascript to HTML code
//

// Button Select effect
// Tool Buttons
const tools = document.querySelectorAll(".tool");
tools.forEach(tool => {
  tool.addEventListener("click", () => {
    // Remove selected from all tools
    tools.forEach(tool => {
      tool.classList.remove("selected");
    });
    // Add selected to the clicked tool
    tool.classList.add("selected");
    // Tell p5.js which tool is currently active
    currentTool = tool.id;
  });
});

// Nozzle Type Buttons
const nozzleButtons = document.querySelectorAll(".nozzleType");
const cantingToolImage = document.getElementById("canting1");

nozzleButtons.forEach(button => {
  button.addEventListener("click", () => {
    // Change selected button
    nozzleButtons.forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");
    // Get the image inside the button
    const nozzleImage = button.querySelector("img");
    // Get the number from the image ID
    const nozzleNumber =
      Number(nozzleImage.id.replace("nozzleType", ""));
    // Store the selected nozzle type
    currentNozzleType = nozzleNumber;
    // Change Canting image
    cantingToolImage.src =
      `images/CantingTool${nozzleNumber}.png`;
  });
});

// Tool property windows
const pencilTool = document.querySelector("#pencilTool");
const eraserTool = document.querySelector("#eraserTool");
const cantingTool = document.querySelector("#cantingTool");
const paintDabberTool = document.querySelector("#paintDabberTool");

const pencilProperties = document.querySelector("#pencilProperties");
const eraserProperties = document.querySelector("#eraserProperties");
const cantingProperties = document.querySelector("#cantingProperties");
const paintDabberProperties = document.querySelector("#paintDabberProperties");

function hideAllProperties() {
  pencilProperties.style.display = "none";
  eraserProperties.style.display = "none";
  cantingProperties.style.display = "none";
  paintDabberProperties.style.display = "none";
}

pencilTool.addEventListener("click", function() {
  hideAllProperties();
  pencilProperties.style.display = "block";
});

eraserTool.addEventListener("click", function() {
  hideAllProperties();
  eraserProperties.style.display = "block";
});

cantingTool.addEventListener("click", function() {
  hideAllProperties();
  cantingProperties.style.display = "block";
});

paintDabberTool.addEventListener("click", function() {
  hideAllProperties();
  paintDabberProperties.style.display = "block";
});

// Brush Size Sliders
const sliders = document.querySelectorAll(".brushSize");
sliders.forEach(function(slider) {
  const valueDisplay = slider.nextElementSibling;
  slider.addEventListener("input", function() {
    valueDisplay.textContent = this.value;
  });
});

function getCurrentBrushSize() {
  const slider = sliderRefs[currentTool];
  return slider ? Number(slider.value) : 10;
}

function getCantingSize() {
  const slider = sliderRefs.cantingTool;
  if (!slider) return 2;
  const sizeMap = {
    1: 3,
    2: 4,
    3: 5,
    4: 6,
    5: 7
  };
  return sizeMap[Number(slider.value)];
}

// Brush Cursor
function drawBrushCursor() {
  if (!showBrushCursor || !isInsideCanvas()) {
    return;
  }
  const size =
  currentTool === "cantingTool"
    ? getCantingSize()
    : getCurrentBrushSize();
  push();
  noFill();
  stroke(0);
  strokeWeight(1);
  // Non-canting tools use a normal circular cursor
  if (currentTool !== "cantingTool") {
    circle(mouseX, mouseY, size);
    pop();
    return;
  }
  // Calculate the direction of mouse movement
  const dx = mouseX - pmouseX;
  const dy = mouseY - pmouseY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // Only change the angle when the mouse is actually moving.
  // Rotate only while actively drawing
  if (mouseIsPressed && distance > 0.1) {
    cantingCursorAngle = Math.atan2(dy, dx);
    wasDrawing = true;
  }
  // Reset rotation when the stroke finishes
  if (!mouseIsPressed && wasDrawing) {
    cantingCursorAngle = 0;
    wasDrawing = false;
  }
  // Distance between nozzle openings
  const spacing = size * 1.5;
  // Nozzle layouts (shared with drawCantingStroke)
  const nozzlePositions = getNozzlePositions(currentNozzleType, spacing);
  // Rotate the entire nozzle pattern
  translate(mouseX, mouseY);
  rotate(cantingCursorAngle);
  // Draw each nozzle
  for (const nozzle of nozzlePositions) {
    circle(
      nozzle.x,
      nozzle.y,
      size
    );
  }
  pop();
}

// Sketch Layer Opacity Slider
const opacitySlider = document.querySelector("#opacitySlider");
const opacityValue = document.querySelector(".opacityValue");
opacitySlider.addEventListener("input", function() {
  // Make sure a sketch layer exists
  if (
    sketchLayers.length === 0 ||
    !sketchLayers[currentSketchLayer]
  ) {
    return;
  }
  // Get slider value
  const opacity = Number(this.value);
  // Store opacity for the current sketch layer
  sketchOpacity[currentSketchLayer] = opacity;
  // Update displayed percentage
  opacityValue.textContent = `${opacity}%`;
  // Redraw UI
  updateLayerThumbnails();
});

// Color Picker
const colorPicker = document.querySelector("#colorPicker");
colorPicker.addEventListener("input", function() {
  paintColor = this.value;
});
