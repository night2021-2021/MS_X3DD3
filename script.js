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
   Highlight system: connect D3 nodes to X3D shapes
───────────────────────────────────────── */
const TYPE_DEFS = {
  '栱': ['Dou_01','Dou_02','Dou_03','Dou_04'],
  '斗': ['Gong_01',
         'Gong_02-1','Gong_02-2','Gong_02-3','Gong_02-4',
         'Gong_03-1','Gong_03-2','Gong_03-3','Gong_03-4',
         'Gong_03-5','Gong_03-6','Gong_03-7','Gong_03-8'],
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
  'Dou_01':   { zh: '栱', sub: '泥道栱' },
  'Dou_02':   { zh: '栱', sub: '瓜子栱' },
  'Dou_03':   { zh: '栱', sub: '瓜子栱' },
  'Dou_04':   { zh: '栱', sub: '慢栱'   },
  'Gong_01':  { zh: '斗', sub: '坐斗'   },
  'Gong_02-1':{ zh: '斗', sub: '散斗'   },
  'Gong_02-2':{ zh: '斗', sub: '散斗'   },
  'Gong_02-3':{ zh: '斗', sub: '散斗'   },
  'Gong_02-4':{ zh: '斗', sub: '散斗'   },
  'Gong_03-1':{ zh: '斗', sub: '散斗'   },
  'Gong_03-2':{ zh: '斗', sub: '散斗'   },
  'Gong_03-3':{ zh: '斗', sub: '散斗'   },
  'Gong_03-4':{ zh: '斗', sub: '散斗'   },
  'Gong_03-5':{ zh: '斗', sub: '散斗'   },
  'Gong_03-6':{ zh: '斗', sub: '散斗'   },
  'Gong_03-7':{ zh: '斗', sub: '散斗'   },
  'Gong_03-8':{ zh: '斗', sub: '散斗'   },
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
fetch('05-5.x3d')
  .then(r => r.text())
  .then(text => {
    const parser = new DOMParser();
    const x3dDoc = parser.parseFromString(text, 'application/xml');
    const srcScene = x3dDoc.querySelector('Scene');

    // wrapper keeps original scale/position
    const wrapper = document.createElement('transform');
    wrapper.setAttribute('scale', '10 10 10');
    wrapper.setAttribute('translation', '0 -10 0');

    Array.from(srcScene.children).forEach(child => {
      const skip = ['NavigationInfo','Background'].includes(child.tagName);
      if (!skip) wrapper.appendChild(document.importNode(child, true));
    });
    targetScene.appendChild(wrapper);
    setTimeout(() => { initHighlightSystem(); initHoverSystem(); }, 300);
  })
  .catch(err => console.error('X3D load failed:', err));


/* ─────────────────────────────────────────
   Resizable split
───────────────────────────────────────── */
(function () {
  const resizer   = document.getElementById('resizer');
  const leftPanel = document.getElementById('left-panel');
  let dragging = false, startX, startW;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    startW = leftPanel.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.max(200, Math.min(window.innerWidth - 200, startW + e.clientX - startX));
    leftPanel.style.width = w + 'px';
    // notify X3DOM to resize
    if (window.x3dom) x3dom.reload();
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
})();


/* ─────────────────────────────────────────
   D3 Graph Editor
───────────────────────────────────────── */
(function () {
  const svg  = d3.select('#graph-svg');
  const hint = document.getElementById('mode-hint');

  /* ── State ── */
  let MODE   = 'select';
  let nodes  = [];
  let links  = [];
  let nodeId = 0;
  let selected = null;
  let edgeSrc  = null;

  /* ── Layers ── */
  const linkG    = svg.append('g');
  const nodeG    = svg.append('g');
  const dragLine = svg.append('line').attr('id', 'drag-line').style('display', 'none');

  /* ── Simulation ── */
  const sim = d3.forceSimulation(nodes)
    .force('link',    d3.forceLink(links).id(d => d.id).distance(130))
    .force('charge',  d3.forceManyBody().strength(-320))
    .force('collide', d3.forceCollide(42))
    .alphaDecay(0.02)
    .on('tick', ticked);

  /* ── Keyboard shortcuts ── */
  const HINTS = {
    select: 'V 選取  N 新增節點  E 連接邊  Del 刪除選取',
    node:   'N 新增節點 — 點擊空白處  |  V 切回選取',
    edge:   'E 連接邊 — 點起點再點終點  |  Esc 取消',
    delete: 'Del 刪除 — 點擊節點或邊  |  V 切回選取',
  };
  function setMode(m) {
    MODE = m; edgeSrc = null; dragLine.style('display', 'none');
    svg.style('cursor', m === 'node' ? 'cell' : 'default');
    hint.textContent = HINTS[m] || '';
  }
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'v' || e.key === 'V') setMode('select');
    if (e.key === 'n' || e.key === 'N') setMode('node');
    if (e.key === 'e' || e.key === 'E') setMode('edge');
    if (e.key === 'Escape') { edgeSrc = null; dragLine.style('display', 'none'); setMode('select'); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) deleteSelected();
  });

  /* ── SVG background click ── */
  svg.on('click', function (event) {
    if (event.target !== this) return;
    if (MODE === 'node') addNode(event);
    else deselect();
    edgeSrc = null; dragLine.style('display', 'none');
  });

  svg.on('mousemove', function (event) {
    if (MODE === 'edge' && edgeSrc) {
      const [x, y] = d3.pointer(event, this);
      dragLine.attr('x2', x).attr('y2', y);
    }
  });

  /* ── CRUD ── */
  function addNode(event) {
    const [x, y] = d3.pointer(event, svg.node());
    nodes.push({ id: ++nodeId, label: `節點${nodeId}`, x, y });
    restart(); sim.alpha(0.3).restart();
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected._type === 'node') {
      nodes = nodes.filter(d => d !== selected);
      links = links.filter(l => l.source !== selected && l.target !== selected);
    } else {
      links = links.filter(l => l !== selected);
    }
    selected = null; restart(); sim.alpha(0.3).restart();
  }

  function deselect() {
    selected = null;
    nodeG.selectAll('.node').classed('selected', false);
    linkG.selectAll('.link').classed('selected', false);
    if (window.clearHighlight) window.clearHighlight();
  }

  /* ── Render ── */
  let linkSel, nodeSel;

  function restart() {
    /* Links */
    linkSel = linkG.selectAll('.link')
      .data(links, d => `${d.source.id ?? d.source}-${d.target.id ?? d.target}`);
    linkSel.exit().remove();
    linkSel = linkSel.enter().append('line').attr('class', 'link')
      .on('click', function (ev, d) {
        ev.stopPropagation();
        if (MODE === 'delete') { links = links.filter(l => l !== d); restart(); sim.alpha(0.1).restart(); return; }
        deselect(); d._type = 'link'; selected = d;
        d3.select(this).classed('selected', true);
      })
      .merge(linkSel);

    /* Nodes */
    nodeSel = nodeG.selectAll('.node').data(nodes, d => d.id);
    nodeSel.exit().remove();
    const enter = nodeSel.enter().append('g').attr('class', 'node')
      .call(d3.drag().on('start', dragStart).on('drag', dragged).on('end', dragEnd))
      .on('click', nodeClick);
    enter.append('circle').attr('r', 30);
    enter.append('text').attr('dy', 4).attr('text-anchor', 'middle');
    nodeSel = enter.merge(nodeSel);
    nodeSel.select('text').text(d => d.label);

    sim.nodes(nodes);
    sim.force('link').links(links);
    sim.alpha(0.1).restart();
  }

  function ticked() {
    if (!linkSel || !nodeSel) return;
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  /* ── Node interaction ── */
  function nodeClick(ev, d) {
    ev.stopPropagation();
    if (MODE === 'delete') {
      nodes = nodes.filter(n => n !== d);
      links = links.filter(l => l.source !== d && l.target !== d);
      selected = null; restart(); sim.alpha(0.3).restart(); return;
    }
    if (MODE === 'edge') {
      if (!edgeSrc) {
        edgeSrc = d;
        dragLine.style('display', null).attr('x1', d.x).attr('y1', d.y).attr('x2', d.x).attr('y2', d.y);
      } else if (edgeSrc !== d) {
        const dup = links.some(l =>
          (l.source === edgeSrc && l.target === d) || (l.source === d && l.target === edgeSrc));
        if (!dup) links.push({ source: edgeSrc, target: d, _type: 'link' });
        edgeSrc = null; dragLine.style('display', 'none');
        restart(); sim.alpha(0.3).restart();
      }
      return;
    }
    deselect(); d._type = 'node'; selected = d;
    d3.select(this).classed('selected', true);
    if (window.highlightType && d.type) window.highlightType(d.type);
  }

  function dragStart(ev, d) {
    if (MODE === 'edge') return;
    if (!ev.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(ev, d) {
    if (MODE === 'edge') return;
    d.fx = ev.x; d.fy = ev.y;
  }
  function dragEnd(ev, d) {
    if (MODE === 'edge') return;
    if (!ev.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  /* ── Seed: 斗 / 栱 ── */
  const svgEl = document.getElementById('graph-svg');
  const w = svgEl.clientWidth  || 200;
  const h = svgEl.clientHeight || 600;
  const r = Math.min(w, h) * 0.28;
  [{ label: '斗', type: '斗' }, { label: '栱', type: '栱' }].forEach((s, i) => {
    const a = (i / 2) * 2 * Math.PI;
    nodes.push({ id: ++nodeId, label: s.label, type: s.type,
                 x: w / 2 + r * Math.cos(a), y: h / 2 + r * Math.sin(a) });
  });
  links.push({ source: nodes[0], target: nodes[1], _type: 'link' });
  restart();
  setMode('select');
})();
