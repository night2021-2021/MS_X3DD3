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
let dimensionFeatureValue = 2;

let assembledModelLocalBottomY = null;

function createMaterial(color, transparency = '0') {
  const appearance = document.createElement('appearance');
  const material = document.createElement('material');
  material.setAttribute('diffuseColor', color);
  material.setAttribute('emissiveColor', color);
  material.setAttribute('transparency', transparency);
  appearance.appendChild(material);
  return appearance;
}

function normalizeDimensionFeatureValue(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return dimensionFeatureValue;
  return Math.min(Math.max(parsed, 1), 8);
}

function getDimensionDisplayCount() {
  return dimensionFeatureValue * 2;
}

function getFenGridMajorCellSize() {
  return getDimensionStepSize();
}

function getFenGridMajorLineRadius() {
  return 0.018;
}

function getDimensionMeasurementScale() {
  return 1;
}

function getDimensionStepSize() {
  return 2 * FEN_DISTANCE_SCALE * getDimensionMeasurementScale();
}

function getDimensionFenSize() {
  return getDimensionStepSize() / FEN_PER_MAJOR_UNIT;
}

function getXMajorFenPositions() {
  const totalFen = X_MAJOR_CELL_FEN_WIDTHS.reduce((sum, width) => sum + width, 0);
  const positions = [-totalFen / 2];

  X_MAJOR_CELL_FEN_WIDTHS.forEach(width => {
    positions.push(positions[positions.length - 1] + width);
  });

  return positions;
}

function getXMajorPositions() {
  const fenSize = getDimensionFenSize();
  return getXMajorFenPositions().map(value => value * fenSize);
}

function getZMajorFenPositions() {
  const totalFen = Z_MAJOR_CELL_FEN_WIDTHS.reduce((sum, width) => sum + width, 0);
  const positions = [-totalFen / 2];

  Z_MAJOR_CELL_FEN_WIDTHS.forEach(width => {
    positions.push(positions[positions.length - 1] + width);
  });

  return positions;
}

function getZMajorPositions() {
  const fenSize = getDimensionFenSize();
  return getZMajorFenPositions().map(value => value * fenSize);
}

function getAbsoluteDimensionFenSize() {
  return (2 * FEN_DISTANCE_SCALE) / FEN_PER_MAJOR_UNIT;
}

const DEFAULT_DIMENSION_ORIGIN_OFFSET_FEN = [13, -140, -11.75];

function getDimensionOriginOffsetFen() {
  const offset = window.DIMENSION_ORIGIN_OFFSET_FEN;
  if (!Array.isArray(offset)) return DEFAULT_DIMENSION_ORIGIN_OFFSET_FEN;

  return DEFAULT_DIMENSION_ORIGIN_OFFSET_FEN.map((fallback, index) => {
    const value = Number(offset[index]);
    return Number.isFinite(value) ? value : fallback;
  });
}

function formatDimensionRelativeValue(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function formatDimensionRelativeYFen(worldOffset = 0) {
  const fenSize = getAbsoluteDimensionFenSize();
  const fenValue = fenSize ? worldOffset / fenSize : 0;
  return formatDimensionRelativeValue(fenValue);
}

function getDimensionToolOriginPosition() {
  const [anchorX, anchorY, anchorZ] = getDimensionAnchorPosition();
  const [offsetX, offsetY, offsetZ] = getDimensionOriginOffsetFen();
  const fenSize = getAbsoluteDimensionFenSize();
  return [
    anchorX + offsetX * fenSize,
    anchorY + offsetY * fenSize,
    anchorZ + offsetZ * fenSize,
  ];
}

function getDimensionAxisLength() {
  return 12 * FEN_DISTANCE_SCALE * getDimensionMeasurementScale();
}

function getYAxisNodeFenValues(count = 16) {
  const values = [0, 12];
  let nextDelta = 15;

  while (values.length < count) {
    values.push(values[values.length - 1] + nextDelta);
    nextDelta = nextDelta === 15 ? 6 : 15;
  }

  return values.slice(0, count);
}

function isMeasurementFeature(feature) {
  return [
    'unit-grid',
    'axis-markers',
    'axis-layer-planes',
    'ground-projection',
    'ground-projection-copy',
  ].includes(feature);
}

function setFenToggleVisibility(visible) {
  const toggle = document.getElementById('fen-grid-toggle');
  if (toggle) toggle.classList.toggle('is-visible', visible);
}

function setActiveDimensionFeature(feature) {
  activeDimensionFeature = feature;
  document.querySelectorAll('.feature-light').forEach(light => {
    light.classList.toggle('is-active', light.dataset.feature === feature);
  });
  setFenToggleVisibility(isMeasurementFeature(feature));
}

function isDimensionFeatureVisible(feature) {
  const featureElementIds = {
    'unit-grid': 'unit-cube-grid',
    'axis-markers': 'xyz-axis-markers',
    'axis-layer-planes': 'xyz-axis-layer-planes',
    'ground-projection': 'ground-projection',
    'ground-projection-copy': 'ground-projection-copy',
  };

  return !!document.getElementById(featureElementIds[feature]);
}

function clearDimensionFeatures() {
  ['unit-cube-grid', 'xyz-axis-markers', 'xyz-axis-layer-planes', 'ground-projection', 'ground-projection-copy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  clearSectionVisibility();
  gp.setSelected(false);
  gp.setHovered(false);
  gpCopy.setSelected(false);
  gpCopy.setHovered(false);
  setActiveDimensionFeature(null);
}

function activateDimensionFeature(feature) {
  if (feature === 'unit-grid') toggleUnitGrid();
  if (feature === 'axis-markers') toggleAxisMarkers();
  if (feature === 'axis-layer-planes') toggleAxisLayerPlanes();
  if (feature === 'ground-projection') gp.toggle();
  if (feature === 'ground-projection-copy') gpCopy.toggle();
  setActiveDimensionFeature(feature);
}

function refreshActiveDimensionFeature() {
  const feature = activeDimensionFeature;
  if (!feature) return;
  clearDimensionFeatures();
  activateDimensionFeature(feature);
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

(function initModelDataWheel() {
  const wheel = document.getElementById('model-data-wheel');
  const value = document.getElementById('model-data-wheel-value');
  const up = document.getElementById('model-data-up');
  const down = document.getElementById('model-data-down');
  if (!wheel || !value || !up || !down) return;

  const options = ['4', '5', '6'];
  const selected = options.includes(window.SELECTED_MODEL_DATA) ? window.SELECTED_MODEL_DATA : '4';
  let selectedIndex = options.indexOf(selected);
  let isChanging = false;

  function render() {
    const current = options[selectedIndex];
    value.textContent = current;
    wheel.setAttribute('aria-valuenow', current);
  }

  function selectByDelta(delta) {
    if (isChanging) return;
    const nextIndex = (selectedIndex + delta + options.length) % options.length;
    const nextValue = options[nextIndex];
    if (nextValue === options[selectedIndex]) return;

    isChanging = true;
    selectedIndex = nextIndex;
    wheel.classList.remove('is-rolling-up', 'is-rolling-down');
    void wheel.offsetWidth;
    wheel.classList.add(delta > 0 ? 'is-rolling-up' : 'is-rolling-down');
    render();

    const url = new URL(window.location.href);
    url.searchParams.set('modelData', nextValue);
    window.setTimeout(() => {
      window.location.href = url.toString();
    }, 150);
  }

  up.addEventListener('click', () => selectByDelta(-1));
  down.addEventListener('click', () => selectByDelta(1));
  wheel.addEventListener('wheel', e => {
    e.preventDefault();
    selectByDelta(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  wheel.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectByDelta(-1);
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectByDelta(1);
    }
  });

  render();
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

  const footCaiFen = FEN_PER_MAJOR_UNIT;
  const majorCells = getDimensionDisplayCount();
  const majorCellSize = getFenGridMajorCellSize();
  const fenSize = majorCellSize / footCaiFen;
  const yFenDivisions = majorCells * footCaiFen;
  const xMajorFenPositions = getXMajorFenPositions();
  const xMajorFenSet = new Set(xMajorFenPositions);
  const xFenDivisions = xMajorFenPositions[xMajorFenPositions.length - 1] - xMajorFenPositions[0];
  const zMajorFenPositions = getZMajorFenPositions();
  const zMajorFenSet = new Set(zMajorFenPositions);
  const zFenDivisions = zMajorFenPositions[zMajorFenPositions.length - 1] - zMajorFenPositions[0];
  const yFullSize = majorCells * majorCellSize;
  const yHalf = yFullSize / 2;
  const xFullSize = xFenDivisions * fenSize;
  const xHalf = xFullSize / 2;
  const zFullSize = zFenDivisions * fenSize;
  const zHalf = zFullSize / 2;
  const [anchorX, anchorY, anchorZ] = getDimensionToolOriginPosition();

  const transform = document.createElement('transform');
  transform.id = 'unit-cube-grid';
  transform.setAttribute('translation', `${anchorX} ${anchorY} ${anchorZ}`);

  function toYCoord(index) {
    const value = index * fenSize;
    return value;
  }

  function toXCoord(index) {
    return index * fenSize - xHalf;
  }

  function toZCoord(index) {
    return index * fenSize - zHalf;
  }

  function isMajorFen(index) {
    return index % footCaiFen === 0;
  }

  function isMajorXFen(index) {
    return xMajorFenSet.has(index + xMajorFenPositions[0]);
  }

  function isMajorZFen(index) {
    return zMajorFenSet.has(index + zMajorFenPositions[0]);
  }

  function addFineFenGrid() {
    const points = [];
    const segments = [];

    function addLine(a, b) {
      const start = points.length;
      points.push(a, b);
      segments.push(`${start} ${start + 1} -1`);
    }

    for (let y = 0; y <= yFenDivisions; y++) {
      for (let z = 0; z <= zFenDivisions; z++) {
        if (isMajorFen(y) && isMajorZFen(z)) continue;
        addLine(
          `${-xHalf} ${toYCoord(y)} ${toZCoord(z)}`,
          `${xHalf} ${toYCoord(y)} ${toZCoord(z)}`
        );
      }
    }

    for (let x = 0; x <= xFenDivisions; x++) {
      for (let z = 0; z <= zFenDivisions; z++) {
        if (isMajorXFen(x) && isMajorZFen(z)) continue;
        addLine(
          `${toXCoord(x)} 0 ${toZCoord(z)}`,
          `${toXCoord(x)} ${yFullSize} ${toZCoord(z)}`
        );
      }
    }

    for (let x = 0; x <= xFenDivisions; x++) {
      for (let y = 0; y <= yFenDivisions; y++) {
        if (isMajorXFen(x) && isMajorFen(y)) continue;
        addLine(
          `${toXCoord(x)} ${toYCoord(y)} ${-zHalf}`,
          `${toXCoord(x)} ${toYCoord(y)} ${zHalf}`
        );
      }
    }

    const shape = document.createElement('shape');
    const lineSet = document.createElement('indexedLineSet');
    const coordinate = document.createElement('coordinate');

    lineSet.setAttribute('coordIndex', segments.join(' '));
    coordinate.setAttribute('point', points.join(' '));
    lineSet.appendChild(coordinate);
    shape.setAttribute('data-fen-grid-lines', 'true');
    shape.setAttribute('render', String(fineFenGridVisible));
    shape.appendChild(createMaterial('0.34 0.34 0.34', '0.58'));
    shape.appendChild(lineSet);
    transform.appendChild(shape);
  }

  function addMajorFenLine(translation, rotation, length) {
    const lineTransform = document.createElement('transform');
    const shape = document.createElement('shape');
    const cylinder = document.createElement('cylinder');

    lineTransform.setAttribute('translation', translation);
    if (rotation) lineTransform.setAttribute('rotation', rotation);
    cylinder.setAttribute('radius', String(getFenGridMajorLineRadius()));
    cylinder.setAttribute('height', String(length));

    shape.appendChild(createMaterial('0 0 0'));
    shape.appendChild(cylinder);
    lineTransform.appendChild(shape);
    transform.appendChild(lineTransform);
  }

  function addMajorFenGrid() {
    for (let y = 0; y <= yFenDivisions; y += footCaiFen) {
      getZMajorPositions().forEach(z => {
        addMajorFenLine(`0 ${toYCoord(y)} ${z}`, '0 0 1 1.5708', xFullSize);
      });
    }

    getXMajorPositions().forEach(x => {
      getZMajorPositions().forEach(z => {
        addMajorFenLine(`${x} ${yHalf} ${z}`, null, yFullSize);
      });
    });

    getXMajorPositions().forEach(x => {
      for (let y = 0; y <= yFenDivisions; y += footCaiFen) {
        addMajorFenLine(`${x} ${toYCoord(y)} 0`, '1 0 0 1.5708', zFullSize);
      }
    });
  }

  addFineFenGrid();
  addMajorFenGrid();
  scene.appendChild(transform);
  if (window.x3dom) x3dom.reload();
}


/* ─────────────────────────────────────────
   Highlight system: connect D3 nodes to X3D shapes
───────────────────────────────────────── */
function buildAxisMarkers(id, includeYPlanes = false) {
  const scene = document.querySelector('scene');
  if (!scene) return;

  const group = document.createElement('transform');
  group.id = id;
  group.setAttribute('translation', getDimensionToolOriginPosition().join(' '));

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

  function addSphere(parent, translation, color, radius = '0.18', isFinePoint = false) {
    const transform = document.createElement('transform');
    const shape = document.createElement('shape');
    const sphere = document.createElement('sphere');

    transform.setAttribute('translation', translation);
    if (isFinePoint) {
      transform.setAttribute('data-fen-grid-lines', 'true');
      transform.setAttribute('render', String(fineFenGridVisible));
    }
    sphere.setAttribute('radius', String(radius));

    shape.appendChild(createMaterial(color));
    shape.appendChild(sphere);
    transform.appendChild(shape);
    parent.appendChild(transform);
  }

  function addAxisLabel(parent, textValue, translation, color, rotation = '1 0 0 -1.5708') {
    const transform = document.createElement('transform');
    const shape = document.createElement('shape');
    const text = document.createElement('text');
    const fontStyle = document.createElement('fontStyle');

    transform.setAttribute('translation', translation);
    transform.setAttribute('rotation', rotation);
    text.setAttribute('string', `"${textValue}"`);
    fontStyle.setAttribute('size', '0.42');
    fontStyle.setAttribute('family', '"Times New Roman"');
    fontStyle.setAttribute('justify', '"MIDDLE" "MIDDLE"');

    text.appendChild(fontStyle);
    shape.appendChild(createMaterial(color));
    shape.appendChild(text);
    transform.appendChild(shape);
    parent.appendChild(transform);
  }

  function addLayerPlane(parent, axis, value, xSize, zSize, height, color) {
    const transform = document.createElement('transform');
    const planeShape = document.createElement('shape');
    const plane = document.createElement('box');
    const edgeShape = document.createElement('shape');
    const lineSet = document.createElement('indexedLineSet');
    const coordinate = document.createElement('coordinate');
    const xHalf = xSize / 2;
    const zHalf = zSize / 2;
    const halfHeight = height / 2;

    if (axis === 'y') {
      transform.setAttribute('translation', `0 ${value} 0`);
      plane.setAttribute('size', `${xSize} 0.018 ${zSize}`);
      coordinate.setAttribute('point', [
        `${-xHalf} 0.02 ${-zHalf}`,
        `${xHalf} 0.02 ${-zHalf}`,
        `${xHalf} 0.02 ${zHalf}`,
        `${-xHalf} 0.02 ${zHalf}`,
      ].join(' '));
    }

    if (axis === 'x') {
      transform.setAttribute('translation', `${value} ${halfHeight} 0`);
      plane.setAttribute('size', `0.018 ${height} ${zSize}`);
      coordinate.setAttribute('point', [
        `0.02 ${-halfHeight} ${-zHalf}`,
        `0.02 ${halfHeight} ${-zHalf}`,
        `0.02 ${halfHeight} ${zHalf}`,
        `0.02 ${-halfHeight} ${zHalf}`,
      ].join(' '));
    }

    if (axis === 'z') {
      transform.setAttribute('translation', `0 ${halfHeight} ${value}`);
      plane.setAttribute('size', `${xSize} ${height} 0.018`);
      coordinate.setAttribute('point', [
        `${-xHalf} ${-halfHeight} 0.02`,
        `${xHalf} ${-halfHeight} 0.02`,
        `${xHalf} ${halfHeight} 0.02`,
        `${-xHalf} ${halfHeight} 0.02`,
      ].join(' '));
    }

    planeShape.appendChild(createMaterial(color, '0.9'));
    planeShape.appendChild(plane);

    lineSet.setAttribute('coordIndex', '0 1 2 3 0 -1');
    edgeShape.appendChild(createMaterial(color, '0'));
    lineSet.appendChild(coordinate);
    edgeShape.appendChild(lineSet);

    transform.appendChild(planeShape);
    transform.appendChild(edgeShape);
    parent.appendChild(transform);
  }

  const step = getDimensionStepSize();
  const fenSize = getAbsoluteDimensionFenSize();
  const yNodeFenValues = getYAxisNodeFenValues(16).filter(value => value <= 96);
  const yNodeValues = yNodeFenValues.map(value => value * fenSize);
  const length = yNodeValues[yNodeValues.length - 1] || 0;
  const half = length / 2;
  const xMajorFenPositions = getXMajorFenPositions();
  const xMajorFenSet = new Set(xMajorFenPositions);
  const xMajorPositions = getXMajorPositions();
  const xHalf = Math.max(...xMajorPositions.map(Math.abs));
  const xLength = xHalf * 2;
  const zMajorFenPositions = getZMajorFenPositions();
  const zMajorFenSet = new Set(zMajorFenPositions);
  const zMajorPositions = getZMajorPositions();
  const zHalf = Math.max(...zMajorPositions.map(Math.abs));
  const zLength = zHalf * 2;
  const planeHeight = length;
  const red = '0.9 0.05 0.05';
  const green = '0.05 0.7 0.15';
  const blue = '0.05 0.25 0.95';

  addCylinder(group, '0 0 0', '0 0 1 1.5708', Math.max(xLength, step), red);
  addCylinder(group, `0 ${half} 0`, null, length, green);
  addCylinder(group, '0 0 0', '1 0 0 1.5708', Math.max(zLength, step), blue);

  const xLabelOffset = zHalf + 0.72;
  const zLabelOffset = xHalf + 0.72;

  xMajorPositions.forEach((value, index) => {
    addSphere(group, `${value} 0 0`, red);
    addAxisLabel(group, Math.abs(xMajorFenPositions[index]), `${value} 0 ${xLabelOffset}`, red);
    if (includeYPlanes) {
      addLayerPlane(group, 'x', value, xLength, zLength, planeHeight, red);
    }
  });

  zMajorPositions.forEach((value, index) => {
    addSphere(group, `0 0 ${value}`, blue);
    addAxisLabel(group, Math.abs(zMajorFenPositions[index]), `${zLabelOffset} 0 ${value}`, blue);
    if (includeYPlanes) addLayerPlane(group, 'z', value, xLength, zLength, planeHeight, blue);
  });

  const measurementFenSize = getDimensionFenSize();
  for (let fen = xMajorFenPositions[0]; fen <= xMajorFenPositions[xMajorFenPositions.length - 1]; fen++) {
    if (xMajorFenSet.has(fen)) continue;
    addSphere(group, `${fen * measurementFenSize} 0 0`, red, '0.055', true);
  }

  for (let fen = zMajorFenPositions[0]; fen <= zMajorFenPositions[zMajorFenPositions.length - 1]; fen++) {
    if (zMajorFenSet.has(fen)) continue;
    addSphere(group, `0 0 ${fen * measurementFenSize}`, blue, '0.055', true);
  }

  yNodeValues.forEach((value, index) => {
    addSphere(group, `0 ${value} 0`, green);
    addAxisLabel(group, yNodeFenValues[index], `${xHalf + 0.72} ${value} ${zHalf + 0.72}`, green, '0 1 0 0');
    if (includeYPlanes) addLayerPlane(group, 'y', value, xLength, zLength, planeHeight, green);
  });

  scene.appendChild(group);
  if (window.x3dom) x3dom.reload();
}

function toggleAxisMarkers() {
  const existing = document.getElementById('xyz-axis-markers');
  if (existing) {
    existing.remove();
    if (window.x3dom) x3dom.reload();
    return;
  }

  buildAxisMarkers('xyz-axis-markers');
}

function toggleAxisLayerPlanes() {
  const existing = document.getElementById('xyz-axis-layer-planes');
  if (existing) {
    existing.remove();
    if (window.x3dom) x3dom.reload();
    return;
  }

  buildAxisMarkers('xyz-axis-layer-planes', true);
}

function createGroundProjection({
  id, planeMaterialId, labelId,
  pickFnName, hoverFnName, unhoverFnName,
  onUpdateY, onRemove, onBuildExtra, onToggleOn,
  initialY = 0,
}) {
  let relativeY = 0;
  let selected = false;
  let hovered = false;
  let peer = null;

  function formatY() {
    return formatDimensionRelativeYFen(relativeY);
  }

  function getWorldY() {
    const [, anchorY] = getDimensionToolOriginPosition();
    return anchorY + relativeY;
  }

  function updateMaterial() {
    const mat = document.getElementById(planeMaterialId);
    if (!mat) return;
    mat.setAttribute('diffuseColor',  hovered ? '0.42 0.42 0.42' : '0.2 0.2 0.2');
    mat.setAttribute('emissiveColor', hovered ? '0.16 0.16 0.16' : '0.2 0.2 0.2');
    mat.setAttribute('transparency',  hovered ? '0.62'           : '0.76');
  }

  function updateY() {
    const el = document.getElementById(id);
    if (!el) return;
    const [anchorX, anchorY, anchorZ] = getDimensionToolOriginPosition();
    el.setAttribute('translation', `${anchorX} ${anchorY + relativeY} ${anchorZ}`);
    const label = document.getElementById(labelId);
    if (label) label.setAttribute('string', `"y=${formatY()}"`);
    if (onUpdateY) onUpdateY();
  }

  function setSelected(value) {
    selected = value;
    if (value && peer) peer.setSelected(false);
    updateMaterial();
  }

  function setHovered(value) {
    hovered = value;
    updateMaterial();
  }

  window[pickFnName] = function (e) {
    if (e) e.stopPropagation();
    const now = Date.now();
    if (window[pickFnName].lastPickAt && now - window[pickFnName].lastPickAt < 250) return;
    window[pickFnName].lastPickAt = now;
    setSelected(!selected);
  };

  window[hoverFnName]   = e => { if (e) e.stopPropagation(); setHovered(true); };
  window[unhoverFnName] = e => { if (e) e.stopPropagation(); setHovered(false); };

  const x3dEl = document.getElementById('x3d');
  if (x3dEl) {
    x3dEl.addEventListener('wheel', e => {
      if (!selected || !document.getElementById(id)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      relativeY += e.deltaY < 0 ? 0.25 : -0.25;
      updateY();
    }, { capture: true, passive: false });
  }

  function toggle() {
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
      if (onRemove) onRemove();
      setSelected(false);
      setHovered(false);
      if (window.x3dom) x3dom.reload();
      return;
    }

    const scene = document.querySelector('scene');
    if (!scene) return;

    const step = getDimensionStepSize();
    const xMajorFenPositions = getXMajorFenPositions();
    const xMajorPositions = getXMajorPositions();
    const xHalf = Math.max(...xMajorPositions.map(Math.abs));
    const zMajorFenPositions = getZMajorFenPositions();
    const zMajorPositions = getZMajorPositions();
    const zHalf = Math.max(...zMajorPositions.map(Math.abs));
    const xSize = Math.max(xHalf * 2, step);
    const zSize = Math.max(zHalf * 2, step);
    relativeY = initialY;
    const [anchorX, anchorY, anchorZ] = getDimensionToolOriginPosition();

    const group = document.createElement('transform');
    group.id = id;
    group.setAttribute('translation', `${anchorX} ${anchorY + relativeY} ${anchorZ}`);

    addGroundProjectionSurface(group, xSize, zSize, {
      planeMaterialId,
      pickFunction: pickFnName,
      hoverFunction: hoverFnName,
      unhoverFunction: unhoverFnName,
    });

    if (onBuildExtra) onBuildExtra(group, xSize, zSize, xHalf, zHalf);

    addGroundRuler(
      group,
      xHalf,
      zHalf,
      xMajorFenPositions,
      xMajorPositions,
      zMajorFenPositions,
      zMajorPositions,
      `y=${formatY()}`,
      labelId
    );

    scene.appendChild(group);
    setSelected(false);
    setHovered(false);
    if (onToggleOn) onToggleOn();
    if (window.x3dom) x3dom.reload();
  }

  return { toggle, setSelected, setHovered, getY: getWorldY, setPeer(p) { peer = p; } };
}

const gp = createGroundProjection({
  id: 'ground-projection',
  planeMaterialId: 'ground-projection-plane-material',
  labelId: 'ground-projection-y-label-text',
  pickFnName: 'pickGroundProjection',
  hoverFnName: 'hoverGroundProjection',
  unhoverFnName: 'unhoverGroundProjection',
});

function addGroundLabel(group, textValue, translation, id = '') {
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

function addGroundRuler(
  group,
  xHalf,
  zHalf,
  xMajorFenPositions,
  xMajorPositions,
  zMajorFenPositions,
  zMajorPositions,
  yLabel,
  yLabelId
) {
  const linePoints = [
    `${-xHalf} 0 ${-zHalf}`, `${xHalf} 0 ${-zHalf}`,
    `${xHalf} 0 ${-zHalf}`, `${xHalf} 0 ${zHalf}`,
    `${xHalf} 0 ${zHalf}`, `${-xHalf} 0 ${zHalf}`,
    `${-xHalf} 0 ${zHalf}`, `${-xHalf} 0 ${-zHalf}`,
    `${-xHalf} 0 0`, `${xHalf} 0 0`,
    `0 0 ${-zHalf}`, `0 0 ${zHalf}`,
  ];
  const lineSegments = [];

  for (let i = 0; i < linePoints.length; i += 2) {
    lineSegments.push(`${i} ${i + 1} -1`);
  }

  xMajorPositions.forEach((value, index) => {
    const xTickStart = linePoints.length;
    linePoints.push(`${value} 0 ${-zHalf}`, `${value} 0 ${-zHalf - 0.45}`);
    lineSegments.push(`${xTickStart} ${xTickStart + 1} -1`);

    const fenValue = xMajorFenPositions[index];
    addGroundLabel(group, fenValue === 0 ? '0' : String(fenValue), `${value} 0 ${-zHalf - 0.95}`);
  });

  zMajorPositions.forEach((value, index) => {
    const zTickStart = linePoints.length;
    linePoints.push(`${-xHalf} 0 ${value}`, `${-xHalf - 0.45} 0 ${value}`);
    lineSegments.push(`${zTickStart} ${zTickStart + 1} -1`);

    const fenValue = zMajorFenPositions[index];
    addGroundLabel(group, fenValue === 0 ? '0' : String(fenValue), `${-xHalf - 0.95} 0 ${value}`);
  });

  const fineLinePoints = [];
  const fineLineSegments = [];
  const xMajorFenSet = new Set(xMajorFenPositions);
  const measurementFenSize = getDimensionFenSize();

  for (let fen = xMajorFenPositions[0]; fen <= xMajorFenPositions[xMajorFenPositions.length - 1]; fen++) {
    if (xMajorFenSet.has(fen)) continue;
    const value = fen * measurementFenSize;
    const xTickStart = fineLinePoints.length;
    fineLinePoints.push(`${value} 0 ${-zHalf}`, `${value} 0 ${-zHalf - 0.22}`);
    fineLineSegments.push(`${xTickStart} ${xTickStart + 1} -1`);
  }

  const zMajorFenSet = new Set(zMajorFenPositions);
  for (let fen = zMajorFenPositions[0]; fen <= zMajorFenPositions[zMajorFenPositions.length - 1]; fen++) {
    if (zMajorFenSet.has(fen)) continue;
    const value = fen * measurementFenSize;
    const zTickStart = fineLinePoints.length;
    fineLinePoints.push(`${-xHalf} 0 ${value}`, `${-xHalf - 0.22} 0 ${value}`);
    fineLineSegments.push(`${zTickStart} ${zTickStart + 1} -1`);
  }

  const fineLineShape = document.createElement('shape');
  const fineLineSet = document.createElement('indexedLineSet');
  const fineLineCoords = document.createElement('coordinate');
  fineLineShape.setAttribute('data-fen-grid-lines', 'true');
  fineLineShape.setAttribute('render', String(fineFenGridVisible));
  fineLineSet.setAttribute('coordIndex', fineLineSegments.join(' '));
  fineLineCoords.setAttribute('point', fineLinePoints.join(' '));
  fineLineSet.appendChild(fineLineCoords);
  fineLineShape.appendChild(createMaterial('0.34 0.34 0.34'));
  fineLineShape.appendChild(fineLineSet);
  group.appendChild(fineLineShape);

  const lineShape = document.createElement('shape');
  const lineSet = document.createElement('indexedLineSet');
  const lineCoords = document.createElement('coordinate');
  lineSet.setAttribute('coordIndex', lineSegments.join(' '));
  lineCoords.setAttribute('point', linePoints.join(' '));
  lineSet.appendChild(lineCoords);
  lineShape.appendChild(createMaterial('0 0 0'));
  lineShape.appendChild(lineSet);
  group.appendChild(lineShape);

  addGroundLabel(group, yLabel, `${xHalf + 1.35} 0 ${zHalf + 0.75}`, yLabelId);
}

function addGroundProjectionSurface(group, xSize, zSize, { planeMaterialId, pickFunction, hoverFunction, unhoverFunction }) {
  const planeTransform = document.createElement('transform');
  const planeShape = document.createElement('shape');
  const plane = document.createElement('box');
  const planeAppearance = createMaterial('0.2 0.2 0.2', '0.76');
  const planeMaterial = planeAppearance.querySelector('material');
  planeMaterial.id = planeMaterialId;

  planeTransform.setAttribute('translation', '0 -0.02 0');
  plane.setAttribute('size', `${xSize} 0.04 ${zSize}`);
  planeShape.appendChild(planeAppearance);
  planeShape.appendChild(plane);
  planeTransform.appendChild(planeShape);
  group.appendChild(planeTransform);

  const pickTransform = document.createElement('transform');
  const pickShape = document.createElement('shape');
  const pickBox = document.createElement('box');
  pickTransform.setAttribute('translation', '0 0.04 0');
  pickShape.setAttribute('onclick', `window.${pickFunction}(event)`);
  pickShape.setAttribute('onmousedown', `window.${pickFunction}(event)`);
  pickShape.setAttribute('onmouseover', `window.${hoverFunction}(event)`);
  pickShape.setAttribute('onmouseout', `window.${unhoverFunction}(event)`);
  pickBox.setAttribute('size', `${xSize} 0.12 ${zSize}`);
  pickShape.appendChild(createMaterial('1 1 1', '0.98'));
  pickShape.appendChild(pickBox);
  pickTransform.appendChild(pickShape);
  group.appendChild(pickTransform);
}


function addSectionVoidToGroup(group, xSize, zSize, xHalf, zHalf) {
  const points = [
    `${-xHalf} 0 ${-zHalf}`, `${xHalf} 0 ${-zHalf}`, `${xHalf} 0 ${zHalf}`, `${-xHalf} 0 ${zHalf}`,
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

const gpCopy = createGroundProjection({
  id: 'ground-projection-copy',
  planeMaterialId: 'ground-projection-copy-plane-material',
  labelId: 'ground-projection-copy-y-label-text',
  pickFnName: 'pickGroundProjectionCopy',
  hoverFnName: 'hoverGroundProjectionCopy',
  unhoverFnName: 'unhoverGroundProjectionCopy',
  onRemove: clearSectionVisibility,
  onBuildExtra: addSectionVoidToGroup,
  onUpdateY: applyGroundProjectionCopySection,
  onToggleOn: applyGroundProjectionCopySection,
  initialY: 100 * getAbsoluteDimensionFenSize(),
});
gp.setPeer(gpCopy);
gpCopy.setPeer(gp);


function parseVec3(value) {
  return String(value || '0 0 0').trim().split(/\s+/).map(Number);
}

function parseRotation(value) {
  const rotation = String(value || '0 0 1 0').trim().split(/\s+/).map(Number);
  return rotation.length >= 4 && rotation.every(Number.isFinite)
    ? rotation.slice(0, 4)
    : [0, 0, 1, 0];
}

function rotateVec3(point, rotation) {
  const [axisX, axisY, axisZ, angle] = rotation;
  const axisLength = Math.hypot(axisX, axisY, axisZ);
  if (!axisLength || !angle) return point.slice();

  const x = axisX / axisLength;
  const y = axisY / axisLength;
  const z = axisZ / axisLength;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = point[0] * x + point[1] * y + point[2] * z;

  return [
    point[0] * cos + (y * point[2] - z * point[1]) * sin + x * dot * (1 - cos),
    point[1] * cos + (z * point[0] - x * point[2]) * sin + y * dot * (1 - cos),
    point[2] * cos + (x * point[1] - y * point[0]) * sin + z * dot * (1 - cos),
  ];
}

function applyTransformToPoint(point, transform) {
  const scale = parseVec3(transform.getAttribute('scale') || '1 1 1');
  const rotation = parseRotation(transform.getAttribute('rotation'));
  const translation = parseVec3(transform.getAttribute('translation'));
  const scaled = point.map((value, axis) => value * (scale[axis] ?? 1));
  const rotated = rotateVec3(scaled, rotation);

  return rotated.map((value, axis) => value + (translation[axis] ?? 0));
}

function isTransformElement(element) {
  return element?.tagName?.toLowerCase() === 'transform';
}

function applyTransformChainToPoint(point, transform, stopElement = null) {
  const chain = [];
  let current = transform;

  while (current && current !== stopElement) {
    if (isTransformElement(current)) chain.push(current);
    current = current.parentElement;
  }

  return chain
    .reverse()
    .reduce((position, transformElement) => applyTransformToPoint(position, transformElement), point);
}

function getCoordinateBounds(group) {
  const coord = group?.querySelector('Coordinate[point], coordinate[point]');
  if (!coord) return null;

  const values = coord.getAttribute('point').trim().split(/\s+/).map(Number);
  if (values.length < 3) return null;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i + 2 < values.length; i += 3) {
    const point = [values[i], values[i + 1], values[i + 2]];
    if (point.some(Number.isNaN)) continue;

    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }

  if (min.some(v => !Number.isFinite(v)) || max.some(v => !Number.isFinite(v))) return null;
  return { min, max };
}

function getTransformedCoordinateBounds(root) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let hasPoint = false;

  root.querySelectorAll('Coordinate[point], coordinate[point]').forEach(coord => {
    const values = coord.getAttribute('point').trim().split(/\s+/).map(Number);

    for (let i = 0; i + 2 < values.length; i += 3) {
      const localPoint = [values[i], values[i + 1], values[i + 2]];
      if (localPoint.some(Number.isNaN)) continue;

      const point = applyTransformChainToPoint(localPoint, coord);
      hasPoint = true;
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
    }
  });

  return hasPoint ? { min, max } : null;
}

function getDimensionAnchorPosition() {
  const transform = document.querySelector(`[DEF="${DIMENSION_ANCHOR_DEF}_TRANSFORM"]`);

  if (!transform) {
    return [DIMENSION_CENTER_X, DIMENSION_BASE_Y, DIMENSION_CENTER_Z];
  }

  const bounds = getTransformedCoordinateBounds(transform);

  if (!bounds) {
    return [DIMENSION_CENTER_X, DIMENSION_BASE_Y, DIMENSION_CENTER_Z];
  }

  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    bounds.min[1],
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

function getComponentWorldPosition(defName) {
  const transform = document.querySelector(`[DEF="${defName}_TRANSFORM"]`);
  if (!transform) return null;

  const position = applyTransformChainToPoint([0, 0, 0], transform);

  return {
    x: position[0],
    y: position[1],
    z: position[2],
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

  const wrapperScale = parseVec3(modelWrapper.getAttribute('scale') || `${BASE_MODEL_SCALE} ${BASE_MODEL_SCALE} ${BASE_MODEL_SCALE}`);
  const wrapperTranslation = parseVec3(modelWrapper.getAttribute('translation') || BASE_MODEL_TRANSLATION.join(' '));
  const localClipY = (gpCopy.getY() - wrapperTranslation[1]) / wrapperScale[1];
  clipPlane.setAttribute('plane', `0 -1 0 ${localClipY}`);
  if (window.x3dom) x3dom.reload();
}


function getGeometryLocalMinY(transform) {
  const group = getGeometryGroupForPart(transform);
  if (!group) return 0;

  let minY = Infinity;
  group.querySelectorAll('Coordinate[point], coordinate[point]').forEach(coordinate => {
    const values = coordinate.getAttribute('point').trim().split(/\s+/).map(Number);
    for (let i = 1; i < values.length; i += 3) {
      if (!Number.isNaN(values[i])) minY = Math.min(minY, values[i]);
    }
  });

  return Number.isFinite(minY) ? minY : 0;
}

function getAssembledModelLocalBottomY() {
  if (assembledModelLocalBottomY !== null) return assembledModelLocalBottomY;

  let minY = Infinity;
  Object.entries(ASSEMBLED_POS).forEach(([name, assembledPosition]) => {
    const transform = document.querySelector(`[DEF="${name}_TRANSFORM"]`);
    if (!transform) return;

    const scale = parseVec3(transform.getAttribute('scale') || '1 1 1');
    const sy = Number.isFinite(scale[1]) ? scale[1] : 1;
    const geometryMinY = getGeometryLocalMinY(transform);
    minY = Math.min(minY, assembledPosition[1] + sy * geometryMinY);
  });

  assembledModelLocalBottomY = Number.isFinite(minY) ? minY : 0;
  return assembledModelLocalBottomY;
}


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

let assembledLayerCount = 1;
let layerNavReady = false;

function getTypeForDef(defName) {
  return Object.keys(TYPE_DEFS).find(type => TYPE_DEFS[type].includes(defName));
}

function getScatterTarget(defName) {
  const orig = ASSEMBLED_POS[defName];
  if (!orig) return null;

  const type = getTypeForDef(defName);
  const off = SCATTER_OFFSET[type] || [0, 0, 0];
  const defOff = SCATTER_OFFSET_BY_DEF[defName] ?? off;
  const y = SCATTER_Y_BY_DEF[defName] ?? SCATTER_Y;
  return [orig[0] + defOff[0], y, orig[2] + defOff[2]];
}

function updateLayerNavButtons() {
  const back = document.getElementById('layer-back');
  const next = document.getElementById('layer-next');
  if (!back || !next) return;

  back.disabled = !layerNavReady || assembledLayerCount <= 1;
  next.disabled = !layerNavReady || assembledLayerCount >= LAYER_DEFS.length;
}

function assembleLayer(index) {
  (LAYER_DEFS[index] || []).forEach(name => {
    if (ASSEMBLED_POS[name]) _animateTo(name, ASSEMBLED_POS[name]);
  });
}

function scatterLayer(index) {
  (LAYER_DEFS[index] || []).forEach(name => {
    const target = getScatterTarget(name);
    if (target) _animateTo(name, target);
  });
}

function initLayerNav() {
  const back = document.getElementById('layer-back');
  const next = document.getElementById('layer-next');
  if (!back || !next) return;

  back.addEventListener('click', () => {
    if (!layerNavReady || assembledLayerCount <= 1) return;
    assembledLayerCount -= 1;
    scatterLayer(assembledLayerCount);
    updateLayerNavButtons();
  });

  next.addEventListener('click', () => {
    if (!layerNavReady || assembledLayerCount >= LAYER_DEFS.length) return;
    assembleLayer(assembledLayerCount);
    assembledLayerCount += 1;
    updateLayerNavButtons();
  });

  updateLayerNavButtons();
}

initLayerNav();

const ORIG_DIFFUSE = '0.45 0.28 0.14';
const ORIG_SPEC    = '0.22 0.14 0.07';
const HI_DIFFUSE   = '1.0 0.55 0.05';
const HI_EMISSIVE  = '0.35 0.18 0.0';
const HOVER_DIFFUSE  = '0.92 0.86 0.72';
const HOVER_EMISSIVE = '0.18 0.15 0.09';

// defName → owned Material elements (USE replaced with real nodes)
const matMap = {};
let hlReady = false;
let selectedMovableName = null;
let selectedType = null;   // 目前 click 選取的 type
let hoverName    = null;   // 目前 hover 中的 defName

function applyDefaultWoodMaterial(mat) {
  mat.setAttribute('diffuseColor',    ORIG_DIFFUSE);
  mat.setAttribute('specularColor',   ORIG_SPEC);
  mat.setAttribute('emissiveColor',   '0 0 0');
  mat.setAttribute('ambientIntensity','0');
  mat.setAttribute('shininess',       '0.5');
  mat.setAttribute('transparency',    '0');
}

function normalizeDefaultWoodMaterials(root) {
  root.querySelectorAll('Appearance, appearance').forEach(app => {
    let mat = app.querySelector('Material, material');
    if (!mat) {
      mat = document.createElement('Material');
      app.insertBefore(mat, app.firstChild);
    } else if (mat.hasAttribute('USE')) {
      const newMat = document.createElement('Material');
      app.replaceChild(newMat, mat);
      mat = newMat;
    }
    applyDefaultWoodMaterial(mat);
  });
}

function initHighlightSystem() {
  if (hlReady) return;
  hlReady = true;
  Object.values(TYPE_DEFS).flat().forEach(name => {
    const tr = document.querySelector('[DEF="' + name + '_TRANSFORM"]');
    if (!tr) return;

    tr.querySelectorAll('Group[USE]').forEach(useNode => {
      const defName = useNode.getAttribute('USE');
      const defGroup = document.querySelector(`Group[DEF="${defName}"]`);
      if (!defGroup) return;
      const clone = defGroup.cloneNode(true);
      clone.removeAttribute('DEF');
      clone.querySelectorAll('[DEF]').forEach(el => el.removeAttribute('DEF'));
      useNode.parentNode.replaceChild(clone, useNode);
    });

    const owned = [];
    normalizeDefaultWoodMaterials(tr);
    tr.querySelectorAll('Appearance, appearance').forEach(app => {
      let mat = app.querySelector('Material, material');
      if (mat) owned.push(mat);
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
  if (selectedMovableName) applyMats(selectedMovableName, true);
};

// ── Hover highlight helpers ──
function applyMats(name, hi) {
  (matMap[name] || []).forEach(mat => {
    mat.setAttribute('diffuseColor',  hi ? HI_DIFFUSE  : ORIG_DIFFUSE);
    mat.setAttribute('emissiveColor', hi ? HI_EMISSIVE : '0 0 0');
  });
}

function applyHoverMats(name) {
  (matMap[name] || []).forEach(mat => {
    mat.setAttribute('diffuseColor', HOVER_DIFFUSE);
    mat.setAttribute('emissiveColor', HOVER_EMISSIVE);
  });
}

// Restore one defName to its correct state after hover-out
function restoreMats(name) {
  const inSelected = selectedType && (TYPE_DEFS[selectedType] || []).includes(name);
  applyMats(name, inSelected || selectedMovableName === name);
}

function getPartInfoHtml(name) {
  const info = DEF_LABELS[name] || { zh: name, sub: '' };
  const title = info.sub ? `${info.zh}　${info.sub}` : info.zh;
  return `<div class="tt-type">${title}</div><div class="tt-id">${name}</div>`;
}

// ── DEF display names ──
function selectMovablePart(name) {
  selectedType = null;
  Object.values(matMap).flat().forEach(mat => {
    mat.setAttribute('diffuseColor', ORIG_DIFFUSE);
    mat.setAttribute('emissiveColor', '0 0 0');
  });
  hoverName = name;
  selectedMovableName = name;
  applyMats(name, true);
  updateSelectedPartLabel(name);
}

function clearMovablePartSelection() {
  if (!selectedMovableName) return;
  const previousName = selectedMovableName;
  selectedMovableName = null;
  updateSelectedPartLabel(null);
  restoreMats(previousName);
}

function getWrapperAxisScale(axis) {
  const wrapper = document.getElementById('model-wrapper');
  const scale = parseVec3(wrapper?.getAttribute('scale') || `${BASE_MODEL_SCALE} ${BASE_MODEL_SCALE} ${BASE_MODEL_SCALE}`);
  return Number.isFinite(scale[axis]) && scale[axis] !== 0 ? scale[axis] : BASE_MODEL_SCALE;
}

function moveSelectedPart(delta) {
  if (!selectedMovableName) return;
  const transform = document.querySelector(`[DEF="${selectedMovableName}_TRANSFORM"]`);
  if (!transform) return;

  const position = parseVec3(transform.getAttribute('translation'));
  if (position.length < 3 || position.some(Number.isNaN)) return;

  const worldStep = getAbsoluteDimensionFenSize();
  const nextPosition = position.map((value, axis) =>
    value + (delta[axis] * worldStep) / getWrapperAxisScale(axis)
  );

  transform.setAttribute('translation', nextPosition.map(value => value.toFixed(6)).join(' '));
  _animCur[selectedMovableName] = nextPosition;
  refreshSelectedPartAfterTransform();
}

const PART_ROTATION_STEP = Math.PI / 12;

function axisAngleToQuat(rotation) {
  const [axisX, axisY, axisZ, angle] = rotation;
  const axisLength = Math.hypot(axisX, axisY, axisZ);
  if (!axisLength || !angle) return [0, 0, 0, 1];

  const halfAngle = angle / 2;
  const sinHalf = Math.sin(halfAngle);
  return [
    (axisX / axisLength) * sinHalf,
    (axisY / axisLength) * sinHalf,
    (axisZ / axisLength) * sinHalf,
    Math.cos(halfAngle),
  ];
}

function quatMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatToAxisAngle(quat) {
  const length = Math.hypot(...quat);
  if (!length) return [0, 0, 1, 0];

  const [x, y, z, w] = quat.map(value => value / length);
  const clampedW = Math.max(-1, Math.min(1, w));
  const angle = 2 * Math.acos(clampedW);
  const sinHalf = Math.sqrt(1 - clampedW * clampedW);

  if (sinHalf < 0.000001 || !angle) return [0, 0, 1, 0];
  return [x / sinHalf, y / sinHalf, z / sinHalf, angle];
}

function refreshSelectedPartAfterTransform() {
  if (document.getElementById('ground-projection-copy')) applyGroundProjectionCopySection();
  if (boundingBoxesVisible) renderBoundingBoxes();
  else if (window.x3dom) x3dom.reload();
}

function rotateSelectedPart(axisIndex, direction) {
  if (!selectedMovableName) return;
  const transform = document.querySelector(`[DEF="${selectedMovableName}_TRANSFORM"]`);
  if (!transform) return;

  const axis = [0, 0, 0];
  axis[axisIndex] = 1;
  const currentQuat = axisAngleToQuat(parseRotation(transform.getAttribute('rotation')));
  const deltaQuat = axisAngleToQuat([...axis, direction * PART_ROTATION_STEP]);
  const nextRotation = quatToAxisAngle(quatMultiply(deltaQuat, currentQuat));

  transform.setAttribute('rotation', nextRotation.map(value => value.toFixed(6)).join(' '));
  refreshSelectedPartAfterTransform();
}

function initMovablePartKeyboard() {
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') {
      clearMovablePartSelection();
      return;
    }
    if (!selectedMovableName) return;

    const key = e.key.toLowerCase();
    const deltas = {
      w: [0, 1, 0],
      s: [0, -1, 0],
      a: [-1, 0, 0],
      d: [1, 0, 0],
      q: [0, 0, -1],
      e: [0, 0, 1],
    };
    const delta = deltas[key];
    if (delta) {
      e.preventDefault();
      moveSelectedPart(delta);
      return;
    }

    const rotationAxis = { x: 0, y: 1, z: 2 }[key];
    if (rotationAxis === undefined) return;

    e.preventDefault();
    rotateSelectedPart(rotationAxis, e.key === key.toUpperCase() ? 1 : -1);
  });
}

initMovablePartKeyboard();


// ── Hover system (init after matMap is built) ──
const tooltip = document.createElement('div');
tooltip.id = 'x3d-tooltip';
document.body.appendChild(tooltip);

const selectedPartLabel = document.createElement('div');
selectedPartLabel.id = 'selected-part-label';
(document.getElementById('left-panel') || document.body).appendChild(selectedPartLabel);

function updateSelectedPartLabel(name) {
  if (!name) {
    selectedPartLabel.style.display = 'none';
    selectedPartLabel.innerHTML = '';
    return;
  }
  selectedPartLabel.innerHTML = getPartInfoHtml(name);
  selectedPartLabel.style.display = 'block';
}

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
      applyHoverMats(name);

      tooltip.innerHTML = getPartInfoHtml(name);
      tooltip.style.display = 'block';
    });

    tr.addEventListener('mouseout', e => {
      e.stopPropagation();
      if (hoverName !== name) return;
      restoreMats(name);
      hoverName = null;
      tooltip.style.display = 'none';
    });

    tr.addEventListener('click', e => {
      e.stopPropagation();
      selectMovablePart(name);
    });
  });
}

let fineFenGridVisible = true;
let fenMeasurementMode = 'relative';
let boundingBoxesVisible = false;
let modelGeometryVisible = true;

function setFineFenGridVisible(visible) {
  fineFenGridVisible = visible;

  const toggle = document.getElementById('fen-grid-toggle');
  if (toggle) {
    toggle.classList.toggle('is-active', visible);
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.textContent = visible ? 'ON' : 'OFF';
  }

  document.querySelectorAll('[data-fen-grid-lines="true"]').forEach(el => {
    el.setAttribute('render', String(visible));
  });

  if (window.x3dom) x3dom.reload();
}

function initFineFenGridToggle() {
  const toggle = document.getElementById('fen-grid-toggle');
  if (!toggle) return;

  setFineFenGridVisible(fineFenGridVisible);
  toggle.addEventListener('click', () => {
    setFineFenGridVisible(!fineFenGridVisible);
  });
}

initFineFenGridToggle();

function getGeometryGroupForPart(transform) {
  const group = transform.querySelector('Group');
  if (!group) return null;

  const use = group.getAttribute('USE');
  if (!use) return group;

  return document.querySelector(`Group[DEF="${use}"]`);
}

function getLocalBoundingBox(transform) {
  const group = getGeometryGroupForPart(transform);
  const bounds = getCoordinateBounds(group);
  if (!bounds) return null;

  const pad = 0.08;
  const { min, max } = bounds;
  const size = min.map((v, i) => Math.max(max[i] - v + pad, 0.12));
  return {
    center: min.map((v, i) => ((v + max[i]) / 2).toFixed(6)).join(' '),
    size,
  };
}

function removeBoundingBoxes() {
  document.querySelectorAll('[data-bounding-box="true"]').forEach(el => el.remove());
  if (window.x3dom) x3dom.reload();
}

function createBoundingBox(transform) {
  const bounds = getLocalBoundingBox(transform);
  if (!bounds) return;

  const boxTransform = document.createElement('transform');
  const fillShape = document.createElement('shape');
  const fillAppearance = document.createElement('appearance');
  const fillMaterial = document.createElement('material');
  const box = document.createElement('box');
  const lineShape = document.createElement('shape');
  const lineAppearance = document.createElement('appearance');
  const lineMaterial = document.createElement('material');
  const lineSet = document.createElement('indexedLineSet');
  const lineCoords = document.createElement('coordinate');
  const [sx, sy, sz] = bounds.size;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const scaleSigns = (transform.getAttribute('scale') || '1 1 1')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map(value => Number(value) < 0 ? -1 : 1);

  boxTransform.setAttribute('translation', bounds.center);
  boxTransform.setAttribute('data-bounding-box', 'true');
  if (scaleSigns.some(value => value < 0)) {
    boxTransform.setAttribute('scale', scaleSigns.join(' '));
  }

  fillMaterial.setAttribute('diffuseColor', '0.25 0.68 1');
  fillMaterial.setAttribute('emissiveColor', '0.05 0.18 0.3');
  fillMaterial.setAttribute('transparency', '0.72');
  box.setAttribute('size', bounds.size.map(v => v.toFixed(6)).join(' '));

  lineMaterial.setAttribute('diffuseColor', '0 0 0');
  lineMaterial.setAttribute('emissiveColor', '0 0 0');
  lineSet.setAttribute('coordIndex', [
    '0 1 2 3 0 -1',
    '4 5 6 7 4 -1',
    '0 4 -1',
    '1 5 -1',
    '2 6 -1',
    '3 7 -1',
  ].join(' '));
  lineCoords.setAttribute('point', [
    `${-hx} ${-hy} ${-hz}`,
    `${hx} ${-hy} ${-hz}`,
    `${hx} ${hy} ${-hz}`,
    `${-hx} ${hy} ${-hz}`,
    `${-hx} ${-hy} ${hz}`,
    `${hx} ${-hy} ${hz}`,
    `${hx} ${hy} ${hz}`,
    `${-hx} ${hy} ${hz}`,
  ].join(' '));

  fillAppearance.appendChild(fillMaterial);
  fillShape.appendChild(fillAppearance);
  fillShape.appendChild(box);
  lineAppearance.appendChild(lineMaterial);
  lineSet.appendChild(lineCoords);
  lineShape.appendChild(lineAppearance);
  lineShape.appendChild(lineSet);
  boxTransform.appendChild(fillShape);
  boxTransform.appendChild(lineShape);
  transform.appendChild(boxTransform);
}

function renderBoundingBoxes() {
  document.querySelectorAll('[data-bounding-box="true"]').forEach(el => el.remove());

  Object.values(TYPE_DEFS).flat().forEach(name => {
    const transform = document.querySelector(`[DEF="${name}_TRANSFORM"]`);
    if (transform) createBoundingBox(transform);
  });

  if (!modelGeometryVisible) applyModelGeometryVisibility(false);
  if (window.x3dom) x3dom.reload();
}

function getModelGeometryChildren(transform) {
  return Array.from(transform.children).filter(child =>
    child.getAttribute('data-bounding-box') !== 'true'
  );
}

function applyModelGeometryVisibility(visible) {
  Object.values(TYPE_DEFS).flat().forEach(name => {
    const transform = document.querySelector(`[DEF="${name}_TRANSFORM"]`);
    if (!transform) return;

    getModelGeometryChildren(transform).forEach(child => {
      child.setAttribute('render', String(visible));
    });
  });
}

function setModelGeometryVisible(visible) {
  modelGeometryVisible = visible;

  const toggle = document.getElementById('model-visibility-toggle');
  if (toggle) {
    toggle.classList.toggle('is-active', visible);
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('title', 'Model');
  }

  applyModelGeometryVisibility(visible);
  if (window.x3dom) x3dom.reload();
}

function setBoundingBoxesVisible(visible) {
  boundingBoxesVisible = visible;

  const toggle = document.getElementById('bbox-toggle');
  if (toggle) {
    toggle.classList.toggle('is-active', visible);
    toggle.setAttribute('aria-pressed', String(visible));
  }

  if (visible) renderBoundingBoxes();
  else {
    removeBoundingBoxes();
  }
}

function initBoundingBoxToggle() {
  const toggle = document.getElementById('bbox-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    setBoundingBoxesVisible(!boundingBoxesVisible);
  });
}

initBoundingBoxToggle();

function initModelVisibilityToggle() {
  const toggle = document.getElementById('model-visibility-toggle');
  if (!toggle) return;

  setModelGeometryVisible(modelGeometryVisible);
  toggle.addEventListener('click', () => {
    setModelGeometryVisible(!modelGeometryVisible);
  });
}

initModelVisibilityToggle();


let activeModelKey = 'original';
let modelLoadRequestId = 0;

function getMainViewpoint() {
  return document.querySelector('scene > viewpoint');
}

function applyViewpointConfig(config) {
  const viewpoint = getMainViewpoint();
  if (!viewpoint || !config.viewpoint) return;

  Object.entries(config.viewpoint).forEach(([name, value]) => {
    viewpoint.setAttribute(name, value);
  });

  const position = parseVec3(config.viewpoint.position || '0 0 50');
  viewpoint.setAttribute('centerOfRotation', `${position[0] || 0} ${position[1] || 0} 0`);
}

const CAMERA_AXIS_DIRECTIONS = {
  'x:1': {
    offset: [1, 0, 0],
    orientation: '0 1 0 1.570796',
  },
  'x:-1': {
    offset: [-1, 0, 0],
    orientation: '0 1 0 -1.570796',
  },
  'y:1': {
    offset: [0, 1, 0],
    orientation: '1 0 0 -1.570796',
  },
  'y:-1': {
    offset: [0, -1, 0],
    orientation: '1 0 0 1.570796',
  },
  'z:1': {
    offset: [0, 0, 1],
    orientation: '0 0 1 0',
  },
  'z:-1': {
    offset: [0, 0, -1],
    orientation: '0 1 0 3.141593',
  },
};

function getCameraAxisViewSetup() {
  const config = MODEL_CONFIGS[activeModelKey];
  const position = parseVec3(config?.viewpoint?.position || '0 0 50');
  const target = [position[0] || 0, position[1] || 0, 0];
  const distance = Math.max(
    Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    ),
    1,
  );

  return { target, distance };
}

function setCameraAxisView(axis, sign) {
  const direction = CAMERA_AXIS_DIRECTIONS[`${axis}:${sign}`];
  const viewpoint = getMainViewpoint();
  if (!direction || !viewpoint) return;

  const { target, distance } = getCameraAxisViewSetup();
  const position = target.map((value, index) => value + direction.offset[index] * distance);

  viewpoint.setAttribute('position', position.join(' '));
  viewpoint.setAttribute('orientation', direction.orientation);
  viewpoint.setAttribute('centerOfRotation', target.join(' '));
  viewpoint.setAttribute('set_bind', 'true');
}

function initCameraAxisWidget() {
  const widget = document.getElementById('camera-axis-widget');
  const x3d = document.getElementById('x3d');
  if (!widget || !x3d) return;

  const center = 56;
  const radius = 37;
  const axisVectors = {
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
  };
  const lines = Object.fromEntries(
    Array.from(widget.querySelectorAll('.camera-axis-line')).map(line => [line.dataset.axis, line]),
  );
  const ends = Array.from(widget.querySelectorAll('.camera-axis-end'));

  ends.forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      setCameraAxisView(button.dataset.axis, Number(button.dataset.sign));
    });
  });

  function projectAxis(vector, matrix) {
    return {
      x: matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2],
      y: matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2],
      depth: matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2],
    };
  }

  function render() {
    let matrix = null;

    try {
      matrix = x3d.runtime?.viewMatrix?.().toGL?.();
    } catch (_error) {
      matrix = null;
    }

    if (matrix?.length >= 16) {
      const projected = {};

      Object.entries(axisVectors).forEach(([axis, vector]) => {
        projected[axis] = projectAxis(vector, matrix);
        const line = lines[axis];
        const point = projected[axis];

        line.setAttribute('x1', center - point.x * radius);
        line.setAttribute('y1', center + point.y * radius);
        line.setAttribute('x2', center + point.x * radius);
        line.setAttribute('y2', center - point.y * radius);
      });

      ends
        .map(button => {
          const axis = button.dataset.axis;
          const sign = Number(button.dataset.sign);
          const point = projected[axis];
          const depth = point.depth * sign;

          button.style.left = `${center + point.x * radius * sign}px`;
          button.style.top = `${center - point.y * radius * sign}px`;
          return { button, depth };
        })
        .sort((a, b) => a.depth - b.depth)
        .forEach(({ button }, index) => {
          button.style.zIndex = String(index + 1);
        });
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

initCameraAxisWidget();

function resetOriginalModelState() {
  Object.values(_animRaf).forEach(handle => {
    if (handle) cancelAnimationFrame(handle);
  });
  Object.keys(_animRaf).forEach(key => delete _animRaf[key]);
  Object.keys(_animCur).forEach(key => delete _animCur[key]);
  Object.keys(matMap).forEach(key => delete matMap[key]);
  hlReady = false;
  selectedMovableName = null;
  selectedType = null;
  hoverName = null;
  assembledModelLocalBottomY = null;
  tooltip.style.display = 'none';
  updateSelectedPartLabel(null);
  clearDimensionFeatures();
  setBoundingBoxesVisible(false);
  layerNavReady = false;
  assembledLayerCount = 1;
  updateLayerNavButtons();
}

function setModelSwitchLoading(isLoading) {
  const button = document.getElementById('model-switch-toggle');
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Loading' : 'Palace Viewer';
}

function initOriginalModelTools() {
  initHighlightSystem();
  initHoverSystem();
  Object.keys(TYPE_DEFS).forEach(type => window.scatterType(type));
  assembledLayerCount = 1;
  layerNavReady = true;
  updateLayerNavButtons();
  if (boundingBoxesVisible) renderBoundingBoxes();
  applyModelGeometryVisibility(modelGeometryVisible);
}

function loadModel(modelKey) {
  const config = MODEL_CONFIGS[modelKey];
  if (!config || !targetScene) return;

  const requestId = ++modelLoadRequestId;
  activeModelKey = modelKey;
  resetOriginalModelState();
  setModelSwitchLoading(true);
  applyViewpointConfig(config);

  const currentWrapper = document.getElementById('model-wrapper');
  if (currentWrapper) currentWrapper.remove();
  if (window.x3dom) x3dom.reload();

  fetch(config.url)
    .then(r => {
      if (!r.ok) throw new Error(`${config.url} returned ${r.status}`);
      return r.text();
    })
    .then(text => {
      if (requestId !== modelLoadRequestId) return;

      const parser = new DOMParser();
      const x3dDoc = parser.parseFromString(text, 'application/xml');
      const srcScene = x3dDoc.querySelector('Scene');
      if (!srcScene) throw new Error(`${config.url} has no Scene element`);

      const wrapper = document.createElement('transform');
      wrapper.id = 'model-wrapper';
      wrapper.setAttribute('scale', config.scale);
      wrapper.setAttribute('translation', config.translation);

      Array.from(srcScene.children).forEach(child => {
        const skip = ['NavigationInfo', 'Background'].includes(child.tagName);
        if (!skip) wrapper.appendChild(document.importNode(child, true));
      });

      normalizeDefaultWoodMaterials(wrapper);
      targetScene.appendChild(wrapper);
      if (window.x3dom) x3dom.reload();

      setTimeout(() => {
        if (requestId !== modelLoadRequestId) return;
        if (config.enableOriginalTools) initOriginalModelTools();
        setModelSwitchLoading(false);
      }, 300);
    })
    .catch(err => {
      if (requestId !== modelLoadRequestId) return;
      console.error('X3D load failed:', err);
      setModelSwitchLoading(false);
    });
}

function initModelSwitchToggle() {
  const button = document.getElementById('model-switch-toggle');
  if (!button) return;

  button.textContent = 'Palace Viewer';
  button.addEventListener('click', () => {
    const url = new URL('viewer.html', window.location.href);
    url.searchParams.set('model', 'palace');
    url.searchParams.set('modelData', ['4', '5', '6'].includes(window.SELECTED_MODEL_DATA) ? window.SELECTED_MODEL_DATA : '4');
    window.open(url.toString(), '_blank', 'noopener');
  });
}

initModelSwitchToggle();

// Fetch X3D, inject into DOM so querySelector works, then init highlight
const targetScene = document.querySelector('scene');
loadModel(activeModelKey);

      // 初始：所有構件散落


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
