/* ─────────────────────────────────────────
   Remove X3DOM built-in nav UI
───────────────────────────────────────── */
(function removeX3domUI() {
  const selectors = ['#x3dom-navi', '.x3dom-navi', '.x3dom-progress', '.x3dom-logContainer'];
  function clean() {
    selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
  }
  // Run immediately and again after X3DOM finishes loading
  clean();
  document.addEventListener('DOMContentLoaded', clean);
  window.addEventListener('load', clean);
  // MutationObserver catches anything inserted later
  new MutationObserver(clean).observe(document.body, { childList: true, subtree: true });
})();

/* ─────────────────────────────────────────
   Model bottom feature lights
───────────────────────────────────────── */
let activeDimensionFeature = null;

function setActiveDimensionFeature(feature) {
  activeDimensionFeature = feature;
  document.querySelectorAll('.feature-light').forEach(light => {
    light.classList.toggle('is-active', light.dataset.feature === feature);
  });
}

function isDimensionFeatureVisible(feature) {
  const featureElementIds = {
    'unit-grid': 'unit-cube-grid',
    'axis-markers': 'xyz-axis-markers',
    'ground-projection': 'ground-projection',
    'ground-projection-copy': 'ground-projection-copy',
  };

  return feature === 'feature-five' ? activeDimensionFeature === feature : !!document.getElementById(featureElementIds[feature]);
}

function clearDimensionFeatures() {
  ['unit-cube-grid', 'xyz-axis-markers', 'ground-projection', 'ground-projection-copy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  clearSectionVisibility();
  setGroundProjectionSelected(false);
  setGroundProjectionHovered(false);
  setGroundProjectionCopySelected(false);
  setGroundProjectionCopyHovered(false);
  setActiveDimensionFeature(null);
}

function activateDimensionFeature(feature) {
  if (feature === 'unit-grid') toggleUnitGrid();
  if (feature === 'axis-markers') toggleAxisMarkers();
  if (feature === 'ground-projection') toggleGroundProjection();
  if (feature === 'ground-projection-copy') toggleGroundProjectionCopy();
  if (feature === 'feature-five' && window.x3dom) x3dom.reload();
  setActiveDimensionFeature(feature);
}

(function initFeatureLights() {
  const bar = document.getElementById('model-bottom-bar');
  const lights = document.getElementById('feature-lights');
  if (!bar || !lights) return;

  function setOpen(open) {
    lights.classList.toggle('is-open', open);
    lights.setAttribute('aria-hidden', String(!open));
    bar.setAttribute('aria-expanded', String(open));
  }

  function toggleLights(e) {
    e.stopPropagation();
    setOpen(!lights.classList.contains('is-open'));
  }

  function handleFeature(e) {
    const light = e.target.closest('.feature-light');
    const feature = light && light.dataset.feature;
    if (!feature) return;
    e.stopPropagation();

    const wasActive = activeDimensionFeature === feature || isDimensionFeatureVisible(feature);
    clearDimensionFeatures();

    if (!wasActive) {
      activateDimensionFeature(feature);
    } else if (window.x3dom) {
      x3dom.reload();
    }
  }

  function handleFeatureKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const light = e.target.closest('.feature-light');
    if (!light) return;
    e.preventDefault();
    handleFeature(e);
  }

  bar.addEventListener('click', toggleLights);
  bar.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggleLights(e);
  });

  lights.addEventListener('click', e => e.stopPropagation());
  lights.addEventListener('click', handleFeature);
  lights.addEventListener('keydown', handleFeatureKey);
  document.addEventListener('click', () => setOpen(false));
})();

function toggleUnitGrid() {
  const existing = document.getElementById('unit-cube-grid');
  if (existing) {
    existing.remove();
    if (window.x3dom) x3dom.reload();
    return;
  }

  const scene = document.querySelector('scene');
  if (!scene) return;

  const cells = 5;
  const cellSize = 2.4;
  const half = (cells * cellSize) / 2;
  const points = [];
  const pointIndex = new Map();
  const segments = [];

  function getPointIndex(x, y, z) {
    const key = `${x},${y},${z}`;
    if (!pointIndex.has(key)) {
      pointIndex.set(key, points.length);
      points.push(`${x * cellSize - half} ${y * cellSize} ${z * cellSize - half}`);
    }
    return pointIndex.get(key);
  }

  function addSegment(a, b) {
    segments.push(`${a} ${b} -1`);
  }

  for (let x = 0; x <= cells; x++) {
    for (let y = 0; y <= cells; y++) {
      for (let z = 0; z < cells; z++) {
        addSegment(getPointIndex(x, y, z), getPointIndex(x, y, z + 1));
      }
    }
  }

  for (let x = 0; x <= cells; x++) {
    for (let z = 0; z <= cells; z++) {
      for (let y = 0; y < cells; y++) {
        addSegment(getPointIndex(x, y, z), getPointIndex(x, y + 1, z));
      }
    }
  }

  for (let y = 0; y <= cells; y++) {
    for (let z = 0; z <= cells; z++) {
      for (let x = 0; x < cells; x++) {
        addSegment(getPointIndex(x, y, z), getPointIndex(x + 1, y, z));
      }
    }
  }

  const transform = document.createElement('transform');
  transform.id = 'unit-cube-grid';
  transform.setAttribute('translation', '-0.134631 -14.428800 0.011413');

  const shape = document.createElement('shape');
  const appearance = document.createElement('appearance');
  const material = document.createElement('material');
  const lineSet = document.createElement('indexedLineSet');
  const coordinate = document.createElement('coordinate');

  material.setAttribute('emissiveColor', '0 0 0');
  material.setAttribute('diffuseColor', '0 0 0');
  lineSet.setAttribute('coordIndex', segments.join(' '));
  coordinate.setAttribute('point', points.join(' '));

  appearance.appendChild(material);
  lineSet.appendChild(coordinate);
  shape.appendChild(appearance);
  shape.appendChild(lineSet);
  transform.appendChild(shape);
  scene.appendChild(transform);
  if (window.x3dom) x3dom.reload();
}


/* ─────────────────────────────────────────
   Highlight system: connect D3 nodes to X3D shapes
───────────────────────────────────────── */
function toggleAxisMarkers() {
  const existing = document.getElementById('xyz-axis-markers');
  if (existing) {
    existing.remove();
    if (window.x3dom) x3dom.reload();
    return;
  }

  const scene = document.querySelector('scene');
  if (!scene) return;

  const group = document.createElement('transform');
  group.id = 'xyz-axis-markers';
  group.setAttribute('translation', '0 -16 0');

  function createMaterial(color) {
    const appearance = document.createElement('appearance');
    const material = document.createElement('material');
    material.setAttribute('diffuseColor', color);
    material.setAttribute('emissiveColor', color);
    appearance.appendChild(material);
    return appearance;
  }

  function addCylinder(parent, translation, rotation, height, color) {
    const transform = document.createElement('transform');
    const shape = document.createElement('shape');
    const cylinder = document.createElement('cylinder');

    transform.setAttribute('translation', translation);
    if (rotation) transform.setAttribute('rotation', rotation);
    cylinder.setAttribute('radius', '0.04');
    cylinder.setAttribute('height', String(height));

    shape.appendChild(createMaterial(color));
    shape.appendChild(cylinder);
    transform.appendChild(shape);
    parent.appendChild(transform);
  }

  function addSphere(parent, translation, color) {
    const transform = document.createElement('transform');
    const shape = document.createElement('shape');
    const sphere = document.createElement('sphere');

    transform.setAttribute('translation', translation);
    sphere.setAttribute('radius', '0.18');

    shape.appendChild(createMaterial(color));
    shape.appendChild(sphere);
    transform.appendChild(shape);
    parent.appendChild(transform);
  }

  const length = 12;
  const half = length / 2;
  const step = 2;
  const xzHalf = half + step;
  const xzLength = xzHalf * 2;
  const red = '0.9 0.05 0.05';
  const green = '0.05 0.7 0.15';
  const blue = '0.05 0.25 0.95';

  addCylinder(group, '0 0 0', '0 0 1 1.5708', xzLength, red);
  addCylinder(group, `0 ${half} 0`, null, length, green);
  addCylinder(group, '0 0 0', '1 0 0 1.5708', xzLength, blue);

  for (let value = -xzHalf; value <= xzHalf; value += step) {
    addSphere(group, `${value} 0 0`, red);
    addSphere(group, `0 0 ${value}`, blue);
  }

  for (let value = 0; value <= length; value += step) {
    addSphere(group, `0 ${value} 0`, green);
  }

  scene.appendChild(group);
  if (window.x3dom) x3dom.reload();
}

let groundProjectionY = -16.02;
let groundProjectionSelected = false;
let groundProjectionHovered = false;

function formatGroundProjectionY() {
  return groundProjectionY.toFixed(2).replace(/\.?0+$/, '');
}

function updateGroundProjectionY() {
  const projection = document.getElementById('ground-projection');
  if (!projection) return;

  projection.setAttribute('translation', `0 ${groundProjectionY} 0`);

  const label = document.getElementById('ground-projection-y-label-text');
  if (label) label.setAttribute('string', `"y=${formatGroundProjectionY()}"`);
}

function setGroundProjectionSelected(selected) {
  groundProjectionSelected = selected;
  if (selected && typeof setGroundProjectionCopySelected === 'function') {
    setGroundProjectionCopySelected(false);
  }
  updateGroundProjectionMaterial();
}

function setGroundProjectionHovered(hovered) {
  groundProjectionHovered = hovered;
  updateGroundProjectionMaterial();
}

function updateGroundProjectionMaterial() {
  const planeMaterial = document.getElementById('ground-projection-plane-material');
  if (planeMaterial) {
    let diffuse = '0.2 0.2 0.2';
    let emissive = '0.2 0.2 0.2';
    let transparency = '0.76';

    if (groundProjectionHovered) {
      diffuse = '0.42 0.42 0.42';
      emissive = '0.16 0.16 0.16';
      transparency = '0.62';
    }

    planeMaterial.setAttribute('diffuseColor', diffuse);
    planeMaterial.setAttribute('emissiveColor', emissive);
    planeMaterial.setAttribute('transparency', transparency);
  }
}

window.pickGroundProjection = function (e) {
  if (e) e.stopPropagation();
  const now = Date.now();
  if (window.pickGroundProjection.lastPickAt && now - window.pickGroundProjection.lastPickAt < 250) return;
  window.pickGroundProjection.lastPickAt = now;
  setGroundProjectionSelected(!groundProjectionSelected);
};

window.hoverGroundProjection = function (e) {
  if (e) e.stopPropagation();
  setGroundProjectionHovered(true);
};

window.unhoverGroundProjection = function (e) {
  if (e) e.stopPropagation();
  setGroundProjectionHovered(false);
};

(function initGroundProjectionWheel() {
  const x3dEl = document.getElementById('x3d');
  if (!x3dEl) return;

  x3dEl.addEventListener('wheel', e => {
    if (!groundProjectionSelected || !document.getElementById('ground-projection')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    groundProjectionY += e.deltaY < 0 ? 0.25 : -0.25;
    updateGroundProjectionY();
  }, { capture: true, passive: false });
})();

function toggleGroundProjection() {
  const existing = document.getElementById('ground-projection');
  if (existing) {
    existing.remove();
    setGroundProjectionSelected(false);
    setGroundProjectionHovered(false);
    if (window.x3dom) x3dom.reload();
    return;
  }

  const scene = document.querySelector('scene');
  if (!scene) return;

  const size = 12;
  const half = size / 2;
  const step = 2;
  const group = document.createElement('transform');
  group.id = 'ground-projection';
  group.setAttribute('translation', `0 ${groundProjectionY} 0`);
  function createMaterial(color, transparency = '0') {
    const appearance = document.createElement('appearance');
    const material = document.createElement('material');
    material.setAttribute('diffuseColor', color);
    material.setAttribute('emissiveColor', color);
    material.setAttribute('transparency', transparency);
    appearance.appendChild(material);
    return appearance;
  }

  function addGroundLabel(textValue, translation, id = '') {
    const transform = document.createElement('transform');
    const shape = document.createElement('shape');
    const text = document.createElement('text');
    const fontStyle = document.createElement('fontStyle');

    transform.setAttribute('translation', translation);
    transform.setAttribute('rotation', '1 0 0 -1.5708');
    if (id) text.id = id;
    text.setAttribute('string', `"${textValue}"`);
    fontStyle.setAttribute('size', '0.45');
    fontStyle.setAttribute('family', '"Times New Roman"');
    fontStyle.setAttribute('justify', '"MIDDLE" "MIDDLE"');

    text.appendChild(fontStyle);
    shape.appendChild(createMaterial('0 0 0'));
    shape.appendChild(text);
    transform.appendChild(shape);
    group.appendChild(transform);
  }

  const planeTransform = document.createElement('transform');
  const planeShape = document.createElement('shape');
  const plane = document.createElement('box');
  const planeAppearance = createMaterial('0.2 0.2 0.2', '0.76');
  const planeMaterial = planeAppearance.querySelector('material');
  planeMaterial.id = 'ground-projection-plane-material';

  planeTransform.setAttribute('translation', '0 -0.02 0');
  plane.setAttribute('size', `${size} 0.04 ${size}`);
  planeShape.appendChild(planeAppearance);
  planeShape.appendChild(plane);
  planeTransform.appendChild(planeShape);
  group.appendChild(planeTransform);

  const pickTransform = document.createElement('transform');
  const pickShape = document.createElement('shape');
  const pickAppearance = document.createElement('appearance');
  const pickMaterial = document.createElement('material');
  const pickBox = document.createElement('box');
  pickTransform.setAttribute('translation', '0 0.04 0');
  pickShape.setAttribute('onclick', 'window.pickGroundProjection(event)');
  pickShape.setAttribute('onmousedown', 'window.pickGroundProjection(event)');
  pickShape.setAttribute('onmouseover', 'window.hoverGroundProjection(event)');
  pickShape.setAttribute('onmouseout', 'window.unhoverGroundProjection(event)');
  pickMaterial.setAttribute('diffuseColor', '1 1 1');
  pickMaterial.setAttribute('transparency', '0.98');
  pickAppearance.appendChild(pickMaterial);
  pickBox.setAttribute('size', `${size} 0.12 ${size}`);
  pickShape.appendChild(pickAppearance);
  pickShape.appendChild(pickBox);
  pickTransform.appendChild(pickShape);
  group.appendChild(pickTransform);

  const linePoints = [
    `${-half} 0 ${-half}`, `${half} 0 ${-half}`,
    `${half} 0 ${-half}`, `${half} 0 ${half}`,
    `${half} 0 ${half}`, `${-half} 0 ${half}`,
    `${-half} 0 ${half}`, `${-half} 0 ${-half}`,
    `${-half} 0 0`, `${half} 0 0`,
    `0 0 ${-half}`, `0 0 ${half}`,
  ];
  const lineSegments = [];

  for (let i = 0; i < linePoints.length; i += 2) {
    lineSegments.push(`${i} ${i + 1} -1`);
  }

  for (let value = -half; value <= half; value += step) {
    const xTickStart = linePoints.length;
    linePoints.push(`${value} 0 ${-half}`, `${value} 0 ${-half - 0.45}`);
    lineSegments.push(`${xTickStart} ${xTickStart + 1} -1`);

    const zTickStart = linePoints.length;
    linePoints.push(`${-half} 0 ${value}`, `${-half - 0.45} 0 ${value}`);
    lineSegments.push(`${zTickStart} ${zTickStart + 1} -1`);

    addGroundLabel(value, `${value} 0 ${-half - 0.95}`);
    addGroundLabel(value, `${-half - 0.95} 0 ${value}`);
  }

  const lineShape = document.createElement('shape');
  const lineSet = document.createElement('indexedLineSet');
  const lineCoords = document.createElement('coordinate');
  lineSet.setAttribute('coordIndex', lineSegments.join(' '));
  lineCoords.setAttribute('point', linePoints.join(' '));
  lineSet.appendChild(lineCoords);
  lineShape.appendChild(createMaterial('0 0 0'));
  lineShape.appendChild(lineSet);
  group.appendChild(lineShape);

  addGroundLabel(`y=${formatGroundProjectionY()}`, `${half + 1.35} 0 ${half + 0.75}`, 'ground-projection-y-label-text');

  scene.appendChild(group);
  setGroundProjectionSelected(false);
  setGroundProjectionHovered(false);
  if (window.x3dom) x3dom.reload();
}

function addSectionVoidToGroup(group, size, half, createMaterial) {
  const points = [
    `${-half} 0 ${-half}`, `${half} 0 ${-half}`, `${half} 0 ${half}`, `${-half} 0 ${half}`,
  ];
  const segments = [
    '0 1 -1', '1 2 -1', '2 3 -1', '3 0 -1',
  ];
  const edgeShape = document.createElement('shape');
  const edgeSet = document.createElement('indexedLineSet');
  const edgeCoords = document.createElement('coordinate');
  edgeSet.setAttribute('coordIndex', segments.join(' '));
  edgeCoords.setAttribute('point', points.join(' '));
  edgeSet.appendChild(edgeCoords);
  edgeShape.appendChild(createMaterial('0 0 0'));
  edgeShape.appendChild(edgeSet);
  group.appendChild(edgeShape);
}

let groundProjectionCopyY = -16.02;
let groundProjectionCopySelected = false;
let groundProjectionCopyHovered = false;

function formatGroundProjectionCopyY() {
  return groundProjectionCopyY.toFixed(2).replace(/\.?0+$/, '');
}

function updateGroundProjectionCopyY() {
  const projection = document.getElementById('ground-projection-copy');
  if (!projection) return;

  projection.setAttribute('translation', `0 ${groundProjectionCopyY} 0`);

  const label = document.getElementById('ground-projection-copy-y-label-text');
  if (label) label.setAttribute('string', `"y=${formatGroundProjectionCopyY()}"`);
  applyGroundProjectionCopySection();
}

function setGroundProjectionCopySelected(selected) {
  groundProjectionCopySelected = selected;
  if (selected) setGroundProjectionSelected(false);
  updateGroundProjectionCopyMaterial();
}

function setGroundProjectionCopyHovered(hovered) {
  groundProjectionCopyHovered = hovered;
  updateGroundProjectionCopyMaterial();
}

function updateGroundProjectionCopyMaterial() {
  const planeMaterial = document.getElementById('ground-projection-copy-plane-material');
  if (!planeMaterial) return;

  let diffuse = '0.2 0.2 0.2';
  let emissive = '0.2 0.2 0.2';
  let transparency = '0.76';

  if (groundProjectionCopyHovered) {
    diffuse = '0.42 0.42 0.42';
    emissive = '0.16 0.16 0.16';
    transparency = '0.62';
  }

  planeMaterial.setAttribute('diffuseColor', diffuse);
  planeMaterial.setAttribute('emissiveColor', emissive);
  planeMaterial.setAttribute('transparency', transparency);
}

window.pickGroundProjectionCopy = function (e) {
  if (e) e.stopPropagation();
  const now = Date.now();
  if (window.pickGroundProjectionCopy.lastPickAt && now - window.pickGroundProjectionCopy.lastPickAt < 250) return;
  window.pickGroundProjectionCopy.lastPickAt = now;
  setGroundProjectionCopySelected(!groundProjectionCopySelected);
};

window.hoverGroundProjectionCopy = function (e) {
  if (e) e.stopPropagation();
  setGroundProjectionCopyHovered(true);
};

window.unhoverGroundProjectionCopy = function (e) {
  if (e) e.stopPropagation();
  setGroundProjectionCopyHovered(false);
};

(function initGroundProjectionCopyWheel() {
  const x3dEl = document.getElementById('x3d');
  if (!x3dEl) return;

  x3dEl.addEventListener('wheel', e => {
    if (!groundProjectionCopySelected || !document.getElementById('ground-projection-copy')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    groundProjectionCopyY += e.deltaY < 0 ? 0.25 : -0.25;
    updateGroundProjectionCopyY();
  }, { capture: true, passive: false });
})();

function toggleGroundProjectionCopy() {
  const existing = document.getElementById('ground-projection-copy');
  if (existing) {
    existing.remove();
    clearSectionVisibility();
    setGroundProjectionCopySelected(false);
    setGroundProjectionCopyHovered(false);
    if (window.x3dom) x3dom.reload();
    return;
  }

  const scene = document.querySelector('scene');
  if (!scene) return;

  const size = 12;
  const half = size / 2;
  const step = 2;
  const group = document.createElement('transform');
  group.id = 'ground-projection-copy';
  group.setAttribute('translation', `0 ${groundProjectionCopyY} 0`);

  function createMaterial(color, transparency = '0') {
    const appearance = document.createElement('appearance');
    const material = document.createElement('material');
    material.setAttribute('diffuseColor', color);
    material.setAttribute('emissiveColor', color);
    material.setAttribute('transparency', transparency);
    appearance.appendChild(material);
    return appearance;
  }

  function addGroundLabel(textValue, translation, id = '') {
    const transform = document.createElement('transform');
    const shape = document.createElement('shape');
    const text = document.createElement('text');
    const fontStyle = document.createElement('fontStyle');

    transform.setAttribute('translation', translation);
    transform.setAttribute('rotation', '1 0 0 -1.5708');
    if (id) text.id = id;
    text.setAttribute('string', `"${textValue}"`);
    fontStyle.setAttribute('size', '0.45');
    fontStyle.setAttribute('family', '"Times New Roman"');
    fontStyle.setAttribute('justify', '"MIDDLE" "MIDDLE"');

    text.appendChild(fontStyle);
    shape.appendChild(createMaterial('0 0 0'));
    shape.appendChild(text);
    transform.appendChild(shape);
    group.appendChild(transform);
  }

  const planeTransform = document.createElement('transform');
  const planeShape = document.createElement('shape');
  const plane = document.createElement('box');
  const planeAppearance = createMaterial('0.2 0.2 0.2', '0.76');
  const planeMaterial = planeAppearance.querySelector('material');
  planeMaterial.id = 'ground-projection-copy-plane-material';

  planeTransform.setAttribute('translation', '0 -0.02 0');
  plane.setAttribute('size', `${size} 0.04 ${size}`);
  planeShape.appendChild(planeAppearance);
  planeShape.appendChild(plane);
  planeTransform.appendChild(planeShape);
  group.appendChild(planeTransform);

  const pickTransform = document.createElement('transform');
  const pickShape = document.createElement('shape');
  const pickAppearance = document.createElement('appearance');
  const pickMaterial = document.createElement('material');
  const pickBox = document.createElement('box');
  pickTransform.setAttribute('translation', '0 0.04 0');
  pickShape.setAttribute('onclick', 'window.pickGroundProjectionCopy(event)');
  pickShape.setAttribute('onmousedown', 'window.pickGroundProjectionCopy(event)');
  pickShape.setAttribute('onmouseover', 'window.hoverGroundProjectionCopy(event)');
  pickShape.setAttribute('onmouseout', 'window.unhoverGroundProjectionCopy(event)');
  pickMaterial.setAttribute('diffuseColor', '1 1 1');
  pickMaterial.setAttribute('transparency', '0.98');
  pickAppearance.appendChild(pickMaterial);
  pickBox.setAttribute('size', `${size} 0.12 ${size}`);
  pickShape.appendChild(pickAppearance);
  pickShape.appendChild(pickBox);
  pickTransform.appendChild(pickShape);
  group.appendChild(pickTransform);

  addSectionVoidToGroup(group, size, half, createMaterial);

  const linePoints = [
    `${-half} 0 ${-half}`, `${half} 0 ${-half}`,
    `${half} 0 ${-half}`, `${half} 0 ${half}`,
    `${half} 0 ${half}`, `${-half} 0 ${half}`,
    `${-half} 0 ${half}`, `${-half} 0 ${-half}`,
    `${-half} 0 0`, `${half} 0 0`,
    `0 0 ${-half}`, `0 0 ${half}`,
  ];
  const lineSegments = [];

  for (let i = 0; i < linePoints.length; i += 2) {
    lineSegments.push(`${i} ${i + 1} -1`);
  }

  for (let value = -half; value <= half; value += step) {
    const xTickStart = linePoints.length;
    linePoints.push(`${value} 0 ${-half}`, `${value} 0 ${-half - 0.45}`);
    lineSegments.push(`${xTickStart} ${xTickStart + 1} -1`);

    const zTickStart = linePoints.length;
    linePoints.push(`${-half} 0 ${value}`, `${-half - 0.45} 0 ${value}`);
    lineSegments.push(`${zTickStart} ${zTickStart + 1} -1`);

    addGroundLabel(value, `${value} 0 ${-half - 0.95}`);
    addGroundLabel(value, `${-half - 0.95} 0 ${value}`);
  }

  const lineShape = document.createElement('shape');
  const lineSet = document.createElement('indexedLineSet');
  const lineCoords = document.createElement('coordinate');
  lineSet.setAttribute('coordIndex', lineSegments.join(' '));
  lineCoords.setAttribute('point', linePoints.join(' '));
  lineSet.appendChild(lineCoords);
  lineShape.appendChild(createMaterial('0 0 0'));
  lineShape.appendChild(lineSet);
  group.appendChild(lineShape);

  addGroundLabel(`y=${formatGroundProjectionCopyY()}`, `${half + 1.35} 0 ${half + 0.75}`, 'ground-projection-copy-y-label-text');

  scene.appendChild(group);
  setGroundProjectionCopySelected(false);
  setGroundProjectionCopyHovered(false);
  applyGroundProjectionCopySection();
  if (window.x3dom) x3dom.reload();
}

function parseVec3(value) {
  return String(value || '0 0 0').trim().split(/\s+/).map(Number);
}

function getComponentWorldPosition(defName) {
  const transform = document.querySelector(`[DEF="${defName}_TRANSFORM"]`);
  if (!transform) return null;

  const local = parseVec3(transform.getAttribute('translation'));
  if (local.length < 3 || local.some(Number.isNaN)) return null;

  return {
    x: local[0] * 10,
    y: local[1] * 10 - 10,
    z: local[2] * 10,
  };
}

function clearSectionVisibility() {
  const groundPlane = document.getElementById('model-ground-plane');
  if (groundPlane) groundPlane.setAttribute('render', 'true');

  const clipPlane = document.getElementById('ground-section-clip-plane');
  if (clipPlane) clipPlane.remove();

  if (typeof TYPE_DEFS === 'undefined') return;

  Object.values(TYPE_DEFS).flat().forEach(name => {
    const transform = document.querySelector(`[DEF="${name}_TRANSFORM"]`);
    if (transform) transform.setAttribute('render', 'true');
  });
}

function applyGroundProjectionCopySection() {
  if (!document.getElementById('ground-projection-copy')) {
    clearSectionVisibility();
    return;
  }

  const modelWrapper = document.getElementById('model-wrapper');
  if (!modelWrapper) return;

  let clipPlane = document.getElementById('ground-section-clip-plane');
  if (!clipPlane) {
    clipPlane = document.createElement('clipPlane');
    clipPlane.id = 'ground-section-clip-plane';
    clipPlane.setAttribute('enabled', 'true');
    modelWrapper.insertBefore(clipPlane, modelWrapper.firstChild);
  }

  const localClipY = (groundProjectionCopyY + 10) / 10;
  clipPlane.setAttribute('plane', `0 1 0 ${-localClipY}`);
  if (window.x3dom) x3dom.reload();
}

const TYPE_DEFS = {
  '枓': ['_01_Lu_Dou',
         '_04_Jiao_Hu_Dou', '_05_Jiao_Hu_Dou',
         '_07_Qi_Xin_Dou',  '_08_Qi_Xin_Dou',
         '_13_San_Dou', '_14_San_Dou', '_15_San_Dou', '_16_San_Dou',
         '_17_Jiao_Hu_Dou', '_18_Jiao_Hu_Dou',
         '_19_Qi_Xin_Dou',  '_20_Qi_Xin_Dou'],
  '栱': ['_02_Ni_Dao_Gong', '_09_Gua_Zi_Gong', '_10_Gua_Zi_Gong', '_11_Mang_Gong'],
  '昂': ['_03_Xia_Ang', '_25_XiaAng'],
  '栿': ['_06_Fu'],
  '耍頭': ['_12_Shua_Tou'],
  '枋': ['_21_Fang', '_22_Fang', '_23_Fang', '_24_Fang'],
};
// ── 各構件組裝後的正確位置（從 x3d 讀取）──
const ASSEMBLED_POS = {
  '_01_Lu_Dou':      [ 0.146537, -0.442880, -0.158859],
  '_02_Ni_Dao_Gong': [-0.063462, -0.322880, -0.308859],
  '_03_Xia_Ang':     [ 0.236537, -0.322880, -0.048858],
  '_25_XiaAng':      [-2.439805, -3.024306, -4.114415],
  '_04_Jiao_Hu_Dou': [-0.233463, -0.172880, -0.088859],
  '_05_Jiao_Hu_Dou': [ 0.206537, -0.172880,  0.091141],
  '_06_Fu':          [-0.673463,  0.097120, -0.048858],
  '_07_Qi_Xin_Dou':  [-0.093463, -0.172880,  0.331142],
  '_08_Qi_Xin_Dou':  [-0.093463, -0.172880, -0.188859],
  '_09_Gua_Zi_Gong': [-0.363463, -0.112880, -0.358859],
  '_10_Gua_Zi_Gong': [ 0.236537, -0.112880, -0.358859],
  '_11_Mang_Gong':   [-0.063462, -0.112880, -0.458859],
  '_12_Shua_Tou':    [-0.212434, -0.112880,  0.051142],
  '_13_San_Dou':     [ 0.206537,  0.037120, -0.238859],
  '_14_San_Dou':     [-0.393463,  0.037120, -0.238859],
  '_15_San_Dou':     [-0.393463,  0.037120,  0.381142],
  '_16_San_Dou':     [ 0.206537,  0.037120,  0.381142],
  '_17_Jiao_Hu_Dou': [-0.393463,  0.037120,  0.091142],
  '_18_Jiao_Hu_Dou': [ 0.366537,  0.037120, -0.088858],
  '_19_Qi_Xin_Dou':  [-0.093463,  0.037120,  0.481141],
  '_20_Qi_Xin_Dou':  [-0.093463,  0.037120, -0.338858],
  '_21_Fang':        [-0.063463,  0.307120,  0.481142],
  '_22_Fang':        [-0.263463,  0.097120,  0.381141],
  '_23_Fang':        [-0.063463,  0.097120,  0.281142],
  '_24_Fang':        [ 0.336537,  0.097120, -0.277692],
};

// ── 各類型的固定散落偏移量（x, y, z）──
const SCATTER_OFFSET = {
  '枓':  [ 2.0,  0.0,  0.0],
  '栱':  [-2.0,  0.0,  0.0],
  '昂':  [ 0.0,  0.0,  2.0],
  '栿':  [ 0.0,  0.0, -2.0],
  '耍頭': [ 1.5,  0.0,  1.5],
  '枋':  [ 1.89,  0.0, -1.640001],
};

// ── 動畫系統 ──
const SCATTER_OFFSET_BY_DEF = {
  '_01_Lu_Dou': [0.0, 0.0, 0.0],
  '_03_Xia_Ang': [0.0, 0.0, 1.2],
  '_23_Fang':   [2.49, 0.0, -1.640001],
  '_25_XiaAng':  [-0.25, 0.0, 1.5],
};

const _animCur  = {};   // defName → [x, y, z] 目前動畫位置
const _animRaf  = {};   // defName → requestAnimationFrame handle

function _animateTo(defName, target, duration = 1400) {
  const tr = document.querySelector(`[DEF="${defName}_TRANSFORM"]`);
  if (!tr) return;

  const orig = ASSEMBLED_POS[defName] || [0, 0, 0];
  const cur  = (_animCur[defName] || orig).slice();
  const t0   = performance.now();

  if (_animRaf[defName]) cancelAnimationFrame(_animRaf[defName]);

  function step(now) {
    const p = Math.min((now - t0) / duration, 1);
    const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;  // ease-in-out quad
    const pos = [
      cur[0] + (target[0] - cur[0]) * e,
      cur[1] + (target[1] - cur[1]) * e,
      cur[2] + (target[2] - cur[2]) * e,
    ];
    tr.setAttribute('translation', pos.map(v => v.toFixed(6)).join(' '));
    _animCur[defName] = pos;
    applyGroundProjectionCopySection();
    if (p < 1) _animRaf[defName] = requestAnimationFrame(step);
  }
  _animRaf[defName] = requestAnimationFrame(step);
}

window.assembleType = function (type) {
  (TYPE_DEFS[type] || []).forEach(name => {
    if (ASSEMBLED_POS[name]) _animateTo(name, ASSEMBLED_POS[name]);
  });
};

const SCATTER_Y = -0.442880;  // 所有散落構件的統一高度
const SCATTER_Y_BY_DEF = {
  '_01_Lu_Dou': -0.442880,
  '_25_XiaAng': -3.202880,
};

window.scatterType = function (type) {
  const off = SCATTER_OFFSET[type] || [0, 0, 0];
  (TYPE_DEFS[type] || []).forEach(name => {
    const orig = ASSEMBLED_POS[name];
    if (!orig) return;
    const defOff = SCATTER_OFFSET_BY_DEF[name] ?? off;
    const y = SCATTER_Y_BY_DEF[name] ?? SCATTER_Y;
    _animateTo(name, [orig[0] + defOff[0], y, orig[2] + defOff[2]]);
  });
};

const ORIG_DIFFUSE = '0.45 0.28 0.14';
const ORIG_SPEC    = '0.22 0.14 0.07';
const HI_DIFFUSE   = '1.0 0.55 0.05';
const HI_EMISSIVE  = '0.35 0.18 0.0';

// defName → owned Material elements (USE replaced with real nodes)
const matMap = {};
let hlReady = false;
let selectedType = null;   // 目前 click 選取的 type
let hoverName    = null;   // 目前 hover 中的 defName

function initHighlightSystem() {
  if (hlReady) return;
  hlReady = true;
  Object.values(TYPE_DEFS).flat().forEach(name => {
    const tr = document.querySelector('[DEF="' + name + '_TRANSFORM"]');
    if (!tr) return;
    const owned = [];
    tr.querySelectorAll('Appearance').forEach(app => {
      let mat = app.querySelector('Material');
      if (!mat) return;
      if (mat.hasAttribute('USE')) {
        const newMat = document.createElement('Material');
        newMat.setAttribute('diffuseColor',      ORIG_DIFFUSE);
        newMat.setAttribute('specularColor',      ORIG_SPEC);
        newMat.setAttribute('emissiveColor',      '0 0 0');
        newMat.setAttribute('ambientIntensity',   '0');
        newMat.setAttribute('shininess',          '0.5');
        newMat.setAttribute('transparency',       '0');
        app.replaceChild(newMat, mat);
        owned.push(newMat);
      } else {
        mat.setAttribute('diffuseColor',      ORIG_DIFFUSE);
        mat.setAttribute('specularColor',      ORIG_SPEC);
        mat.setAttribute('emissiveColor',      '0 0 0');
        mat.setAttribute('ambientIntensity',   '0');
        mat.setAttribute('shininess',          '0.5');
        mat.setAttribute('transparency',       '0');
        owned.push(mat);
      }
    });
    matMap[name] = owned;
  });
}

/** @type {(type: string) => void} */
window.highlightType = function (type) {
  selectedType = type;
  clearHighlight();
  (TYPE_DEFS[type] || []).forEach(name => {
    (matMap[name] || []).forEach(mat => {
      mat.setAttribute('diffuseColor',  HI_DIFFUSE);
      mat.setAttribute('emissiveColor', HI_EMISSIVE);
    });
  });
};

window.clearHighlight = function () {
  selectedType = null;
  Object.values(matMap).flat().forEach(mat => {
    mat.setAttribute('diffuseColor',  ORIG_DIFFUSE);
    mat.setAttribute('emissiveColor', '0 0 0');
  });
};

// ── Hover highlight helpers ──
function applyMats(name, hi) {
  (matMap[name] || []).forEach(mat => {
    mat.setAttribute('diffuseColor',  hi ? HI_DIFFUSE  : ORIG_DIFFUSE);
    mat.setAttribute('emissiveColor', hi ? HI_EMISSIVE : '0 0 0');
  });
}

// Restore one defName to its correct state after hover-out
function restoreMats(name) {
  const inSelected = selectedType && (TYPE_DEFS[selectedType] || []).includes(name);
  applyMats(name, inSelected);
}

// ── DEF display names ──
const DEF_LABELS = {
  '_01_Lu_Dou':      { zh: '枓',  sub: '櫨枓'   },
  '_04_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_05_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_07_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_08_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_13_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_14_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_15_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_16_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_17_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_18_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_19_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_20_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_02_Ni_Dao_Gong': { zh: '栱',  sub: '泥道栱' },
  '_09_Gua_Zi_Gong': { zh: '栱',  sub: '瓜子栱' },
  '_10_Gua_Zi_Gong': { zh: '栱',  sub: '瓜子栱' },
  '_11_Mang_Gong':   { zh: '栱',  sub: '慢栱'   },
  '_03_Xia_Ang':     { zh: '昂',  sub: '下昂'   },
  '_25_XiaAng':      { zh: '昂',  sub: '下昂'   },
  '_06_Fu':          { zh: '栿',  sub: '栿'     },
  '_12_Shua_Tou':    { zh: '耍頭', sub: '耍頭'  },
  '_21_Fang':        { zh: '枋',  sub: '枋'     },
  '_22_Fang':        { zh: '枋',  sub: '枋'     },
  '_23_Fang':        { zh: '枋',  sub: '枋'     },
  '_24_Fang':        { zh: '枋',  sub: '枋'     },
};

// ── Hover system (init after matMap is built) ──
const tooltip = document.createElement('div');
tooltip.id = 'x3d-tooltip';
document.body.appendChild(tooltip);

// Track cursor position (X3DOM mouse events carry clientX/Y)
document.getElementById('x3d').addEventListener('mousemove', e => {
  tooltip.style.left = (e.clientX + 16) + 'px';
  tooltip.style.top  = (e.clientY + 16) + 'px';
});

function initHoverSystem() {
  Object.values(TYPE_DEFS).flat().forEach(name => {
    const tr = document.querySelector('[DEF="' + name + '_TRANSFORM"]');
    if (!tr) return;

    tr.addEventListener('mouseover', e => {
      e.stopPropagation();
      if (hoverName === name) return;
      if (hoverName) restoreMats(hoverName);   // restore previous hovered obj
      hoverName = name;
      applyMats(name, true);

      const info = DEF_LABELS[name] || { zh: name, sub: '' };
      tooltip.innerHTML =
        `<div class="tt-type">${info.zh}　${info.sub}</div>` +
        `<div class="tt-id">${name}</div>`;
      tooltip.style.display = 'block';
    });

    tr.addEventListener('mouseout', e => {
      e.stopPropagation();
      if (hoverName !== name) return;
      restoreMats(name);
      hoverName = null;
      tooltip.style.display = 'none';
    });
  });
}

// Fetch X3D, inject into DOM so querySelector works, then init highlight
const targetScene = document.querySelector('scene');
fetch('05-5-1.x3d')
  .then(r => r.text())
  .then(text => {
    const parser = new DOMParser();
    const x3dDoc = parser.parseFromString(text, 'application/xml');
    const srcScene = x3dDoc.querySelector('Scene');

    // wrapper keeps original scale/position
    const wrapper = document.createElement('transform');
    wrapper.id = 'model-wrapper';
    wrapper.setAttribute('scale', '10 10 10');
    wrapper.setAttribute('translation', '0 -10 0');

    Array.from(srcScene.children).forEach(child => {
      const skip = ['NavigationInfo','Background'].includes(child.tagName);
      if (!skip) wrapper.appendChild(document.importNode(child, true));
    });
    targetScene.appendChild(wrapper);
    setTimeout(() => {
      initHighlightSystem();
      initHoverSystem();
      // 初始：所有構件散落
      Object.keys(TYPE_DEFS).forEach(type => window.scatterType(type));
    }, 300);
  })
  .catch(err => console.error('X3D load failed:', err));


/* ─────────────────────────────────────────
   Resizable split
───────────────────────────────────────── */
(function () {
  const resizer   = document.getElementById('resizer');
  const leftPanel = document.getElementById('left-panel');
  let dragging = false;
  let startX = 0;
  let startW = 0;
  let pendingWidth = null;
  let resizeFrame = null;

  function applyPendingWidth() {
    resizeFrame = null;
    if (pendingWidth === null) return;
    leftPanel.style.width = pendingWidth + 'px';
  }

  function queueWidth(width) {
    pendingWidth = width;
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(applyPendingWidth);
  }

  function resizeX3dom() {
    if (window.x3dom) x3dom.reload();
  }

  resizer.addEventListener('pointerdown', e => {
    dragging = true;
    startX = e.clientX;
    startW = leftPanel.offsetWidth;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    resizer.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  resizer.addEventListener('pointermove', e => {
    if (!dragging) return;
    const minLeft = 200;
    const minRight = 200;
    const width = Math.max(minLeft, Math.min(window.innerWidth - minRight, startW + e.clientX - startX));
    queueWidth(width);
    e.preventDefault();
  });

  function stopDragging(e) {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    if (e && resizer.hasPointerCapture(e.pointerId)) {
      resizer.releasePointerCapture(e.pointerId);
    }
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
      applyPendingWidth();
    }
    resizeX3dom();
  }

  resizer.addEventListener('pointerup', stopDragging);
  resizer.addEventListener('pointercancel', stopDragging);
})();


/* ─────────────────────────────────────────
   D3 節點圖
───────────────────────────────────────── */
(function () {
  const svg  = d3.select('#graph-svg');
  const hint = document.getElementById('mode-hint');
  const svgEl = document.getElementById('graph-svg');

  // ── 狀態 ──
  let mode     = 'select';   // 'select' | 'node' | 'edge' | 'delete'
  let nodes    = [];
  let links    = [];
  let nodeId   = 0;
  let selected = null;       // 目前選取的節點或邊
  let edgeSrc  = null;       // 連邊模式的起點

  // ── SVG 圖層（由下到上：邊 → 節點 → 拖曳預覽線）──
  const linkLayer = svg.append('g').attr('class', 'link-layer');
  const nodeLayer = svg.append('g').attr('class', 'node-layer');
  const dragLine  = svg.append('line')
    .attr('id', 'drag-line')
    .style('display', 'none');

  // ── 模式切換 ──
  const HINTS = {
    select: 'V 選取  N 新增節點  E 連接邊  Del 刪除',
    node:   'N模式：點空白處新增節點  |  V 返回',
    edge:   'E模式：點起點 → 點終點  |  Esc 取消',
    delete: 'Del模式：點節點或邊刪除  |  V 返回',
  };

  function setMode(m) {
    mode = m;
    edgeSrc = null;
    dragLine.style('display', 'none');
    svg.style('cursor', m === 'node' ? 'cell' : 'default');
    hint.textContent = HINTS[m] ?? '';
  }

  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key;
    if (k === 'v' || k === 'V') setMode('select');
    if (k === 'n' || k === 'N') setMode('node');
    if (k === 'e' || k === 'E') setMode('edge');
    if (k === 'Escape') setMode('select');
    if ((k === 'Delete' || k === 'Backspace') && selected) removeSelected();
  });

  // ── 點擊空白區域 ──
  svg.on('click', function (ev) {
    if (ev.target !== this) return;
    if (mode === 'node') {
      const [x, y] = d3.pointer(ev, this);
      addNode(x, y, `節點${nodeId + 1}`);
    } else {
      deselect();
    }
    edgeSrc = null;
    dragLine.style('display', 'none');
  });

  // ── 拖曳預覽線跟隨滑鼠 ──
  svg.on('mousemove', function (ev) {
    if (mode !== 'edge' || !edgeSrc) return;
    const [x, y] = d3.pointer(ev, this);
    dragLine.attr('x2', x).attr('y2', y);
  });

  // ── 新增節點 ──
  function addNode(x, y, label, type) {
    nodes.push({ id: ++nodeId, label: label ?? `節點${nodeId}`, type: type ?? null, x, y });
    render();
  }

  // ── 刪除選取 ──
  function removeSelected() {
    if (!selected) return;
    if (selected._type === 'node') {
      nodes = nodes.filter(n => n !== selected);
      links = links.filter(l => l.source !== selected && l.target !== selected);
    } else {
      links = links.filter(l => l !== selected);
    }
    selected = null;
    render();
    syncAssembly();
  }

  // ── 同步組裝狀態：有連結 → 歸位，無連結 → 散落 ──
  function syncAssembly() {
    if (!window.assembleType) return;
    nodes.forEach(node => {
      if (!node.type) return;
      const connected = links.some(l => l.source === node || l.target === node);
      if (connected) window.assembleType(node.type);
      else           window.scatterType(node.type);
    });
  }

  // ── 取消選取 ──
  function deselect() {
    selected = null;
    nodeLayer.selectAll('.node').classed('selected', false);
    linkLayer.selectAll('g.link').classed('selected', false);
    if (window.clearHighlight) window.clearHighlight();
  }

  // ── 渲染 ──
  let linkSel, nodeSel;

  function render() {
    // 邊：每條邊用 <g> 包兩條線（hit 區 + 顯示線）
    linkSel = linkLayer.selectAll('.link')
      .data(links, d => `${d.source.id ?? d.source}-${d.target.id ?? d.target}`);
    linkSel.exit().remove();
    const linkEnter = linkSel.enter().append('g').attr('class', 'link')
      .on('click', function (ev, d) {
        ev.stopPropagation();
        if (mode === 'delete') {
          links = links.filter(l => l !== d);
          render();
          syncAssembly();
          return;
        }
        deselect();
        d._type = 'link';
        selected = d;
        d3.select(this).classed('selected', true);
      });
    linkEnter.append('line').attr('class', 'link-hit');   // 寬透明 hit 區
    linkEnter.append('line').attr('class', 'link-vis');   // 實際顯示線
    linkSel = linkEnter.merge(linkSel);

    // 節點
    nodeSel = nodeLayer.selectAll('.node').data(nodes, d => d.id);
    nodeSel.exit().remove();
    const entered = nodeSel.enter().append('g').attr('class', 'node')
      .call(d3.drag()
        .on('start', onDragStart)
        .on('drag',  onDragged)
        .on('end',   onDragEnd))
      .on('click', onNodeClick);
    entered.append('circle').attr('r', 30);
    entered.append('text').attr('dy', 4).attr('text-anchor', 'middle');
    nodeSel = entered.merge(nodeSel);
    nodeSel.select('text').text(d => d.label);
    drawPositions();
  }

  function drawPositions() {
    if (!linkSel || !nodeSel) return;
    linkSel.selectAll('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  // ── 節點點擊 ──
  function onNodeClick(ev, d) {
    ev.stopPropagation();

    if (mode === 'delete') {
      nodes = nodes.filter(n => n !== d);
      links = links.filter(l => l.source !== d && l.target !== d);
      selected = null;
      render();
      syncAssembly();
      return;
    }

    if (mode === 'edge') {
      if (!edgeSrc) {
        edgeSrc = d;
        dragLine.style('display', null)
          .attr('x1', d.x).attr('y1', d.y)
          .attr('x2', d.x).attr('y2', d.y);
      } else if (edgeSrc !== d) {
        const dup = links.some(l =>
          (l.source === edgeSrc && l.target === d) ||
          (l.source === d       && l.target === edgeSrc));
        if (!dup) links.push({ source: edgeSrc, target: d, _type: 'link' });
        edgeSrc = null;
        dragLine.style('display', 'none');
        render();
        syncAssembly();
      }
      return;
    }

    // select 模式
    deselect();
    d._type = 'node';
    selected = d;
    d3.select(this).classed('selected', true);
    if (window.highlightType && d.type) window.highlightType(d.type);
  }

  // ── 拖曳 ──
  function onDragStart(_ev, d) {
    if (mode === 'edge') return;
    d.fx = d.x;
    d.fy = d.y;
  }

  function onDragged(ev, d) {
    if (mode === 'edge') return;
    d.x = d.fx = ev.x;
    d.y = d.fy = ev.y;
    drawPositions();
  }

  function onDragEnd(_ev, d) {
    if (mode === 'edge') return;
    d.fx = null;
    d.fy = null;
  }

  // ── 初始節點（六種構件）──
  const W = svgEl.clientWidth  || 200;
  const H = svgEl.clientHeight || 600;
  const R = Math.min(W, H) * 0.30;

  const SEEDS = [
    { label: '枓',  type: '枓'  },
    { label: '栱',  type: '栱'  },
    { label: '昂',  type: '昂'  },
    { label: '栿',  type: '栿'  },
    { label: '耍頭', type: '耍頭' },
    { label: '枋',  type: '枋'  },
  ];

  SEEDS.forEach((s, i) => {
    const angle = (i / SEEDS.length) * 2 * Math.PI - Math.PI / 2;
    nodes.push({
      id: ++nodeId,
      label: s.label,
      type:  s.type,
      x: W / 2 + R * Math.cos(angle),
      y: H / 2 + R * Math.sin(angle),
    });
  });

  render();
  setMode('select');
})();
