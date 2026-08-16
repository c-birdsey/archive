import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { select, pointer } from "d3-selection";
import { buildNetworkGraph } from "../data/network.js";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";
import { filterLabelFor } from "../data/filters.js";

// Every node/edge kind this page knows how to draw and connect. Kept here
// rather than derived, since the shapes themselves (unlike descriptor
// fields) are a fixed part of this page's visual language, not archive data.
const ENTRY_SHAPE_BY_PRIMATIVE = {
  Physical: "square",
  Representational: "triangle",
  Discursive: "pentagon",
};

const LINK_DISTANCE = { attribute: 42, family: 55, related: 30 };
const LINK_STRENGTH = { attribute: 0.25, family: 0.4, related: 0.6 };

const ENTRY_RADIUS = 6;
const FOCUS_DIM_ALPHA = 0.15;
const LABEL_FONT_SIZE = 11;
const LABEL_FADE_START_K = 0.4;
const LABEL_FADE_END_K = 1.0;
const HIT_TOLERANCE_PX = 6;
const DRAG_CLICK_THRESHOLD_PX = 4;
const TOTAL_PREWARM_TICKS = 300;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// d3-force replaces link.source/target (string ids, as built by
// buildNetworkGraph) with references to the actual node objects once the
// simulation initializes -- this reads either form back to a plain id.
function endpointId(end) {
  return typeof end === "string" ? end : end.id;
}

function nodeRadius(node) {
  if (node.kind === "entry") return ENTRY_RADIUS;
  if (node.kind === "family") return clamp(3.5 + Math.sqrt(node.degree) * 1.4, 3.5, 11);
  return clamp(2 + Math.sqrt(node.degree) * 1.3, 2, 9);
}

// A world-space size that keeps growing on screen as you zoom in past 1x
// (never shrinking below its 1x size) but sub-linearly rather than
// tracking the canvas scale directly -- otherwise both shapes and labels
// balloon unboundedly at high zoom. Shapes and labels both run through
// this so they keep growing in proportion to each other at any zoom
// level, rather than one outpacing the other.
function taperedWorldSize(base, k) {
  return k <= 1 ? base : base / Math.sqrt(k);
}

function drawPolygon(ctx, cx, cy, r, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function traceNodeShape(ctx, node, cx, cy, r) {
  if (node.kind === "attribute") {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    return;
  }
  if (node.kind === "family") {
    drawPolygon(ctx, cx, cy, r, 4, -Math.PI / 2); // diamond
    return;
  }
  const shape = ENTRY_SHAPE_BY_PRIMATIVE[node.primative];
  if (shape === "square") {
    ctx.beginPath();
    ctx.rect(cx - r, cy - r, r * 2, r * 2);
  } else if (shape === "triangle") {
    drawPolygon(ctx, cx, cy, r, 3, -Math.PI / 2);
  } else if (shape === "pentagon") {
    drawPolygon(ctx, cx, cy, r, 5, -Math.PI / 2);
  } else {
    // Legacy/missing primative -- still an entry, just an undecorated one.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

export default function NetworkPage({ entries, families }) {
  const descriptorFields = useDescriptorFields(true);
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const transformRef = useRef(zoomIdentity);
  const zoomBehaviorRef = useRef(null);
  const dragNodeRef = useRef(null);
  const downRef = useRef(null); // { x, y, node }

  // Selection drives both the canvas focus/dim effect and the detail
  // panel's visibility -- closing the panel clears the highlight too.
  const [selectedId, setSelectedId] = useState(null);
  // Isolating a primative from the legend is a second, mutually exclusive
  // way to drive the same focus/dim effect -- picking one clears the
  // other, and only one of node-selection/primative-isolation is ever
  // "the" focus at a time.
  const [primativeFilter, setPrimativeFilter] = useState(null);
  const selectedRef = useRef(null);
  const focusSetRef = useRef(null);
  const drawRef = useRef(null);

  const [settleProgress, setSettleProgress] = useState(0);
  const [settled, setSettled] = useState(false);

  const graph = useMemo(() => buildNetworkGraph({ entries, families }), [entries, families]);

  const nodeById = useMemo(() => {
    const map = new Map();
    for (const n of graph.nodes) map.set(n.id, n);
    return map;
  }, [graph]);

  const selectedNode = selectedId ? nodeById.get(selectedId) || null : null;

  // 1-hop neighborhood of the selected node, for both the dim-everything-
  // else focus effect on canvas and the grouped relationship lists in the
  // detail panel.
  const focusLinks = useMemo(() => {
    if (!selectedId) return [];
    return graph.links.filter(
      (l) => endpointId(l.source) === selectedId || endpointId(l.target) === selectedId
    );
  }, [graph, selectedId]);

  const focusSet = useMemo(() => {
    if (primativeFilter) {
      return new Set(
        graph.nodes.filter((n) => n.kind === "entry" && n.primative === primativeFilter).map((n) => n.id)
      );
    }
    if (!selectedId) return null;
    const set = new Set([selectedId]);
    for (const l of focusLinks) {
      set.add(endpointId(l.source));
      set.add(endpointId(l.target));
    }
    return set;
  }, [selectedId, focusLinks, primativeFilter, graph]);

  useEffect(() => {
    setSettled(false);
    setSettleProgress(0);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      draw();
    }

    function hitTest(worldX, worldY) {
      const tolerance = HIT_TOLERANCE_PX / transformRef.current.k;
      let best = null;
      let bestDist = Infinity;
      for (const node of graph.nodes) {
        if (node.x == null) continue;
        const dx = node.x - worldX, dy = node.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= nodeRadius(node) + tolerance && dist < bestDist) {
          best = node;
          bestDist = dist;
        }
      }
      return best;
    }

    function draw() {
      const tf = transformRef.current;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(tf.x, tf.y);
      ctx.scale(tf.k, tf.k);

      const focus = focusSetRef.current;
      const labelAlpha = clamp((tf.k - LABEL_FADE_START_K) / (LABEL_FADE_END_K - LABEL_FADE_START_K), 0, 1);
      const labelWorldSize = taperedWorldSize(LABEL_FONT_SIZE, tf.k);

      ctx.lineWidth = 1 / tf.k;
      for (const l of graph.links) {
        const s = nodeById.get(endpointId(l.source));
        const t = nodeById.get(endpointId(l.target));
        if (!s || !t || s.x == null || t.x == null) continue;
        const dimmed = focus && !(focus.has(s.id) && focus.has(t.id));
        ctx.globalAlpha = dimmed ? FOCUS_DIM_ALPHA : 0.55;
        ctx.strokeStyle = "#000";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }

      for (const node of graph.nodes) {
        if (node.x == null) continue;
        // The drawn size tapers at high zoom same as labels (see
        // taperedWorldSize) -- hitTest/collision below keep using the true
        // nodeRadius() so click targets and node spacing stay put
        // regardless of zoom, only the rendered size is tempered.
        const r = taperedWorldSize(nodeRadius(node), tf.k);
        const dimmed = focus && !focus.has(node.id);
        ctx.globalAlpha = dimmed ? FOCUS_DIM_ALPHA : 1;

        traceNodeShape(ctx, node, node.x, node.y, r);
        if (node.kind === "attribute" && node.attrKey !== "tag") {
          ctx.fillStyle = "#000";
          ctx.fill();
        } else {
          ctx.lineWidth = (node.id === selectedRef.current ? 2.2 : 1.4) / tf.k;
          ctx.strokeStyle = "#000";
          ctx.stroke();
        }

        const textAlpha = dimmed ? Math.min(labelAlpha, FOCUS_DIM_ALPHA) : labelAlpha;
        if (textAlpha > 0.02) {
          ctx.globalAlpha = textAlpha;
          ctx.fillStyle = "#000";
          ctx.font = `${labelWorldSize.toFixed(2)}px Inter, sans-serif`;
          ctx.textBaseline = "top";
          ctx.fillText(node.label, node.x + r + 4, node.y - 4);
        }
      }

      ctx.restore();
    }
    drawRef.current = draw;

    const linkForce = forceLink(graph.links)
      .id((d) => d.id)
      .distance((l) => LINK_DISTANCE[l.kind])
      .strength((l) => LINK_STRENGTH[l.kind]);

    const sim = forceSimulation(graph.nodes)
      .force("link", linkForce)
      .force("charge", forceManyBody().strength((d) => (d.kind === "entry" ? -46 : -30 - d.degree * 8)).distanceMax(600))
      .force("collide", forceCollide().radius((d) => nodeRadius(d) + 4))
      .force("x", forceX(0).strength(0.02))
      .force("y", forceY(0).strength(0.02))
      .alpha(1)
      .alphaDecay(0.022)
      .velocityDecay(0.36);
    sim.stop();

    function fitView() {
      if (graph.nodes.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of graph.nodes) {
        if (n.x == null) continue;
        minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
      }
      const margin = 60;
      const boxW = Math.max(maxX - minX, 1) + margin * 2;
      const boxH = Math.max(maxY - minY, 1) + margin * 2;
      const k = clamp(Math.min(W / boxW, H / boxH), 0.15, 4);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const next = zoomIdentity.translate(W / 2 - cx * k, H / 2 - cy * k).scale(k);
      zoomBehaviorRef.current.transform(select(canvas), next);
    }

    let cancelled = false;
    function prewarm() {
      let n = 0;
      function chunk() {
        if (cancelled) return;
        for (let i = 0; i < 30 && n < TOTAL_PREWARM_TICKS; i++, n++) sim.tick();
        setSettleProgress(Math.round((100 * n) / TOTAL_PREWARM_TICKS));
        draw();
        if (n < TOTAL_PREWARM_TICKS) {
          requestAnimationFrame(chunk);
        } else {
          setSettled(true);
          fitView();
          sim.alpha(0.2).alphaTarget(0).restart();
          sim.on("tick", draw);
        }
      }
      requestAnimationFrame(chunk);
    }

    const zoomBehavior = d3zoom()
      .scaleExtent([0.15, 6])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.button) return false;
        const [px, py] = pointer(event, canvas);
        const world = transformRef.current.invert([px, py]);
        return hitTest(world[0], world[1]) === null;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });
    zoomBehaviorRef.current = zoomBehavior;
    select(canvas).call(zoomBehavior);

    function onPointerDown(event) {
      const [px, py] = pointer(event, canvas);
      const world = transformRef.current.invert([px, py]);
      const hit = hitTest(world[0], world[1]);
      downRef.current = { x: event.clientX, y: event.clientY, node: hit };
      if (hit) {
        dragNodeRef.current = hit;
        hit.fx = hit.x;
        hit.fy = hit.y;
        sim.alphaTarget(0.15).restart();
        canvas.classList.add("dragging");
        canvas.setPointerCapture(event.pointerId);
      }
    }

    function onPointerMove(event) {
      const [px, py] = pointer(event, canvas);
      const world = transformRef.current.invert([px, py]);

      if (dragNodeRef.current) {
        dragNodeRef.current.fx = world[0];
        dragNodeRef.current.fy = world[1];
        return;
      }

      const hit = hitTest(world[0], world[1]);
      const tip = tooltipRef.current;
      if (hit) {
        tip.textContent = hit.label;
        tip.style.left = `${event.clientX + 12}px`;
        tip.style.top = `${event.clientY + 12}px`;
        tip.style.display = "block";
        canvas.style.cursor = "pointer";
      } else {
        tip.style.display = "none";
        canvas.style.cursor = "grab";
      }
    }

    function onPointerUp(event) {
      const down = downRef.current;
      downRef.current = null;
      const dragged = dragNodeRef.current;
      if (dragged) {
        dragged.fx = null;
        dragged.fy = null;
        sim.alphaTarget(0);
        canvas.classList.remove("dragging");
        dragNodeRef.current = null;
      }
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      if (moved > DRAG_CLICK_THRESHOLD_PX) return; // was a pan/drag, not a click
      setSelectedId(down.node ? down.node.id : null);
      setPrimativeFilter(null);
    }

    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    resize();
    prewarm();

    return () => {
      cancelled = true;
      sim.stop();
      drawRef.current = null;
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    // selectedId/focusSet are intentionally excluded -- draw() reads them
    // through selectedRef/focusSetRef (kept in sync by the effect below)
    // rather than closing over them directly, so a selection change redraws
    // without tearing down and re-settling the whole simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nodeById]);

  // Keeps draw()'s refs in sync with the latest selection and asks for a
  // redraw -- selection changes are frequent (any click) and shouldn't
  // rebuild the simulation, so they're handled here rather than as a
  // dependency of the effect above.
  useEffect(() => {
    selectedRef.current = selectedId;
    focusSetRef.current = focusSet;
    drawRef.current?.();
  }, [selectedId, focusSet]);

  function fitToScreen() {
    const canvas = canvasRef.current;
    if (!canvas || !zoomBehaviorRef.current) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of graph.nodes) {
      if (n.x == null) continue;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    if (minX === Infinity) return;
    const margin = 60;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const boxW = Math.max(maxX - minX, 1) + margin * 2;
    const boxH = Math.max(maxY - minY, 1) + margin * 2;
    const k = clamp(Math.min(W / boxW, H / boxH), 0.15, 4);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const next = zoomIdentity.translate(W / 2 - cx * k, H / 2 - cy * k).scale(k);
    zoomBehaviorRef.current.transform(select(canvas), next);
  }

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchWrapRef = useRef(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
  }, [graph, searchQuery]);

  function selectFromSearch(id) {
    setSelectedId(id);
    setPrimativeFilter(null);
    setSearchOpen(false);
    setSearchQuery("");
  }

  function toggleFilterFromLegend(primative) {
    setSelectedId(null);
    setPrimativeFilter((current) => (current === primative ? null : primative));
  }

  // Closes the search field on an outside click, same pattern
  // CreatableSelect uses for its own dropdown -- listening on the capture
  // phase (the `true` argument) rather than bubble, so this still fires
  // even if a click lands on the canvas, where d3-zoom's own pointer
  // handling could otherwise intercept the event on the way up.
  useEffect(() => {
    if (!searchOpen) return;
    function onDown(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!infoOpen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setInfoOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [infoOpen]);

  return (
    <div className="network-stage">
      <canvas ref={canvasRef} />
      <div ref={tooltipRef} className="network-tooltip" />

      {!settled && (
        <div className="network-loading">Settling network — {settleProgress}%</div>
      )}

      <div className="network-topright">
        <div className="network-search" ref={searchWrapRef}>
          {searchOpen ? (
            <>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="network-search-input"
                autoComplete="off"
              />
              {searchResults.length > 0 && (
                <div className="creatable-menu network-search-menu">
                  {searchResults.map((n) => (
                    <button
                      type="button"
                      key={n.id}
                      className="creatable-option"
                      onMouseDown={(e) => { e.preventDefault(); selectFromSearch(n.id); }}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => setSearchOpen(true)}>Search</button>
          )}
        </div>
        <button type="button" className="link-btn" onClick={() => setInfoOpen(true)}>Info</button>
      </div>

      <button type="button" className="link-btn network-fit-btn" onClick={fitToScreen}>Fit to Screen</button>

      <div className="network-legend">
        <LegendItem
          shape="square" label="Physical"
          active={primativeFilter === "Physical"}
          onClick={() => toggleFilterFromLegend("Physical")}
        />
        <LegendItem
          shape="triangle" label="Representational"
          active={primativeFilter === "Representational"}
          onClick={() => toggleFilterFromLegend("Representational")}
        />
        <LegendItem
          shape="pentagon" label="Discursive"
          active={primativeFilter === "Discursive"}
          onClick={() => toggleFilterFromLegend("Discursive")}
        />
        <LegendItem shape="diamond" label="Family" />
        <LegendItem shape="ring" label="Tag" />
        <LegendItem shape="dot" label="Attribute" />
      </div>

      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          links={focusLinks}
          nodeById={nodeById}
          descriptorFields={descriptorFields}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {infoOpen && (
        <div className="overlay network-info-overlay" onClick={(e) => { if (!e.target.closest("a, button")) setInfoOpen(false); }}>
          <button type="button" className="overlay-close overlay-close-floating" onClick={() => setInfoOpen(false)}>
            Close
          </button>
          <div className="info-content">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
              tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
              veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
              commodo consequat.
            </p>
            <p>Return to <Link to="/">the archive</Link>.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ shape, label, onClick, active }) {
  const icon = (
    <svg width="12" height="12" viewBox="-8 -8 16 16" className="network-legend-icon" aria-hidden="true">
      {shape === "square" && <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="#000" strokeWidth="1.3" />}
      {shape === "triangle" && <polygon points="0,-6 5.2,3 -5.2,3" fill="none" stroke="#000" strokeWidth="1.3" />}
      {shape === "pentagon" && <polygon points="0,-6 5.7,-1.9 3.5,4.9 -3.5,4.9 -5.7,-1.9" fill="none" stroke="#000" strokeWidth="1.3" />}
      {shape === "diamond" && <polygon points="0,-6 6,0 0,6 -6,0" fill="none" stroke="#000" strokeWidth="1.3" />}
      {shape === "ring" && <circle cx="0" cy="0" r="3.6" fill="none" stroke="#000" strokeWidth="1.3" />}
      {shape === "dot" && <circle cx="0" cy="0" r="3.6" fill="#000" />}
    </svg>
  );

  if (onClick) {
    return (
      <button type="button" className={active ? "network-legend-item active" : "network-legend-item"} onClick={onClick}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <span className="network-legend-item">
      {icon}
      {label}
    </span>
  );
}

// Groups the selected node's incident links into labeled sections for the
// panel. The label depends on both the link kind and which side `node`
// (the panel's own subject) is on -- a family link reads "Families" from an
// entry's panel (the families it belongs to) but "Entries" from a family's
// own panel (what it contains), and an attribute node's own links -- always
// all the same key as itself -- read as "Connections" rather than
// repeating the field label already shown above the title.
function buildRelationshipGroups(node, links, nodeById, descriptorFields) {
  const groups = new Map(); // label -> [node]
  for (const l of links) {
    const otherId = endpointId(l.source) === node.id ? endpointId(l.target) : endpointId(l.source);
    const other = nodeById.get(otherId);
    if (!other) continue;

    let label;
    if (l.kind === "related") {
      label = "Related Entries";
    } else if (l.kind === "family") {
      label = node.kind === "family" ? "Entries" : "Families";
    } else if (node.kind === "attribute") {
      label = "Connections";
    } else {
      label = filterLabelFor(other.attrKey, descriptorFields);
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(other);
  }
  return groups;
}

function NodeDetailPanel({ node, links, nodeById, descriptorFields, onSelect, onClose }) {
  const groups = useMemo(
    () => buildRelationshipGroups(node, links, nodeById, descriptorFields),
    [node, links, nodeById, descriptorFields]
  );

  const kindLabel = node.kind === "attribute"
    ? filterLabelFor(node.attrKey, descriptorFields)
    : node.kind === "family"
    ? "Family"
    : node.primative;

  return (
    <aside className="network-panel">
      <div className="network-panel-kindrow">
        <span className="network-panel-kind">{kindLabel}</span>
        <button type="button" className="network-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="detail-heading">{node.label}</p>

      {[...groups.entries()].map(([label, items]) => (
        <div className="network-rel-group" key={label}>
          <p className="network-rel-head">{label}</p>
          <div className="network-rel-list">
            {items.map((item) => (
              <button type="button" key={item.id} onClick={() => onSelect(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="network-actions">
        {node.kind === "entry" && (
          <Link className="link-btn" to={`/entry/${node.entry.id}`}>Open Entry →</Link>
        )}
        {node.kind === "attribute" && (
          <Link className="link-btn" to={`/index?d=${encodeURIComponent(node.attrKey)}:${encodeURIComponent(node.label)}`}>
            View in Index →
          </Link>
        )}
        {node.kind === "family" && (
          <Link className="link-btn" to={`/family/${node.family.id}`}>Open Family →</Link>
        )}
      </div>
    </aside>
  );
}
