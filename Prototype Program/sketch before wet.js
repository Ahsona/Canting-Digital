//
// p5.js code
//

let bgImage = null;        // the uploaded reference photo (starts empty)
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
let paintVisible = true;
let sketchVisible = [];
let sketchOpacity = [];

let currentWaxLayer = 0;
let currentPaintLayer = 0;
let currentSketchLayer = 0;

let canvasWidth = 900;
let canvasHeight = 600;

// ---------------------------------------------------------
// PERFORMANCE: cached slider elements instead of querying
// the DOM every single frame inside draw()/getCurrentBrushSize()
// ---------------------------------------------------------
const sliderRefs = {
  pencilTool: document.querySelector("#pencilSizeSlider"),
  eraserTool: document.querySelector("#eraserSizeSlider"),
  cantingTool: document.querySelector("#cantingSizeSlider"),
  paintDabberTool: document.querySelector("#paintDabberSizeSlider"),
};

// ---------------------------------------------------------
// PERFORMANCE: thumbnail/DOM refresh is expensive
// (toDataURL() per layer + full DOM rebuild + pixel scan),
// so instead of calling updateLayerThumbnails() every frame
// while the mouse is down, we flag that it's needed and only
// actually do the work every few frames, with a guaranteed
// final refresh when the stroke ends.
// ---------------------------------------------------------
let needsThumbnailUpdate = false;
const THUMBNAIL_UPDATE_INTERVAL = 8; // frames

function requestThumbnailUpdate() {
  needsThumbnailUpdate = true;
}

function setup() {
  let canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("canvasContainer");
  canvas.mouseOver(() => {
    showBrushCursor = true;
  });
  canvas.mouseOut(() => {
    showBrushCursor = false;
  });
  // Start with NO layers.
  // Layers will be created only when they are actually needed.
  updateLayerThumbnails();
}

function ensureWaxLayer() {
  if (waxLayers.length === 0) {
    const newWaxLayer = createGraphics(canvasWidth, canvasHeight);
    newWaxLayer.clear();
    waxLayers.push(newWaxLayer);
    waxLocked.push(false);
    waxLayerSnapshots.push(null);
    currentWaxLayer = 0;
    console.log("Created first wax layer");
    updateLayerThumbnails();
  }
}

function ensurePaintLayer() {
  if (paintLayers.length === 0) {
    const newPaintLayer = createGraphics(canvasWidth, canvasHeight);
    newPaintLayer.clear();
    paintLayers.push(newPaintLayer);
    paintLocked.push(false);
    paintLayerSnapshots.push(null);
    // Create watercolor simulation for this layer
    currentPaintLayer = 0;
    console.log("Created first paint layer");
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
    console.log("Created first sketch layer");
    updateLayerThumbnails();
  }
}

function draw() {
  // Base cloth
  background("#dddddd");
  // Draw with currently selected tool
  if (mouseIsPressed && isInsideCanvas() && touches.length <= 1) {
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
            color("#b28b30"),
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
      if (!paintLocked[currentPaintLayer]) {
        activeLayer = paintLayers[currentPaintLayer];
        const slider = sliderRefs.paintDabberTool;
        if (slider) {
          const size = Number(slider.value);
          drawStroke(
            activeLayer,
            color(paintColor),
            size
          );
          requestThumbnailUpdate();
        }
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
  // Wax acts as a resist
  if (
    waxLayers.length > 0 &&
    paintLayers.length > 0 &&
    waxLayers[currentWaxLayer] &&
    paintLayers[currentPaintLayer]
  ) {
    paintLayers[currentPaintLayer].drawingContext.save();
    paintLayers[currentPaintLayer].drawingContext.globalCompositeOperation =
      "destination-out";
    paintLayers[currentPaintLayer].image(
      waxLayers[currentWaxLayer],
      0,
      0
    );
    paintLayers[currentPaintLayer].drawingContext.restore();
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
  // Composite PAINT layers
  if (paintVisible) {
    for (let i = 0; i < paintLayers.length; i++) {
      image(paintLayers[i], 0, 0);
    }
  }
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
removeWaxButton.addEventListener("click", function() {
  // Make sure a wax layer actually exists
  if (
    waxLayers.length === 0 ||
    !waxLayers[currentWaxLayer]
  ) {
    return;
  }
  // Save a snapshot of the current wax BEFORE clearing it
  waxLayerSnapshots[currentWaxLayer] =
    waxLayers[currentWaxLayer].get();
  // Lock the current wax layer
  waxLocked[currentWaxLayer] = true;
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
  // Make the new layer current
  currentWaxLayer = waxLayers.length - 1;
  console.log("Wax removed!");
  console.log(
    "New current wax layer:",
    currentWaxLayer + 1
  );
  updateLayerThumbnails();
});

// Fix Color Button
const fixColorButton = document.querySelector("#fixColorButton");
fixColorButton.addEventListener("click", function() {
  // Make sure a paint layer actually exists
  if (
    paintLayers.length === 0 ||
    !paintLayers[currentPaintLayer]
  ) {
    return;
  }
  // Save a snapshot BEFORE creating the new layer
  paintLayerSnapshots[currentPaintLayer] =
    paintLayers[currentPaintLayer].get();
  // Lock the current color layer
  paintLocked[currentPaintLayer] = true;
  // Create a new empty color layer
  const newPaintLayer = createGraphics(
    canvasWidth,
    canvasHeight
  );
  newPaintLayer.clear();
  // Add the new layer
  paintLayers.push(newPaintLayer);
  // New layer is editable
  paintLocked.push(false);
  // New layer has no snapshot yet
  paintLayerSnapshots.push(null);
  // Make the new layer current
  currentPaintLayer = paintLayers.length - 1;
  console.log("Color fixed!");
  console.log(
    "New current paint layer:",
    currentPaintLayer + 1
  );
  updateLayerThumbnails();
});

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
  console.log("New sketch layer created!");
  console.log(
    "Current sketch layer:",
    currentSketchLayer + 1
  );
  updateLayerThumbnails();
});

// Insert Image Button
const insertImageButton = document.querySelector("#insertImage");
const imageInput = document.querySelector("#imageInput");
insertImageButton.addEventListener("click", function() {
  imageInput.click();
});

// When an image is selected
imageInput.addEventListener("change", function(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  ensureSketchLayer();
  const imageURL = URL.createObjectURL(file);
  loadImage(imageURL, function(img) {
    const layer = sketchLayers[currentSketchLayer];
    layer.clear();
    layer.image(
      img,
      0,
      0,
      canvasWidth,
      canvasHeight
    );
    updateLayerThumbnails();
    URL.revokeObjectURL(imageURL);
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
    pmouseX,
    pmouseY,
    mouseX,
    mouseY
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

function drawCantingStroke(layer, strokeColor, size, nozzleType) {
  layer.stroke(strokeColor);
  layer.strokeWeight(size);
  layer.strokeCap(ROUND);
  layer.strokeJoin(ROUND);
  // Distance between nozzle openings
  const spacing = size * 1.5;
  // Direction of mouse movement
  const dx = mouseX - pmouseX;
  const dy = mouseY - pmouseY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // Direction of the stroke
  let dirX = 1;
  let dirY = 0;
  if (distance > 0) {
    dirX = dx / distance;
    dirY = dy / distance;
  }
  // Direction perpendicular to the stroke
  const perpX = -dirY;
  const perpY = dirX;
  // Nozzle layout (x = along the stroke, y = perpendicular to it)
  const nozzlePositions = getNozzlePositions(nozzleType, spacing);
  // Draw one continuous line for EACH nozzle
  for (const nozzle of nozzlePositions) {
    // Convert the nozzle's local position into canvas coordinates.
    const offsetX = dirX * nozzle.x + perpX * nozzle.y;
    const offsetY = dirY * nozzle.x + perpY * nozzle.y;
    // Previous / current mouse position
    const previousX = pmouseX + offsetX;
    const previousY = pmouseY + offsetY;
    const currentX = mouseX + offsetX;
    const currentY = mouseY + offsetY;
    // Draw continuous stroke
    layer.line(
      previousX,
      previousY,
      currentX,
      currentY
    );
  }
}

function eraseStroke(layer, size) {
  const ctx = layer.drawingContext;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  layer.strokeWeight(size);
  layer.strokeCap(ROUND);
  layer.stroke(255);
  layer.line(
    pmouseX,
    pmouseY,
    mouseX,
    mouseY
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
  const fixColorButton = document.querySelector("#fixColorButton");
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
  // Paint
  if (
    paintLayers.length === 0 ||
    !paintLayers[currentPaintLayer]
  ) {
    fixColorButton.disabled = true;
  } else {
    fixColorButton.disabled =
      !layerHasContent(paintLayers[currentPaintLayer]);
  }
}

function updatePaintLayersUI() {
  const container = document.querySelector("#paintLayersContainer");
  // Clear current UI
  container.innerHTML = "";
  // Show newest layer first
  for (let i = paintLayers.length - 1; i >= 0; i--) {
    // Main layer row
    const layerRow = document.createElement("div");
    layerRow.classList.add("layers");
    // Eye / Lock button
    const layerButton = document.createElement("button");
    layerButton.classList.add("viewLayer");
    const layerIcon = document.createElement("img");
    if (paintLocked[i]) {
      // Locked layer
      layerIcon.src = "images/LockIcon.png";
    } else {
      // Current editable layer
      if (paintVisible) {
        layerIcon.src = "images/OpenEyeIcon.png";
      } else {
        layerIcon.src = "images/ClosedEyeIcon.png";
      }
      // Only editable layer can toggle visibility
      layerButton.addEventListener("click", function() {
        paintVisible = !paintVisible;
        updatePaintLayersUI();
      });
    }
    layerButton.appendChild(layerIcon);
    // Thumbnail
    const thumbnail = document.createElement("div");
    thumbnail.classList.add("layerThumbnail");
    const thumbnailImage = document.createElement("img");
    if (paintLocked[i] && paintLayerSnapshots[i]) {
      // Historical/fixed color
      thumbnailImage.src =
        paintLayerSnapshots[i].canvas.toDataURL();
    } else {
      // Current editable color layer
      thumbnailImage.src =
        paintLayers[i].canvas.toDataURL();
    }
    thumbnail.appendChild(thumbnailImage);
    // Assemble layer
    layerRow.appendChild(layerButton);
    layerRow.appendChild(thumbnail);
    // Grey out locked layers
    if (paintLocked[i]) {
      layerRow.style.opacity = "0.45";
    }
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
      console.log(
        "Selected sketch layer:",
        currentSketchLayer + 1
      );
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
    console.log("Selected nozzle type:", currentNozzleType);
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
  console.log(
    "Sketch layer:",
    currentSketchLayer + 1,
    "Opacity:",
    opacity + "%"
  );
});

// Color Picker
const colorPicker = document.querySelector("#colorPicker");
colorPicker.addEventListener("input", function() {
  paintColor = this.value;
  console.log("Paint color changed to:", paintColor);
});