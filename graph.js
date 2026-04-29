/* D3 graph editor */
(function () {
  const svg = d3.select('#graph-svg');
  const hint = document.getElementById('mode-hint');
  const svgEl = document.getElementById('graph-svg');

  let mode = 'select';   // 'select' | 'node' | 'edge' | 'delete'
  let nodes = [];
  let links = [];
  let nodeId = 0;
  let selected = null;
  let edgeSrc = null;

  const linkLayer = svg.append('g').attr('class', 'link-layer');
  const nodeLayer = svg.append('g').attr('class', 'node-layer');
  const dragLine = svg.append('line')
    .attr('id', 'drag-line')
    .style('display', 'none');

  const HINTS = {
    select: 'V 選取  N 新增節點  E 連接邊  Del 刪除',
    node: 'N模式：點空白處新增節點  |  V 返回',
    edge: 'E模式：點另一個節點連線  |  Esc 取消',
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

  svg.on('mousemove', function (ev) {
    if (mode !== 'edge' || !edgeSrc) return;
    const [x, y] = d3.pointer(ev, this);
    dragLine.attr('x2', x).attr('y2', y);
  });

  function addNode(x, y, label, type) {
    nodes.push({ id: ++nodeId, label: label ?? `節點${nodeId}`, type: type ?? null, x, y });
    render();
  }

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

  function syncAssembly() {
    if (!window.assembleType) return;
    nodes.forEach(node => {
      if (!node.type) return;
      const connected = links.some(l => l.source === node || l.target === node);
      if (connected) window.assembleType(node.type);
      else window.scatterType(node.type);
    });
  }

  function deselect() {
    selected = null;
    nodeLayer.selectAll('.node').classed('selected', false);
    linkLayer.selectAll('g.link').classed('selected', false);
    if (window.clearHighlight) window.clearHighlight();
  }

  let linkSel, nodeSel;

  function render() {
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
    linkEnter.append('line').attr('class', 'link-hit');
    linkEnter.append('line').attr('class', 'link-vis');
    linkSel = linkEnter.merge(linkSel);

    nodeSel = nodeLayer.selectAll('.node').data(nodes, d => d.id);
    nodeSel.exit().remove();

    const entered = nodeSel.enter().append('g').attr('class', 'node')
      .call(d3.drag()
        .on('start', onDragStart)
        .on('drag', onDragged)
        .on('end', onDragEnd))
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
          (l.source === d && l.target === edgeSrc));
        if (!dup) links.push({ source: edgeSrc, target: d, _type: 'link' });
        edgeSrc = null;
        dragLine.style('display', 'none');
        render();
        syncAssembly();
      }
      return;
    }

    deselect();
    d._type = 'node';
    selected = d;
    d3.select(this).classed('selected', true);
    if (window.highlightType && d.type) window.highlightType(d.type);
  }

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

  const W = svgEl.clientWidth || 200;
  const H = svgEl.clientHeight || 600;
  const R = Math.min(W, H) * 0.30;

  const SEEDS = [
    { label: '枓', type: '枓' },
    { label: '栱', type: '栱' },
    { label: '昂', type: '昂' },
    { label: '栿', type: '栿' },
    { label: '耍頭', type: '耍頭' },
    { label: '枋', type: '枋' },
  ];

  SEEDS.forEach((s, i) => {
    const angle = (i / SEEDS.length) * 2 * Math.PI - Math.PI / 2;
    nodes.push({
      id: ++nodeId,
      label: s.label,
      type: s.type,
      x: W / 2 + R * Math.cos(angle),
      y: H / 2 + R * Math.sin(angle),
    });
  });

  render();
  setMode('select');
})();
