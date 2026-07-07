(function removeX3domUI() {
  const selectors = ['#x3dom-navi', '.x3dom-navi', '.x3dom-progress', '.x3dom-logContainer'];

  function clean() {
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => element.remove());
    });
  }

  clean();
  document.addEventListener('DOMContentLoaded', clean);
  window.addEventListener('load', clean);
  new MutationObserver(clean).observe(document.body, { childList: true, subtree: true });
})();

const targetScene = document.querySelector('scene');
const DEFAULT_WOOD_COLOR = '0.450 0.280 0.140';
const AUTO_ROTATE_PERIOD_MS = 12000;
const INLINE_FOLDER_MODEL_KEYS = new Set(['x3d:Palace1-1']);
const FOLDER_MODEL_URL_OVERRIDES = {
  'x3d:Palace1-1': 'X3D/Palace1-1-viewer.x3d',
};
let activeModelKey = 'palace';
let modelLoadRequestId = 0;
let palaceViewCenter = [0, 8, 0];
let palaceViewDistance = 80;
let autoRotateId = null;
let autoRotateStart = null;
let autoRotateElapsed = 0;
let autoRotateEnabled = true;
let referenceImageEnabled = false;
let referenceImageZPercent = 100;
let cachedModelBounds = null;
const REFERENCE_IMAGE_GROUP_ID = 'facade-reference-image';
const REFERENCE_IMAGE_MODEL_KEY = 'palace-view:001';
const REFERENCE_IMAGE_URL = '3-6No.png';
const REFERENCE_IMAGE_ASPECT_RATIO = 1457 / 768;
const REFERENCE_IMAGE_SCALE = 1.4;
const REFERENCE_IMAGE_Y_OFFSET = 60;
const REFERENCE_IMAGE_Z_MARGIN_RATIO = 0.05;

function parseVec3(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(Number)
    .slice(0, 3);
}

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

function updateUrlModelKey(modelKey) {
  const url = new URL(window.location.href);
  url.searchParams.set('model', modelKey);
  window.history.replaceState(null, '', url);
}

function setActiveModelListItem(match) {
  document.querySelectorAll('#model-list li').forEach(li => {
    li.classList.toggle('is-active', Object.entries(match).every(([key, value]) => li.dataset[key] === value));
  });
}

function setViewerStatus(message) {
  const status = document.getElementById('viewer-status');
  if (!status) return;

  status.textContent = message || '';
  status.classList.toggle('is-visible', Boolean(message));
}

function setModelSwitchLoading(isLoading) {
  document.title = isLoading ? '載入中... — 模型瀏覽器' : '模型瀏覽器';
}

function reloadX3dom() {
  if (window.x3dom) x3dom.reload();
}

function parseX3domNode(element) {
  if (!window.x3dom || !element) return;
  if (typeof x3dom?.runtime?.load === 'function') {
    x3dom.runtime.load(element);
    return;
  }
  if (typeof x3dom?.load === 'function') {
    x3dom.load(element);
    return;
  }
  reloadX3dom();
}

function localNameEquals(node, name) {
  return node?.localName?.toLowerCase() === name;
}

function childByLocalName(node, name) {
  return Array.from(node?.children || []).find(child => localNameEquals(child, name));
}

function createX3dElement(doc, sourceNode, tagName) {
  return sourceNode?.namespaceURI
    ? doc.createElementNS(sourceNode.namespaceURI, tagName)
    : doc.createElement(tagName);
}

function applyDefaultWoodMaterial(x3dDoc) {
  const shapes = Array.from(x3dDoc.getElementsByTagName('*')).filter(node => localNameEquals(node, 'shape'));

  shapes.forEach(shape => {
    let appearance = childByLocalName(shape, 'appearance');

    if (!appearance) {
      appearance = createX3dElement(x3dDoc, shape, 'Appearance');
      shape.insertBefore(appearance, shape.firstChild);
    }

    if (childByLocalName(appearance, 'material')) return;

    const material = createX3dElement(x3dDoc, appearance, 'Material');
    material.setAttribute('diffuseColor', DEFAULT_WOOD_COLOR);
    material.setAttribute('ambientIntensity', '0.000');
    material.setAttribute('specularColor', '0.401 0.401 0.401');
    material.setAttribute('shininess', '0.500');
    appearance.insertBefore(material, appearance.firstChild);
  });
}

function importX3dSceneChildren(x3dDoc, wrapper) {
  const srcScene = Array.from(x3dDoc.getElementsByTagName('*')).find(node => localNameEquals(node, 'scene'));
  if (!srcScene) throw new Error('X3D has no Scene element');

  Array.from(srcScene.children).forEach(child => {
    if (['navigationinfo', 'background', 'viewpoint'].includes(child.localName.toLowerCase())) return;
    wrapper.appendChild(document.importNode(child, true));
  });
}

function vec3FromAny(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.slice(0, 3).map(Number);
  if (typeof value.toGL === 'function') return value.toGL().slice(0, 3).map(Number);
  if (['x', 'y', 'z'].every(axis => Number.isFinite(Number(value[axis])))) {
    return [Number(value.x), Number(value.y), Number(value.z)];
  }
  if ([0, 1, 2].every(index => Number.isFinite(Number(value[index])))) {
    return [Number(value[0]), Number(value[1]), Number(value[2])];
  }
  return null;
}

function getVolumeBounds(volume) {
  if (!volume) return null;

  const directPairs = [
    ['min', 'max'],
    ['_min', '_max'],
    ['minBounds', 'maxBounds'],
  ];

  for (const [minKey, maxKey] of directPairs) {
    const min = vec3FromAny(volume[minKey]);
    const max = vec3FromAny(volume[maxKey]);
    if (min && max) return { min, max };
  }

  if (typeof volume.getBounds === 'function' && window.x3dom?.fields?.SFVec3f) {
    const min = new x3dom.fields.SFVec3f(0, 0, 0);
    const max = new x3dom.fields.SFVec3f(0, 0, 0);
    volume.getBounds(min, max);
    return { min: vec3FromAny(min), max: vec3FromAny(max) };
  }

  return null;
}

function getModelWrapperBounds() {
  const wrapperNode = document.getElementById('model-wrapper')?._x3domNode;
  if (!wrapperNode) return null;

  const volume = typeof wrapperNode.getVolume === 'function'
    ? wrapperNode.getVolume()
    : wrapperNode._graph?.volume;
  const bounds = getVolumeBounds(volume);

  if (!bounds?.min || !bounds?.max) return null;
  if (![...bounds.min, ...bounds.max].every(Number.isFinite)) return null;
  return bounds;
}

function removeFacadeReferenceImage() {
  const existing = document.getElementById(REFERENCE_IMAGE_GROUP_ID);
  if (existing) existing.remove();
}

function getReferenceImagePlacement(wrapper, bounds) {
  const wrapperScale = parseVec3(wrapper.getAttribute('scale') || '1 1 1');
  const wrapperTranslation = parseVec3(wrapper.getAttribute('translation') || '0 0 0');
  const toLocal = (axis, worldValue) => {
    const scale = wrapperScale[axis] || 1;
    return (worldValue - wrapperTranslation[axis]) / scale;
  };

  const xMin = toLocal(0, bounds.min[0]);
  const xMax = toLocal(0, bounds.max[0]);
  const yMin = toLocal(1, bounds.min[1]);
  const yMax = toLocal(1, bounds.max[1]);

  const aspectRatio = REFERENCE_IMAGE_ASPECT_RATIO;
  const widthLimit = Math.max(xMax - xMin, 0.0001);
  const heightLimit = Math.max(yMax - yMin, 0.0001);
  let width = widthLimit;
  let height = width / aspectRatio;

  if (height > heightLimit) {
    height = heightLimit;
    width = height * aspectRatio;
  }

  width *= REFERENCE_IMAGE_SCALE;
  height *= REFERENCE_IMAGE_SCALE;

  const zDepthWorld = bounds.max[2] - bounds.min[2];
  const zMarginWorld = Math.max(zDepthWorld * REFERENCE_IMAGE_Z_MARGIN_RATIO, 0.0001);
  const zMinWorld = bounds.min[2] - zMarginWorld;
  const zMaxWorld = bounds.max[2] + zMarginWorld;
  const zRatio = Math.min(100, Math.max(0, referenceImageZPercent)) / 100;
  const zWorld = zMinWorld + (zMaxWorld - zMinWorld) * zRatio;

  return {
    centerX: (xMin + xMax) / 2,
    centerY: (yMin + yMax) / 2 + REFERENCE_IMAGE_Y_OFFSET,
    centerZ: toLocal(2, zWorld),
    width,
    height,
  };
}

function buildFacadeReferenceImage() {
  removeFacadeReferenceImage();
  if (!referenceImageEnabled) return;

  const wrapper = document.getElementById('model-wrapper');
  if (!wrapper) return;

  // Use the bounds captured right after the model finished loading, not a
  // fresh live measurement — the reference plane is itself a child of
  // #model-wrapper, so once it exists (especially at scale != 1, where it
  // extends past the model's own extent) a live re-measurement would include
  // it and feed back into the next size calculation, growing/shrinking it
  // uncontrollably on every rebuild.
  const bounds = cachedModelBounds || getModelWrapperBounds();
  if (!bounds) return;

  const placement = getReferenceImagePlacement(wrapper, bounds);
  const halfWidth = placement.width / 2;
  const halfHeight = placement.height / 2;
  const x0 = placement.centerX - halfWidth;
  const x1 = placement.centerX + halfWidth;
  const y0 = placement.centerY - halfHeight;
  const y1 = placement.centerY + halfHeight;
  const z = placement.centerZ;

  const group = document.createElement('transform');
  group.id = REFERENCE_IMAGE_GROUP_ID;
  group.setAttribute('render', 'true');

  const shape = document.createElement('shape');
  const appearance = document.createElement('appearance');
  const material = document.createElement('material');
  material.setAttribute('diffuseColor', '1 1 1');
  material.setAttribute('emissiveColor', '0 0 0');
  material.setAttribute('transparency', '0.08');

  const texture = document.createElement('imageTexture');
  texture.setAttribute('url', `"${REFERENCE_IMAGE_URL}"`);

  const face = document.createElement('indexedFaceSet');
  face.setAttribute('solid', 'false');
  face.setAttribute('coordIndex', '0 1 2 3 -1');
  face.setAttribute('texCoordIndex', '0 1 2 3 -1');

  const coordinate = document.createElement('coordinate');
  coordinate.setAttribute('point', `${x0} ${y0} ${z} ${x1} ${y0} ${z} ${x1} ${y1} ${z} ${x0} ${y1} ${z}`);

  const texCoord = document.createElement('textureCoordinate');
  texCoord.setAttribute('point', '0 0 1 0 1 1 0 1');

  appearance.append(material, texture);
  face.append(coordinate, texCoord);
  shape.append(appearance, face);
  group.appendChild(shape);
  wrapper.appendChild(group);
  // A partial/incremental x3dom load (parseX3domNode) does not reliably bind
  // a freshly inserted ImageTexture node's GL texture; a full reload does.
  reloadX3dom();
}

function refreshFacadeReferenceImage() {
  if (!referenceImageEnabled) return;
  buildFacadeReferenceImage();
}

function updatePalaceViewFromBounds() {
  const bounds = getModelWrapperBounds();
  if (!bounds) return false;

  cachedModelBounds = bounds;

  const center = bounds.min.map((value, index) => (value + bounds.max[index]) / 2);
  const size = bounds.max.map((value, index) => Math.max(0, value - bounds.min[index]));
  const radius = Math.max(Math.hypot(size[0], size[1], size[2]) / 2, 1);
  const fieldOfView = Number.parseFloat(getMainViewpoint()?.getAttribute('fieldOfView') || '0.7');
  const distance = Math.max((radius / Math.tan(fieldOfView / 2)) * 0.85, 32);

  palaceViewCenter = center;
  palaceViewDistance = distance;
  return true;
}

function applyPalaceFrontView() {
  const viewpoint = getMainViewpoint();
  if (!viewpoint) return false;

  const hasBounds = updatePalaceViewFromBounds();
  const [x, y, z] = palaceViewCenter;
  const position = [x, y, z + palaceViewDistance];

  viewpoint.setAttribute('position', position.join(' '));
  viewpoint.setAttribute('orientation', '0 1 0 0');
  viewpoint.setAttribute('centerOfRotation', palaceViewCenter.join(' '));
  viewpoint.setAttribute('fieldOfView', '0.7');
  viewpoint.setAttribute('set_bind', 'true');
  return hasBounds;
}

function startPalaceLoadWatcher(requestId, onFinish) {
  const startedAt = performance.now();
  let finished = false;
  let attempts = 0;
  let tickTimer = null;

  function finish() {
    if (finished || requestId !== modelLoadRequestId) return;
    finished = true;
    if (tickTimer !== null) window.clearTimeout(tickTimer);
    applyPalaceFrontView();
    refreshFacadeReferenceImage();
    setModelSwitchLoading(false);
    setViewerStatus('');
    if (typeof onFinish === 'function') onFinish();
  }

  function queueTick(delay = 500) {
    if (finished || tickTimer !== null) return;
    tickTimer = window.setTimeout(tick, delay);
  }

  function tick() {
    tickTimer = null;
    if (finished || requestId !== modelLoadRequestId) return;

    attempts += 1;
    const elapsed = performance.now() - startedAt;
    const fitted = attempts > 2 ? updatePalaceViewFromBounds() : false;

    if (fitted && elapsed > 1200) {
      finish();
      return;
    }

    if (elapsed > 16000) {
      finish();
      return;
    }

    queueTick();
  }

  queueTick();
  return () => queueTick(100);
}

function loadModel(modelKey) {
  const config = MODEL_CONFIGS[modelKey];
  if (!config || !targetScene) return;
  stopAutoRotate();

  const requestId = ++modelLoadRequestId;
  activeModelKey = modelKey;
  updateReferenceImageAvailability();
  updateUrlModelKey(modelKey);
  setActiveModelListItem({ modelKey });
  applyViewpointConfig(config);
  setModelSwitchLoading(true);
  setViewerStatus('Loading Palace');

  const currentWrapper = document.getElementById('model-wrapper');
  if (currentWrapper) currentWrapper.remove();

  const wrapper = document.createElement('transform');
  wrapper.id = 'model-wrapper';
  wrapper.setAttribute('scale', config.scale);
  wrapper.setAttribute('translation', config.translation);

  const inline = document.createElement('inline');
  inline.setAttribute('url', config.url);
  const nudgeLoadWatcher = startPalaceLoadWatcher(requestId);
  ['load', 'loaded', 'x3domload'].forEach(eventName => {
    inline.addEventListener(eventName, () => {
      window.setTimeout(nudgeLoadWatcher, 500);
    });
  });
  inline.addEventListener('error', error => {
    if (requestId !== modelLoadRequestId) return;
    console.error('X3D inline load failed:', error);
    setModelSwitchLoading(false);
    setViewerStatus('Load failed');
  });

  wrapper.appendChild(inline);
  targetScene.appendChild(wrapper);
  reloadX3dom();
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
  const viewpoint = getMainViewpoint();
  const position = parseVec3(viewpoint?.getAttribute('position') || '0 0 50');
  const target = parseVec3(viewpoint?.getAttribute('centerOfRotation') || palaceViewCenter.join(' '));
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

function stopAutoRotate({ reset = false } = {}) {
  if (autoRotateStart !== null && !reset) {
    autoRotateElapsed = performance.now() - autoRotateStart;
  }

  if (autoRotateId !== null) {
    cancelAnimationFrame(autoRotateId);
    autoRotateId = null;
  }

  autoRotateStart = null;
  if (reset) autoRotateElapsed = 0;
}

function startAutoRotate() {
  stopAutoRotate();
  if (!autoRotateEnabled) return;
  autoRotateStart = performance.now() - autoRotateElapsed;

  function tick(now) {
    const wrapper = document.getElementById('model-wrapper');
    if (!wrapper) { stopAutoRotate(); return; }
    autoRotateElapsed = now - autoRotateStart;
    const angle = (autoRotateElapsed / AUTO_ROTATE_PERIOD_MS) * (Math.PI * 2);
    const [cx, cy, cz] = palaceViewCenter;
    wrapper.setAttribute('center', `${cx} ${cy} ${cz}`);
    wrapper.setAttribute('rotation', `0 1 0 ${angle}`);
    autoRotateId = requestAnimationFrame(tick);
  }

  autoRotateId = requestAnimationFrame(tick);
}

function updateAutoRotateToggle() {
  const button = document.getElementById('auto-rotate-toggle');
  if (!button) return;

  button.textContent = autoRotateEnabled ? 'Ⅱ' : '▶';
  button.setAttribute('aria-pressed', String(autoRotateEnabled));
  button.setAttribute('aria-label', autoRotateEnabled ? '暫停自轉' : '播放自轉');
  button.setAttribute('title', autoRotateEnabled ? '暫停自轉' : '播放自轉');
}

function setAutoRotateEnabled(enabled) {
  autoRotateEnabled = enabled;
  updateAutoRotateToggle();

  if (enabled) startAutoRotate();
  else stopAutoRotate();
}

function initAutoRotateToggle() {
  const button = document.getElementById('auto-rotate-toggle');
  if (!button) return;

  updateAutoRotateToggle();
  button.addEventListener('click', () => {
    setAutoRotateEnabled(!autoRotateEnabled);
  });
}

function loadFolderModel(source, folder, filename) {
  stopAutoRotate({ reset: true });
  cachedModelBounds = null;

  setActiveModelListItem({ source, filename });

  const requestId = ++modelLoadRequestId;
  activeModelKey = `${source}:${filename}`;
  updateReferenceImageAvailability();
  updateUrlModelKey(activeModelKey);
  palaceViewCenter = [0, 0, 0];
  palaceViewDistance = 80;

  const viewpoint = getMainViewpoint();
  if (viewpoint) {
    viewpoint.setAttribute('position', '0 0 80');
    viewpoint.setAttribute('orientation', '0 1 0 0');
    viewpoint.setAttribute('centerOfRotation', '0 0 0');
    viewpoint.setAttribute('fieldOfView', '0.7');
  }

  setModelSwitchLoading(true);
  setViewerStatus('載入中');

  const currentWrapper = document.getElementById('model-wrapper');
  if (currentWrapper) currentWrapper.remove();

  const wrapper = document.createElement('transform');
  wrapper.id = 'model-wrapper';
  wrapper.setAttribute('scale', '1 1 1');
  wrapper.setAttribute('translation', '0 0 0');

  const modelKey = `${source}:${filename}`;
  const modelUrl = FOLDER_MODEL_URL_OVERRIDES[modelKey] || `${folder}/${filename}.x3d`;

  if (INLINE_FOLDER_MODEL_KEYS.has(modelKey)) {
    const inline = document.createElement('inline');
    inline.setAttribute('url', modelUrl);

    const nudgeLoadWatcher = startPalaceLoadWatcher(requestId, startAutoRotate);
    ['load', 'loaded', 'x3domload'].forEach(eventName => {
      inline.addEventListener(eventName, () => {
        window.setTimeout(nudgeLoadWatcher, 500);
      });
    });
    inline.addEventListener('error', error => {
      if (requestId !== modelLoadRequestId) return;
      console.error('X3D inline folder model load failed:', error);
      setModelSwitchLoading(false);
      setViewerStatus('載入失敗');
    });

    wrapper.appendChild(inline);
    targetScene.appendChild(wrapper);
    parseX3domNode(wrapper);
    return;
  }

  fetch(modelUrl)
    .then(response => {
      if (!response.ok) throw new Error(`${modelUrl} returned ${response.status}`);
      return response.text();
    })
    .then(text => {
      if (requestId !== modelLoadRequestId) return;

      const x3dDoc = new DOMParser().parseFromString(text, 'application/xml');
      const parseError = x3dDoc.querySelector('parsererror');
      if (parseError) throw new Error(`${modelUrl} could not be parsed`);

      applyDefaultWoodMaterial(x3dDoc);
      importX3dSceneChildren(x3dDoc, wrapper);
      targetScene.appendChild(wrapper);
      reloadX3dom();

      const nudgeLoadWatcher = startPalaceLoadWatcher(requestId, startAutoRotate);
      window.setTimeout(nudgeLoadWatcher, 100);
    })
    .catch(error => {
      if (requestId !== modelLoadRequestId) return;
      console.error('X3D folder model load failed:', error);
      setModelSwitchLoading(false);
      setViewerStatus('載入失敗');
    });
}

function loadX3dModel(filename) {
  loadFolderModel('x3d', 'X3D', filename);
}

function loadPalaceViewModel(filename) {
  loadFolderModel('palace-view', 'X3D', filename);
}

function updateReferenceImageToggle() {
  const button = document.getElementById('reference-image-toggle');
  if (!button) return;

  button.setAttribute('aria-pressed', String(referenceImageEnabled));
  const label = referenceImageEnabled ? 'Hide reference image' : 'Show reference image';
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);

  const slider = document.getElementById('reference-z-slider');
  if (slider) slider.classList.toggle('is-visible', referenceImageEnabled);
}

function isReferenceImageModelActive() {
  return activeModelKey === REFERENCE_IMAGE_MODEL_KEY;
}

function updateReferenceImageAvailability() {
  const button = document.getElementById('reference-image-toggle');
  const available = isReferenceImageModelActive();
  if (button) button.classList.toggle('is-visible', available);

  if (!available && referenceImageEnabled) {
    referenceImageEnabled = false;
    removeFacadeReferenceImage();
  }

  updateReferenceImageToggle();
}

function initReferenceImageToggle() {
  const button = document.getElementById('reference-image-toggle');
  const slider = document.getElementById('reference-z-slider');
  if (!button) return;

  updateReferenceImageAvailability();
  button.addEventListener('click', () => {
    referenceImageEnabled = !referenceImageEnabled;
    if (referenceImageEnabled && slider) {
      referenceImageZPercent = Number(slider.value);
    }
    updateReferenceImageToggle();
    buildFacadeReferenceImage();
  });

  if (slider) {
    slider.addEventListener('input', () => {
      referenceImageZPercent = Number(slider.value);
      buildFacadeReferenceImage();
    });
  }
}

function initSidebar() {
  const list = document.getElementById('model-list');
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('model-sidebar');
  if (!list || !toggle || !sidebar) return;

  function createFolder(label, models, source, onSelect) {
    const folderItem = document.createElement('li');
    folderItem.className = 'model-folder';

    const folderButton = document.createElement('button');
    folderButton.className = 'model-folder-toggle';
    folderButton.type = 'button';
    folderButton.setAttribute('aria-expanded', 'true');

    const icon = document.createElement('span');
    icon.className = 'model-folder-icon';
    icon.textContent = '▾';

    const text = document.createElement('span');
    text.textContent = label;

    folderButton.append(icon, text);
    folderItem.appendChild(folderButton);

    const children = document.createElement('ul');
    children.className = 'model-folder-children';
    children.setAttribute('role', 'group');

    models.forEach(filename => {
      const li = document.createElement('li');
      li.className = 'model-item';
      li.dataset.source = source;
      li.dataset.filename = filename;
      li.setAttribute('role', 'option');

      const button = document.createElement('button');
      button.className = 'model-item-button';
      button.type = 'button';
      button.textContent = filename;
      button.setAttribute('title', `${label}/${filename}.x3d`);
      button.addEventListener('click', () => onSelect(filename));

      li.appendChild(button);
      children.appendChild(li);
    });

    folderButton.addEventListener('click', () => {
      const collapsed = folderItem.classList.toggle('is-collapsed');
      folderButton.setAttribute('aria-expanded', String(!collapsed));
      icon.textContent = collapsed ? '▸' : '▾';
    });

    folderItem.appendChild(children);
    list.appendChild(folderItem);
  }

  createFolder('Palace View', typeof PALACE_VIEW_MODELS !== 'undefined' ? PALACE_VIEW_MODELS : [], 'palace-view', loadPalaceViewModel);
  createFolder('X3D', typeof X3D_MODELS !== 'undefined' ? X3D_MODELS : [], 'x3d', loadX3dModel);

  toggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-label', isOpen ? '收起選單' : '展開選單');
    toggle.innerHTML = isOpen ? '&#8249;' : '&#9776;';
  });
}

function initRequestedModel() {
  const params = new URLSearchParams(window.location.search);
  const requestedModel = params.get('model');
  if (!requestedModel) return;

  if (requestedModel.startsWith('x3d:')) {
    const filename = requestedModel.slice(4);
    if ((typeof X3D_MODELS === 'undefined') || !X3D_MODELS.includes(filename)) return;
    loadX3dModel(filename);
    return;
  }

  if (requestedModel.startsWith('palace-view:')) {
    const filename = requestedModel.slice(12);
    if ((typeof PALACE_VIEW_MODELS === 'undefined') || !PALACE_VIEW_MODELS.includes(filename)) return;
    loadPalaceViewModel(filename);
    return;
  }

  if (typeof MODEL_CONFIGS !== 'undefined' && MODEL_CONFIGS[requestedModel]) {
    loadModel(requestedModel);
  }
}

initCameraAxisWidget();
initAutoRotateToggle();
initReferenceImageToggle();
initSidebar();
initRequestedModel();
