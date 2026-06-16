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
let activeModelKey = 'palace';
let modelLoadRequestId = 0;
let palaceViewCenter = [0, 8, 0];
let palaceViewDistance = 80;

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

function setViewerStatus(message) {
  const status = document.getElementById('viewer-status');
  if (!status) return;

  status.textContent = message || '';
  status.classList.toggle('is-visible', Boolean(message));
}

function setModelSwitchLoading(isLoading) {
  document.title = isLoading ? 'Loading Palace Viewer' : 'Palace Viewer';
}

function reloadX3dom() {
  if (window.x3dom) x3dom.reload();
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

function updatePalaceViewFromBounds() {
  const bounds = getModelWrapperBounds();
  if (!bounds) return false;

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

function schedulePalaceFrontView(duration = 9000) {
  const startedAt = performance.now();

  function tick() {
    applyPalaceFrontView();
    if (performance.now() - startedAt < duration) {
      window.setTimeout(tick, 500);
    }
  }

  tick();
}

function startPalaceLoadWatcher(requestId) {
  const startedAt = performance.now();
  let finished = false;
  let attempts = 0;

  function finish() {
    if (finished || requestId !== modelLoadRequestId) return;
    finished = true;
    schedulePalaceFrontView();
    setModelSwitchLoading(false);
    setViewerStatus('');
  }

  function tick() {
    if (finished || requestId !== modelLoadRequestId) return;

    attempts += 1;
    const elapsed = performance.now() - startedAt;
    const fitted = attempts > 2 ? applyPalaceFrontView() : false;

    if (fitted && elapsed > 1200) {
      finish();
      return;
    }

    if (elapsed > 16000) {
      finish();
      return;
    }

    window.setTimeout(tick, 500);
  }

  window.setTimeout(tick, 500);
  return finish;
}

function loadModel(modelKey) {
  const config = MODEL_CONFIGS[modelKey];
  if (!config || !targetScene) return;

  const requestId = ++modelLoadRequestId;
  activeModelKey = modelKey;
  updateUrlModelKey(modelKey);
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
  const finishLoading = startPalaceLoadWatcher(requestId);
  ['load', 'loaded', 'x3domload'].forEach(eventName => {
    inline.addEventListener(eventName, () => {
      window.setTimeout(finishLoading, 500);
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

initCameraAxisWidget();
loadModel(activeModelKey);
