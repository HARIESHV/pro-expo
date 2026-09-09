import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { GraphData, KnowledgeGraphNode, KnowledgeGraphEdge } from '../../types';
import { Fullscreen, Maximize2, Minimize2, ZoomIn, ZoomOut, Focus } from 'lucide-react';
import { cn } from '../../utils/cn';

export const NODE_COLORS: Record<string, string> = {
  customer: '#3b82f6',
  employee: '#8b5cf6',
  product: '#f59e0b',
  project: '#10b981',
  department: '#06b6d4',
  organization: '#f43f5e',
  region: '#84cc16',
  concept: '#a78bfa',
  event: '#fb923c',
  metric: '#34d399',
  document: '#6366f1',
  decision: '#ec4899',
  risk: '#ef4444',
  insight: '#2dd4bf',
  query: '#818cf8',
  conversation: '#c084fc',
  topic: '#facc15',
};

const FALLBACK_COLOR = '#6b7280';
const NODE_R = 27;
const HOVER_R = 32;
const SELECT_R = 35;
const EDGE_W = 1.7;
const MIN_K = 0.35;
const MAX_K = 3.5;

// Above this many nodes the canvas groups nearby nodes into expandable clusters
// so the overview stays readable and the UI remains responsive.
const CLUSTER_THRESHOLD = 700;
const CLUSTER_MAX_MEMBERS = 48;
const CLUSTER_DIST = 210;

interface CanvasTheme {
  base: string;
  top: string;
  glowA: string;
  glowB: string;
  glowC: string;
  dot: string;
  edge: string;
  edgeDim: string;
  edgeBright: string;
  edgeHover: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  nodeLabel: string;
  nodePill: string;
  nodePillBorder: string;
  fillAlpha: number;
  glowBase: number;
  glowHover: number;
  halo: string;
}

const LIGHT_THEME: CanvasTheme = {
    base: '#F6F5FB',
    top: '#EEEFFA',
    glowA: 'rgba(129,140,248,0.22)',
    glowB: 'rgba(196,181,253,0.18)',
    glowC: 'rgba(103,232,249,0.15)',
    dot: 'rgba(96,102,156,0.18)',
    edge: 'rgba(88,94,140,0.55)',
    edgeDim: 'rgba(88,94,140,0.22)',
    edgeBright: 'rgba(45,51,95,0.95)',
    edgeHover: '#4C5BB0',
    pillBg: 'rgba(255,255,255,0.9)',
    pillBorder: 'rgba(88,94,140,0.32)',
    pillText: '#2F3560',
    nodeLabel: '#23294D',
    nodePill: 'rgba(255,255,255,0.62)',
    nodePillBorder: 'rgba(88,94,140,0.24)',
    fillAlpha: 0.16,
    glowBase: 12,
    glowHover: 24,
    halo: 'rgba(246,245,251,0.72)',
};

function nodeColor(type: string): string {
  if (type.startsWith('cluster:')) return NODE_COLORS[type.slice('cluster:'.length)] || FALLBACK_COLOR;
  return NODE_COLORS[type] || FALLBACK_COLOR;
}
function clusterMajorityType(nodes: KnowledgeGraphNode[]): string {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) || 0) + 1);
  let best = 'concept'; let bestN = 0;
  for (const [t, c] of counts) if (c > bestN) { bestN = c; best = t; }
  return best;
}
function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export function edgeLabel(e: KnowledgeGraphEdge): string {
  const raw = e.label?.trim() || e.type || '';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Pos { x: number; y: number; vx: number; vy: number }
interface EdgeInfo {
  edge: KnowledgeGraphEdge;
  sign: number;
  offset: number;
}

// Anchored curve geometry for an edge. Starts/ends at the node borders (rFrom /
// rTo are the world-space radii of the endpoints) and curves to separate
// parallel relationships between the same two nodes. Shared by the renderer and
// the hit-tester so drawing and interaction always agree.
function edgeGeometry(
  pos: Map<string, Pos>,
  ei: EdgeInfo,
  rFrom: number,
  rTo: number
): { a: { x: number; y: number }; b: { x: number; y: number }; ctrl: { x: number; y: number } } | null {
  const a0 = pos.get(ei.edge.from);
  const b0 = pos.get(ei.edge.to);
  if (!a0 || !b0 || a0 === b0) return null;
  const d = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
  const ux = (b0.x - a0.x) / d;
  const uy = (b0.y - a0.y) / d;
  const sx = a0.x + ux * rFrom;
  const sy = a0.y + uy * rFrom;
  const ex = b0.x - ux * rTo;
  const ey = b0.y - uy * rTo;
  const seg = Math.hypot(ex - sx, ey - sy) || 1;
  const amp = clamp(seg * 0.18, 16, 54) * ei.sign * (1 + (ei.offset || 0) * 0.9);
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  return {
    a: { x: sx, y: sy },
    b: { x: ex, y: ey },
    ctrl: { x: mx - ((ey - sy) / seg) * amp, y: my + ((ex - sx) / seg) * amp },
  };
}

// World-space rendered radius of a node, matching the draw loop. Shared with the
// hit-tester so edge anchoring is identical everywhere.
function edgeNodeRadius(
  pos: Map<string, Pos>,
  id: string,
  selectedId: string | null,
  hoverNode: string | undefined,
  renderK: number,
  scale: number
): number | undefined {
  if (!pos.has(id)) return undefined;
  let base = (id.startsWith('cluster:') ? NODE_R * 1.9 : NODE_R) * scale;
  if (selectedId === id) base = Math.max(base, SELECT_R * scale);
  else if (hoverNode === id) base = Math.max(base, HOVER_R * scale);
  return base / renderK;
}

function hashKey(a: string, b: string): number {
  let h = 7;
  const s = a < b ? `${a}|${b}` : `${b}|${a}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildLayout(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]): Map<string, Pos> {
  const n = nodes.length;
  const pos = new Map<string, Pos>();
  if (!n) return pos;

  // Undirected adjacency for component detection + degree (centrality).
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const e of edges) {
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  const degree = new Map<string, number>();
  for (const node of nodes) degree.set(node.id, (adj.get(node.id) || []).length);

  // Connected components (BFS) so disconnected groups are laid out separately
  // instead of being forced together by a single shared centroid.
  const compIndex = new Map<string, number>();
  const components: string[][] = [];
  for (const node of nodes) {
    if (compIndex.has(node.id)) continue;
    const idx = components.length;
    const members: string[] = [];
    const queue = [node.id];
    compIndex.set(node.id, idx);
    while (queue.length) {
      const id = queue.pop()!;
      members.push(id);
      for (const nb of adj.get(id) || []) {
        if (compIndex.has(nb)) continue;
        compIndex.set(nb, idx);
        queue.push(nb);
      }
    }
    components.push(members);
  }

  // Virtual scene: one cell per component so disconnected groups stay apart and
  // the full graph floats in a stable, bounded space that fitTransform fits.
  //
  // The scene is sized from the expected packed extent of the layout so that a
  // grown-out graph never overflows its cell and gets squashed back afterwards.
  // High-degree hubs then fan their neighbours out on a ring, so a star graph is
  // much wider than a plain packed square; the cell holding the top hub is grown
  // to fit that fan-out ring too, otherwise it would be clamped right back.
  // A star graph is much wider than a plain packed square; the scene grows to
  // hold the top hub's fan-out ring once (from the fixed k) instead of letting
  // the scene size feed back into the spacing and diverging.
  //
  // Optimal edge length derived from the drawing area, so relative node spacing
  // stays proportional to the number of nodes (fitTransform normalizes this to
  // the viewport afterwards). It intentionally does NOT depend on the scene size:
  // the growing scene would otherwise feed back into an ever-larger spacing and
  // the whole layout would diverge.
  const k0 = Math.max(70, Math.sqrt((1500 * 1000) / Math.max(n, 1)) * 1.7);
  const k = k0;
  const minDistK = k * 1.05;
  const kN2 = k * k;

  // High-degree hubs fan their neighbours out on a ring. A star graph is much
  // wider than a plain packed square, so the scene grows to hold the top hub's
  // ring once (from the fixed k), and a dominating component occupies the whole
  // scene instead of a cramped corner of a grid.
  const topHubId = [...degree.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  let topFreeN = 0;
  if (topHubId) {
    const hood = adj.get(topHubId) || [];
    for (const nb of hood) if ((degree.get(nb) || 0) < 4) topFreeN++;
  }
  const topR = Math.max(minDistK, (topFreeN * minDistK * 1.2) / (2 * Math.PI));
  const maxComp = Math.max(...components.map((c) => c.length));
  const singleCell = maxComp > n / 2;
  const W = Math.max(1500, k * 1.05 * Math.sqrt(n) * 1.3, topR * 2 * 1.6);
  const H = Math.max(1000, W / 1.5);
  const cols = singleCell ? 1 : Math.ceil(Math.sqrt(components.length));
  const rows = singleCell ? 1 : Math.ceil(components.length / cols);
  const cellW = W / cols;
  const cellH = H / rows;
  const anchor = new Map<string, { x: number; y: number }>();
  components.forEach((members, ci) => {
    const cx = singleCell ? W / 2 : cellW * (ci % cols) + cellW / 2;
    const cy = singleCell ? H / 2 : cellH * Math.floor(ci / cols) + cellH / 2;
    for (const id of members) anchor.set(id, { x: cx, y: cy });
  });

  const ids = nodes.map((nd) => nd.id);
  const index = new Map<string, number>();
  ids.forEach((id, i) => index.set(id, i));
  for (let i = 0; i < n; i++) {
    const a = anchor.get(ids[i])!;
    pos.set(ids[i], {
      x: a.x + (Math.random() - 0.5) * cellW * 0.4,
      y: a.y + (Math.random() - 0.5) * cellH * 0.4,
      vx: 0,
      vy: 0,
    });
  }
  const posArr: Pos[] = [];
  for (let i = 0; i < n; i++) posArr.push(pos.get(ids[i])!);
  const disp = new Float64Array(n * 2);

  const t0 = Math.max(W, H) * 0.18;
  const MAX_ITERS = n > 500 ? 90 : n > 150 ? 200 : 280;

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const temp = Math.max(1.5, t0 * (1 - iter / MAX_ITERS));
    disp.fill(0);

    // Repulsion: full pairwise range so no node is allowed to sit inside another
    // node's disc regardless of distance. The previous grid only repelled within
    // a few cells, which let the whole graph collapse onto its centre.
    for (let i = 0; i < n; i++) {
      const pi = posArr[i];
      for (let j = i + 1; j < n; j++) {
        const pj = posArr[j];
        let dx = pi.x - pj.x;
        let dy = pi.y - pj.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = dx * dx + dy * dy || 0.01;
        }
        const d = Math.sqrt(d2);
        const f = kN2 / d;
        const ux = dx / d;
        const uy = dy / d;
        disp[i * 2] += ux * f;
        disp[i * 2 + 1] += uy * f;
        disp[j * 2] -= ux * f;
        disp[j * 2 + 1] -= uy * f;
      }
    }

    // Attraction along edges (structural, driven by the real relationships only).
    for (const e of edges) {
      const si = index.get(e.from);
      const ti = index.get(e.to);
      if (si === undefined || ti === undefined) continue;
      const ps = posArr[si];
      const pt = posArr[ti];
      let dx = ps.x - pt.x;
      let dy = ps.y - pt.y;
      let d = Math.hypot(dx, dy);
      if (d < 1e-3) d = 1e-3;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      disp[si * 2] -= ux * f;
      disp[si * 2 + 1] -= uy * f;
      disp[ti * 2] += ux * f;
      disp[ti * 2 + 1] += uy * f;
    }

    // Gravity toward the component anchor keeps disconnected groups in their own
    // cell; high-degree hubs are pulled slightly harder so central entities sit
    // closer to the middle of their group.
    for (let i = 0; i < n; i++) {
      const p = posArr[i];
      const a = anchor.get(ids[i])!;
      const g = 0.02 + 0.004 * Math.min(degree.get(ids[i]) || 0, 12);
      disp[i * 2] += (a.x - p.x) * g;
      disp[i * 2 + 1] += (a.y - p.y) * g;

      const dl = Math.hypot(disp[i * 2], disp[i * 2 + 1]);
      if (dl > 0) {
        const hubBoost = 1 + 0.15 * (Math.min(degree.get(ids[i]) || 0, 8) / 8);
        const mv = Math.min(dl, temp * hubBoost);
        p.x += (disp[i * 2] / dl) * mv;
        p.y += (disp[i * 2 + 1] / dl) * mv;
      }
    }
  }

  // ---- Radial fan-out around high-degree hubs ----
  // The most-connected entities get priority and spread their still-ungrouped
  // neighbours on a ring around them, so spokes never stack up in one direction
  // and each neighbour keeps an evenly-spaced arc. Secondary hubs keep their own
  // sub-fans, producing related nodes around parent/central entities.
  const minDist = k * 1.05;
  const hubIds = ids
    .map((id) => ({ id, deg: degree.get(id) || 0 }))
    .filter((d) => d.deg >= 4)
    .sort((a, b) => b.deg - a.deg)
    .map((d) => d.id);
  if (hubIds.length) {
    const claimed = new Set<string>();
    let rseed = 17;
    const rnd = () => {
      rseed = (rseed * 16807) % 2147483647;
      return (rseed - 1) / 2147483646;
    };
    for (const hid of hubIds) {
      if (claimed.has(hid)) continue;
      claimed.add(hid);
      const free: string[] = [];
      for (const nb of adj.get(hid) || []) {
        if (!claimed.has(nb) && !hubIds.includes(nb)) free.push(nb);
      }
      if (!free.length) continue;
      const hp = posArr[index.get(hid)!];
      const R = Math.max(minDist, (free.length * minDist * 1.2) / (2 * Math.PI));
      const baseA = rnd() * Math.PI * 2;
      const step = (Math.PI * 2) / free.length;
      for (let ai = 0; ai < free.length; ai++) {
        const a = baseA + ai * step;
        const p = posArr[index.get(free[ai])!];
        p.x = hp.x + Math.cos(a) * R;
        p.y = hp.y + Math.sin(a) * R;
        p.vx = 0;
        p.vy = 0;
        claimed.add(free[ai]);
      }
    }
    // Hubs that were claimed as leaves keep their position but still fan out their
    // own neighbours around themselves (handled above regardless of claim state).
  }

  // Final collision cleanup + containment. The hub fan-out already guarantees
  // spacing for the dense stars; this tidies the last few residual overlaps.
  if (n <= 800) {
    const passes = n <= 60 ? 140 : n <= 200 ? 90 : 40;
    for (let pass = 0; pass < passes; pass++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const pi = posArr[i];
        for (let j = i + 1; j < n; j++) {
          const pj = posArr[j];
          let dx = pj.x - pi.x;
          let dy = pj.y - pi.y;
          let d = Math.hypot(dx, dy);
          if (d >= minDist) continue;
          if (d < 1e-4) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d = Math.hypot(dx, dy) || 1;
          }
          const push = (minDist - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          const wi = 1 + Math.min(degree.get(ids[i]) || 0, 8) * 0.3;
          const wj = 1 + Math.min(degree.get(ids[j]) || 0, 8) * 0.3;
          const ti = (push * wj) / (wi + wj);
          pi.x -= ux * ti;
          pi.y -= uy * ti;
          pj.x += ux * (push - ti);
          pj.y += uy * (push - ti);
          moved = true;
        }
      }
      for (let i = 0; i < n; i++) {
        const p = posArr[i];
        p.x = Math.max(40, Math.min(W - 40, p.x));
        p.y = Math.max(40, Math.min(H - 40, p.y));
      }
      if (!moved) break;
    }
  }

  // Re-centre each component on its cell (scaled to fit) so disconnected groups
  // keep a clear gap between them and the overall bounding box stays compact.
  components.forEach((members, ci) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of members) {
      const p = posArr[index.get(id)!];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const centroid = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const a = anchor.get(members[0])!;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const s = Math.min(1, Math.min((cellW - 80) / bw, (cellH - 80) / bh));
    for (const id of members) {
      const p = posArr[index.get(id)!];
      p.x = a.x + (p.x - centroid.x) * s;
      p.y = a.y + (p.y - centroid.y) * s;
    }
  });

  // Final overlap pass after re-centring: small components that share an anchor
  // (isolated nodes in a single-cell scene) land on the exact same spot, so push
  // any pair that ended up closer than the spacing back apart.
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const pi = posArr[i];
      for (let j = i + 1; j < n; j++) {
        const pj = posArr[j];
        let dx = pj.x - pi.x;
        let dy = pj.y - pi.y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-3) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d = Math.hypot(dx, dy) || 1;
        }
        const push = (minDist - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        const wi = 1 + Math.min(degree.get(ids[i]) || 0, 8) * 0.3;
        const wj = 1 + Math.min(degree.get(ids[j]) || 0, 8) * 0.3;
        const ti = (push * wj) / (wi + wj);
        pi.x -= ux * ti;
        pi.y -= uy * ti;
        pj.x += ux * (push - ti);
        pj.y += uy * (push - ti);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return pos;
}

export interface GraphCanvasHandle {
  zoomBy: (f: number) => void;
  fit: () => void;
  reset: () => void;
  toggleFullscreen: () => void;
}

interface GraphCanvasProps {
  data: GraphData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedEdgeId?: string | null;
  onEdgeSelect?: (edge: KnowledgeGraphEdge | null) => void;
  className?: string;
}

function bezPoint(p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
}

function pointOnCurve(p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, px: number, py: number, steps = 16): number {
  let best = Infinity;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const cur = bezPoint(p0, c, p1, i / steps);
    const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const t = Math.max(0, Math.min(1, ((px - prev.x) * (cur.x - prev.x) + (py - prev.y) * (cur.y - prev.y)) / (segLen * segLen || 1)));
    const cx = prev.x + t * (cur.x - prev.x);
    const cy = prev.y + t * (cur.y - prev.y);
    best = Math.min(best, Math.hypot(px - cx, py - cy));
    prev = cur;
  }
  return best;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const GraphCanvas = React.forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas({ data, selectedId, onSelect, selectedEdgeId, onEdgeSelect, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const dataRef = useRef(data);
    const selectedRef = useRef(selectedId);
    const selectedEdgeRef = useRef<string | null>(selectedEdgeId || null);
    const posRef = useRef<Map<string, Pos>>(new Map());
    const gapRef = useRef<number>(1);
    const hubRef = useRef<Set<string>>(new Set());
    const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());
    const edgeInfoRef = useRef<Map<string, EdgeInfo>>(new Map());
    const transformRef = useRef({ k: 1, tx: 0, ty: 0 });
    const sizeRef = useRef({ w: 800, h: 500, dpr: 1 });
    const hoverRef = useRef<{ node?: string; edge?: string }>({});
    const dragRef = useRef<{ active: boolean; lastX: number; lastY: number; startX: number; startY: number; startT: number; moved: number }>({
      active: false, lastX: 0, lastY: 0, startX: 0, startY: 0, startT: 0, moved: 0,
    });
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const pinchRef = useRef<{ dist: number; k: number } | null>(null);
    const dirtyRef = useRef(true);
    const animatingRef = useRef(false);
    const userAdjustedRef = useRef(false);
    const dotPatternRef = useRef<CanvasPattern | null>(null);

    // Resolved scene (original nodes + expandable clusters for very large graphs)
    const sceneRef = useRef<{ nodes: KnowledgeGraphNode[]; edges: EdgeInfo[] }>({ nodes: [], edges: [] });
    const clusterRef = useRef<Map<string, string[]>>(new Map());
    const [expandedClusters, setExpandedClusters] = React.useState<Set<string>>(new Set());

    useEffect(() => {
      dataRef.current = data;
    }, [data]);

    useEffect(() => {
      selectedRef.current = selectedId;
      dirtyRef.current = true;
    }, [selectedId]);

    useEffect(() => {
      selectedEdgeRef.current = selectedEdgeId || null;
      dirtyRef.current = true;
    }, [selectedEdgeId]);

    // Validate/sanitize the graph, build adjacency + edge info with pair
    // ordinals (parallel relationships get offset curves), then run layout + fit.
    useEffect(() => {
      // Dedupe nodes by stable id.
      const nodeById = new Map<string, KnowledgeGraphNode>();
      for (const node of data.nodes) {
        if (node && node.id && !nodeById.has(node.id)) nodeById.set(node.id, node);
      }
      const validNodes = [...nodeById.values()];

      // Keep only edges with a stable id whose endpoints both exist. Reject
      // orphans and exact duplicate edges, but preserve distinct relationships
      // between the same two nodes.
      const seenEdgeIds = new Set<string>();
      const validEdges: KnowledgeGraphEdge[] = [];
      for (const edge of data.edges) {
        if (!edge || !edge.id || seenEdgeIds.has(edge.id)) continue;
        if (!edge.from || !edge.to || edge.from === edge.to) continue;
        if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
        seenEdgeIds.add(edge.id);
        validEdges.push({ ...edge, label: edge.label || edge.type });
      }
      dataRef.current = { nodes: validNodes, edges: validEdges };

      const adjacency = new Map<string, Set<string>>();
      for (const node of validNodes) adjacency.set(node.id, new Set());

      const pairOrder = new Map<string, number>();
      const edgeInfo = new Map<string, EdgeInfo>();
      for (const edge of validEdges) {
        const pk = edge.from < edge.to ? `${edge.from}|${edge.to}` : `${edge.to}|${edge.from}`;
        const idx = pairOrder.get(pk) ?? 0;
        pairOrder.set(pk, idx + 1);
        edgeInfo.set(edge.id, {
          edge,
          sign: idx % 2 === 0 ? 1 : -1,
          offset: Math.floor(idx / 2),
        });
        adjacency.get(edge.from)!.add(edge.to);
        adjacency.get(edge.to)!.add(edge.from);
      }
      adjacencyRef.current = adjacency;
      edgeInfoRef.current = edgeInfo;

      posRef.current = buildLayout(validNodes, validEdges);
      setExpandedClusters(new Set());
      buildScene(new Set());

      // Smallest node-to-node gap in layout units: used to cap the on-screen
      // node disc so clusters of dense nodes shrink together instead of piling up
      // into unreadable overlapping balls when the graph is fit to the viewport.
      let minGap = Infinity;
      const posArr2 = Array.from(posRef.current.values());
      for (let i = 0; i < posArr2.length; i++) {
        for (let j = i + 1; j < posArr2.length; j++) {
          const dx = posArr2[i].x - posArr2[j].x;
          const dy = posArr2[i].y - posArr2[j].y;
          const dd = Math.hypot(dx, dy);
          if (dd < minGap) minGap = dd;
        }
      }
      gapRef.current = Number.isFinite(minGap) && minGap > 0 ? minGap : 1;

      // High-degree hubs keep labels at any zoom level so the overview stays
      // navigable even when ambient labels are hidden for readability.
      const hubSet = new Set<string>();
      for (const edge of validEdges) {
        hubSet.add(edge.from);
        hubSet.add(edge.to);
      }
      const kept = new Set<string>();
      for (const id of hubSet) {
        let d = 0;
        for (const e of validEdges) if (e.from === id || e.to === id) d++;
        if (d >= 4) kept.add(id);
      }
      hubRef.current = kept;

      // Fit the entire graph (including node + label extents) inside the visible area
      const t = fitTransform();
      transformRef.current.k = t.k;
      transformRef.current.tx = t.tx;
      transformRef.current.ty = t.ty;
      userAdjustedRef.current = false;
      dirtyRef.current = true;

      // Re-run the fit on the next frame once the ResizeObserver has measured the
      // real container size, so the whole graph is guaranteed to be visible even
      // on the very first (async) data load.
      const frame = requestAnimationFrame(() => {
        if (!userAdjustedRef.current) {
          const t2 = fitTransform();
          transformRef.current.k = t2.k;
          transformRef.current.tx = t2.tx;
          transformRef.current.ty = t2.ty;
          dirtyRef.current = true;
        }
      });
      return () => cancelAnimationFrame(frame);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // Build the resolved scene: when the graph is very large, group nearby nodes
    // into expandable clusters so the overview stays meaningful and responsive.
    const buildScene = (expanded: Set<string>) => {
      const sourceNodes = dataRef.current.nodes;
      const allEdges = Array.from(edgeInfoRef.current.values());
      const srcPos = posRef.current;
      const nextPos: Map<string, Pos> = new Map(srcPos);
      clusterRef.current = new Map();

      let sceneNodes: KnowledgeGraphNode[] = sourceNodes;
      let sceneEdges: EdgeInfo[] = allEdges;

      if (sourceNodes.length > CLUSTER_THRESHOLD) {
        const clusters: Array<{ id: string; cx: number; cy: number; members: string[] }> = [];
        const memberToCluster = new Map<string, number>();
        for (const node of sourceNodes) {
          const p = srcPos.get(node.id);
          if (!p) continue;
          let placed = -1;
          for (let ci = 0; ci < clusters.length; ci++) {
            const c = clusters[ci];
            if (c.members.length >= CLUSTER_MAX_MEMBERS) continue;
            if (Math.hypot(p.x - c.cx, p.y - c.cy) < CLUSTER_DIST) { placed = ci; break; }
          }
          if (placed < 0) {
            placed = clusters.length;
            clusters.push({ id: `cluster:${clusters.length}`, cx: p.x, cy: p.y, members: [] });
          }
          const c = clusters[placed];
          c.members.push(node.id);
          memberToCluster.set(node.id, placed);
          const n = c.members.length;
          c.cx += (p.x - c.cx) / n;
          c.cy += (p.y - c.cy) / n;
        }

        const clusterNodes: KnowledgeGraphNode[] = [];
        clusters.forEach((c) => {
          clusterRef.current.set(c.id, c.members);
          if (expanded.has(c.id)) return;
          const memberNodes = c.members
            .map((id) => sourceNodes.find((n) => n.id === id))
            .filter((n): n is KnowledgeGraphNode => !!n);
          const subtype = clusterMajorityType(memberNodes);
          const first = memberNodes[0];
          clusterNodes.push({
            id: c.id,
            name: c.members.length > 1 ? `${memberNodes.length} ${subtype}s` : first?.name || 'cluster',
            type: `cluster:${subtype}`,
            source: 'knowledge',
            properties: { members: c.members.length },
          });
          nextPos.set(c.id, { x: c.cx, y: c.cy, vx: 0, vy: 0 });
        });

        const memberToScene = new Map<string, string>();
        clusters.forEach((c, ci) => {
          const collapsed = !expanded.has(c.id);
          for (const m of c.members) memberToScene.set(m, collapsed ? c.id : m);
        });

        sceneNodes = sourceNodes.filter((n) => (memberToScene.get(n.id) ?? n.id) === n.id).concat(clusterNodes);

        const remapped = new Map<string, EdgeInfo>();
        for (const ei of allEdges) {
          const a = memberToScene.get(ei.edge.from) || ei.edge.from;
          const b = memberToScene.get(ei.edge.to) || ei.edge.to;
          if (a === b) continue;
          const key = `${a}|${b}`;
          const prev = remapped.get(key);
          if (prev) { prev.edge.weight += ei.edge.weight || 1; continue; }
          remapped.set(key, {
            edge: { ...ei.edge, id: `${a}|${b}`, from: a, to: b },
            sign: hashKey(a, b) % 2 === 0 ? 1 : -1,
            offset: 0,
          });
        }
        sceneEdges = Array.from(remapped.values());
      }

      posRef.current = nextPos;
      sceneRef.current = { nodes: sceneNodes, edges: sceneEdges };
    };

    useEffect(() => {
      buildScene(expandedClusters);
      const t = fitTransform();
      const tr = transformRef.current;
      tr.k = t.k;
      tr.tx = t.tx;
      tr.ty = t.ty;
      userAdjustedRef.current = false;
      dirtyRef.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandedClusters]);

    // Resize observer
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const resize = () => {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        sizeRef.current = { w, h, dpr };
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const th = LIGHT_THEME;
        const pat = document.createElement('canvas');
        pat.width = pat.height = 26;
        const pctx = pat.getContext('2d');
        if (pctx) {
          pctx.clearRect(0, 0, 26, 26);
          pctx.fillStyle = th.dot;
          pctx.beginPath();
          pctx.arc(0.5, 0.5, 1, 0, Math.PI * 2);
          pctx.fill();
        }
        dotPatternRef.current = pctx ? canvas.getContext('2d')!.createPattern(pat, 'repeat') : null;
        dirtyRef.current = true;
        if (posRef.current.size > 0 && !userAdjustedRef.current) fitView();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }, []);

    // Fullscreen changes trigger a redraw after the resize observer updates the canvas.
    useEffect(() => {
      const onChange = () => {
        dirtyRef.current = true;
        setTimeout(() => dirtyRef.current = true, 200);
      };
      document.addEventListener('fullscreenchange', onChange);
      return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    // Render loop
    const draw = useRef<(t: number) => void>(() => undefined);
    draw.current = (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h, dpr } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const th = LIGHT_THEME;
      const { k, tx, ty } = transformRef.current;

      // Keep labels readable at every zoom level: their on-screen size is
      // bounded so that when the whole graph is fit into a tiny scale the
      // labels don't explode and overlap. Below a threshold they fade out and
      // reappear when the user zooms in (data is never removed).
      const labelK = Math.max(k, 0.22);
      // Bound on-screen node/halo radius so nodes stay visible and proportional
      // even when the whole graph is zoomed way out.
      const renderK = Math.max(k, 0.16);
      const showLabels = k >= 0.12;
      // Cap the node disc on the actual layout spacing: when the tightest pair on
      // screen is smaller than two full discs, shrink the discs so neighbouring
      // nodes stop overlapping (dense hubs read as a cloud instead of a blob) and
      // let the labels do the talking for hubs/selected nodes.
      const nodeScale = clamp((k * gapRef.current) / (2 * NODE_R), 0.34, 1);

      // ---- Background (screen space) ----
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, Math.max(w, h) * 0.85);
      bg.addColorStop(0, th.top);
      bg.addColorStop(1, th.base);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const blobs: Array<[number, number, number, string]> = [
        [w * 0.08, h * 0.12, w * 0.5, th.glowA],
        [w * 0.92, h * 0.2, w * 0.55, th.glowB],
        [w * 0.5, h * 0.98, w * 0.5, th.glowC],
      ];
      for (const [bx, by, br, color] of blobs) {
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (dotPatternRef.current) {
        ctx.fillStyle = dotPatternRef.current;
        ctx.fillRect(0, 0, w, h);
      }

      // Apply the camera transform. Every node/edge/label below is drawn in
      // WORLD coordinates; fitTransform() computes k/tx/ty so the whole graph is
      // centered in the viewport, and pan/zoom adjust them for user interaction.
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(k, k);

      const pos = posRef.current;
      const edges = sceneRef.current.edges;
      const selected = selectedRef.current;
      const hover = hoverRef.current;

      // Connected set when a node is selected
      const connected: Set<string> | undefined = selected ? adjacencyRef.current.get(selected) : undefined;
      const isDimmed = (id: string) => !!selected && (id !== selected && !connected?.has(id));

      // World-space radius of each rendered node circle, used to anchor edges at
      // the node border instead of running through its center.
      const radii = new Map<string, number>();
      for (const node of sceneRef.current.nodes) {
        let base = (node.id.startsWith('cluster:') ? NODE_R * 1.9 : NODE_R) * nodeScale;
        if (selected === node.id) base = Math.max(base, SELECT_R * nodeScale);
        else if (hover.node === node.id) base = Math.max(base, HOVER_R * nodeScale);
        radii.set(node.id, base / renderK);
      }

      const curve = (ei: EdgeInfo) => {
        const rA = radii.get(ei.edge.from);
        const rB = radii.get(ei.edge.to);
        if (rA === undefined || rB === undefined) return null;
        return edgeGeometry(pos, ei, rA, rB);
      };

      // ---- Edges (rendered behind nodes) ----
      let anyHighlighted = false;
      const highlightedEdges: EdgeInfo[] = [];
      const labelCenters: Array<{ x: number; y: number }> = [];
      const focusedEdgeId = selectedEdgeRef.current;
      const denseEdges = edges.length > 160;

      for (const ei of edges) {
        const geom = curve(ei);
        if (!geom) continue;
        const touchesSel = selected ? ei.edge.from === selected || ei.edge.to === selected : false;
        const edgeFocus = hover.edge === ei.edge.id || focusedEdgeId === ei.edge.id;
        const highlighted = touchesSel || edgeFocus;
        const alpha = selected ? (touchesSel ? 1 : 0.22) : edgeFocus ? 1 : 0.55;
        if (highlighted) highlightedEdges.push(ei);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(geom.a.x, geom.a.y);
        ctx.quadraticCurveTo(geom.ctrl.x, geom.ctrl.y, geom.b.x, geom.b.y);
        const color = edgeFocus ? th.edgeHover : touchesSel ? th.edgeBright : th.edge;
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = (edgeFocus ? EDGE_W * 1.9 : touchesSel ? EDGE_W * 1.5 : EDGE_W) / k;
        ctx.lineCap = 'round';
        if (highlighted) {
          ctx.shadowColor = th.edgeHover;
          ctx.shadowBlur = 8;
        }
        ctx.stroke();

        // Small arrowhead at the target anchor, oriented along the curve tangent.
        const arrowLen = 9 / k;
        const arrowW = 5 / k;
        const adx = geom.b.x - geom.ctrl.x;
        const ady = geom.b.y - geom.ctrl.y;
        const al = Math.hypot(adx, ady) || 1;
        const atx = adx / al;
        const aty = ady / al;
        const apx = -aty;
        const apy = atx;
        ctx.beginPath();
        ctx.moveTo(geom.b.x, geom.b.y);
        ctx.lineTo(geom.b.x - atx * arrowLen + apx * arrowW, geom.b.y - aty * arrowLen + apy * arrowW);
        ctx.lineTo(geom.b.x - atx * arrowLen - apx * arrowW, geom.b.y - aty * arrowLen - apy * arrowW);
        ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();

        if (highlighted) anyHighlighted = true;
      }

      // Animated flow on highlighted edges
      animatingRef.current = anyHighlighted;
      if (anyHighlighted) {
        const dash = 7 / k;
        for (const ei of highlightedEdges) {
          const geom = curve(ei);
          if (!geom) continue;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(geom.a.x, geom.a.y);
          ctx.quadraticCurveTo(geom.ctrl.x, geom.ctrl.y, geom.b.x, geom.b.y);
          ctx.strokeStyle = th.edgeHover;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = EDGE_W / k;
          ctx.setLineDash([dash, 8 / k]);
          ctx.lineDashOffset = -((t / 24) % (dash + 8 / k));
          ctx.stroke();
          ctx.restore();
        }
      }

      // ---- Edge labels ----
      ctx.textBaseline = 'middle';
      const pillH = 20 / labelK;
      const labelFont = `${600} ${11.5 / labelK}px Inter, system-ui, sans-serif`;
      ctx.font = labelFont;

      for (const ei of edges) {
        const geom = curve(ei);
        if (!geom) continue;
        const touchesSel = selected ? ei.edge.from === selected || ei.edge.to === selected : false;
        const edgeFocus = hover.edge === ei.edge.id || focusedEdgeId === ei.edge.id;
        const important = touchesSel || edgeFocus;

        // Hide non-essential labels when zoomed out OR when the graph is very
        // dense; hovering/clicking the edge still reveals its label.
        if (!showLabels && !important) continue;
        if (denseEdges && !important) continue;

        const pt = bezPoint(geom.a, geom.ctrl, geom.b, 0.5);
        const txt = edgeLabel(ei.edge);
        const tw = ctx.measureText(txt).width;

        // avoid colliding with nodes (except maybe endpoints) and other labels
        let blocked = false;
        for (const node of sceneRef.current.nodes) {
          const p = pos.get(node.id);
          if (!p) continue;
          const d = Math.hypot(pt.x - p.x, pt.y - p.y);
          if (important) continue;
          if (d < NODE_R * nodeScale + 22 / labelK) { blocked = true; break; }
        }
        if (!blocked) {
          for (const lc of labelCenters) {
            if (Math.hypot(pt.x - lc.x, pt.y - lc.y) < 84 / labelK) { blocked = true; break; }
          }
        }
        if (blocked && !important) continue;

        const pw = Math.max(34 / labelK, tw + 15 / labelK);
        const px = pt.x - pw / 2;
        const py = pt.y - pillH / 2;
        ctx.save();
        ctx.globalAlpha = selected ? (touchesSel ? 1 : 0.18) : edgeFocus ? 1 : 0.92;
        rr(ctx, px, py, pw, pillH, pillH / 2);
        ctx.fillStyle = th.pillBg;
        ctx.fill();
        ctx.strokeStyle = th.pillBorder;
        ctx.lineWidth = (important ? 1.3 : 1) / labelK;
        ctx.stroke();
        ctx.fillStyle = th.pillText;
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.globalAlpha = selected ? (touchesSel ? 1 : 0.2) : edgeFocus ? 1 : 0.94;
        ctx.fillText(txt, pt.x, pt.y + 0.5 / labelK);
        ctx.restore();

        labelCenters.push(pt);
      }

      // ---- Halos (selected node + endpoints of the active edge) ----
      const haloIds = new Set<string>();
      if (selected && pos.has(selected)) haloIds.add(selected);
      const haloEdgeId = focusedEdgeId || hover.edge;
      if (haloEdgeId) {
        const ei = edgeInfoRef.current.get(haloEdgeId) as EdgeInfo | undefined;
        if (ei) {
          haloIds.add(ei.edge.from);
          haloIds.add(ei.edge.to);
        }
      }
      for (const id of haloIds) {
        const p = pos.get(id);
        if (!p) continue;
        const hiR = (NODE_R * 2.1 * nodeScale) / renderK;
        const halo = ctx.createRadialGradient(p.x, p.y, (NODE_R * 0.6 * nodeScale) / renderK, p.x, p.y, hiR);
        halo.addColorStop(0, th.halo);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hiR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- Nodes ----
      ctx.textAlign = 'center';
      const nodeFont = `${600} ${11 / labelK}px Inter, system-ui, sans-serif`;

      for (const node of sceneRef.current.nodes) {
        const p = pos.get(node.id);
        if (!p) continue;
        const color = nodeColor(node.type);
        const dimmed = isDimmed(node.id);
        const isSel = selected === node.id;
        const isHover = hover.node === node.id;
        const isCluster = node.id.startsWith('cluster:');
        const showNodeLabel = showLabels || isSel || isHover || isCluster || (nodeScale < 0.72 && hubRef.current.has(node.id));
        const rad = (isCluster ? NODE_R * 1.9 : isSel ? SELECT_R : isHover ? HOVER_R : NODE_R) * nodeScale;
        const r = rad / renderK;
        ctx.save();
        ctx.globalAlpha = dimmed ? 0.3 : 1;

        // glow
        ctx.shadowColor = color;
        ctx.shadowBlur = isSel ? 30 : isHover ? 24 : 12;

        // frost fill
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = (dimmed ? 0.3 : 1) * 0.16;
        ctx.fill();

        // top-left light
        ctx.globalAlpha = dimmed ? 0.12 : 0.24;
        const fl = ctx.createRadialGradient(p.x - r * 0.38, p.y - r * 0.42, 0, p.x - r * 0.38, p.y - r * 0.42, r);
        fl.addColorStop(0, 'rgba(255,255,255,0.5)');
        fl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fl;
        ctx.fill();

        // ring
        ctx.shadowColor = color;
        ctx.shadowBlur = (isSel ? 26 : isHover ? 20 : th.glowBase) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = (isSel ? 3 : isHover ? 2.4 : 1.7) / renderK;
        ctx.globalAlpha = dimmed ? 0.35 : 1;
        ctx.stroke();

        ctx.restore();

        // cluster member-count badge inside the node
        if (isCluster) {
          const count = typeof node.properties?.members === 'number' ? node.properties.members : 0;
          ctx.save();
          ctx.font = `${700} ${13 / renderK}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = dimmed ? 0.4 : 0.95;
          ctx.fillStyle = color;
          ctx.fillText(String(count), p.x, p.y + 0.5 / renderK);
          ctx.restore();
        }

        // label pill under node
        const name = node.name;
        ctx.font = nodeFont;
        const tw = ctx.measureText(name).width;
        const nph = 19 / labelK;
        const npw = tw + 13 / labelK;
        const nx = p.x - npw / 2;
        const ny = p.y + r + 9 / labelK;
        ctx.save();
        ctx.globalAlpha = (dimmed ? 0.3 : showNodeLabel ? 0.96 : 0) ;
        rr(ctx, nx, ny, npw, nph, nph / 2);
        ctx.fillStyle = th.nodePill;
        ctx.fill();
        ctx.strokeStyle = th.nodePillBorder;
        ctx.lineWidth = 1 / labelK;
        ctx.stroke();
        ctx.fillStyle = th.nodeLabel;
        ctx.font = nodeFont;
        ctx.textAlign = 'center';
        ctx.fillText(name, p.x, ny + nph / 2 + 1 / labelK);
        ctx.restore();
      }

      ctx.restore();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    useEffect(() => {
      let raf = 0;
      const loop = (t: number) => {
        if (dirtyRef.current || animatingRef.current) {
          draw.current(t);
          dirtyRef.current = false;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, []);

    // --- Interaction helpers ---
    // Center the camera on the selected node
    useEffect(() => {
      if (!selectedId) return;
      const p = posRef.current.get(selectedId);
      if (!p) return;
      const { k } = transformRef.current;
      const { w, h } = sizeRef.current;
      transformRef.current.tx = w / 2 - p.x * k;
      transformRef.current.ty = h / 2 - p.y * k;
      dirtyRef.current = true;
    }, [selectedId]);

    const toWorld = (sx: number, sy: number) => {
      const { k, tx, ty } = transformRef.current;
      return { x: (sx - tx) / k, y: (sy - ty) / k };
    };

    const hitTest = (sx: number, sy: number) => {
      const wpt = toWorld(sx, sy);
      const { k } = transformRef.current;
      // Match the on-screen node radius used for rendering at deep zoom-out.
      const renderK = Math.max(k, 0.16);
      const nodeScale = clamp((k * gapRef.current) / (2 * NODE_R), 0.34, 1);
      const th = (HOVER_R * nodeScale) / renderK;
      let nodeHit: string | null = null;
      let best = th;
      for (const node of sceneRef.current.nodes) {
        const p = posRef.current.get(node.id);
        if (!p) continue;
        const rad = (node.id.startsWith('cluster:') ? NODE_R * 1.9 : node.id === selectedRef.current ? SELECT_R : HOVER_R) * nodeScale;
        const d = Math.hypot(wpt.x - p.x, wpt.y - p.y);
        if (d < Math.max(rad, th) / renderK && d < best) { best = d; nodeHit = node.id; }
      }
      if (nodeHit) return { node: nodeHit };

      for (const ei of sceneRef.current.edges) {
        const rFrom = edgeNodeRadius(posRef.current, ei.edge.from, selectedRef.current, hoverRef.current.node, renderK, nodeScale);
        const rTo = edgeNodeRadius(posRef.current, ei.edge.to, selectedRef.current, hoverRef.current.node, renderK, nodeScale);
        if (rFrom === undefined || rTo === undefined) continue;
        const geom = edgeGeometry(posRef.current, ei, rFrom, rTo);
        if (!geom) continue;
        const dist = pointOnCurve(geom.a, geom.ctrl, geom.b, wpt.x, wpt.y);
        if (dist < 6 / renderK) return { edge: ei.edge.id };
      }
      return {};
    };

    const applyZoom = (f: number, cx?: number, cy?: number) => {
      const { w, h } = sizeRef.current;
      const mx = cx ?? w / 2;
      const my = cy ?? h / 2;
      const t = transformRef.current;
      const wx = (mx - t.tx) / t.k;
      const wy = (my - t.ty) / t.k;
      const nk = clamp(t.k * f, MIN_K, MAX_K);
      t.tx = mx - wx * nk;
      t.ty = my - wy * nk;
      t.k = nk;
      userAdjustedRef.current = true;
      dirtyRef.current = true;
    };

    // Compute a transform that fits the WHOLE graph (nodes + labels) inside the
    // viewport with symmetric padding. The scale is NOT floored by MIN_K so large
    // graphs can always be fully visible.
    const fitTransform = () => {
      const { w, h } = sizeRef.current;
      if (posRef.current.size === 0) return { k: 1, tx: w / 2, ty: h / 2 };
      const pad = 64;
      // Extra world margin around each node to keep its ring and label pill inside
      // the viewport (label renders below the node). When the graph is dense the
      // discs shrink (nodeScale < 1), so the margin shrinks with them.
      const fitR = Math.min(NODE_R, Math.max(4, gapRef.current * 0.5));
      const labelH = 19;
      const marginX = fitR + 8;
      const marginBottom = fitR + labelH + 8;
      const marginTop = fitR + 6;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of posRef.current.values()) {
        minX = Math.min(minX, p.x - marginX); maxX = Math.max(maxX, p.x + marginX);
        minY = Math.min(minY, p.y - marginTop); maxY = Math.max(maxY, p.y + marginBottom);
      }
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      const scale = clamp(
        Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh),
        0.015,
        2
      );
      const tx = w / 2 - ((minX + maxX) / 2) * scale;
      const ty = h / 2 - ((minY + maxY) / 2) * scale;
      return { k: scale, tx, ty };
    };

    const fitView = () => {
      const t = fitTransform();
      const tr = transformRef.current;
      tr.k = t.k;
      tr.tx = t.tx;
      tr.ty = t.ty;
      userAdjustedRef.current = false;
      dirtyRef.current = true;
    };

    const resetView = () => {
      // Reset returns to a centered, unscaled (k=1) view of the whole graph.
      const t = transformRef.current;
      const { w, h } = sizeRef.current;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of posRef.current.values()) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      t.k = 1;
      t.tx = w / 2 - ((minX + maxX) / 2) * t.k;
      t.ty = h / 2 - ((minY + maxY) / 2) * t.k;
      userAdjustedRef.current = false;
      dirtyRef.current = true;
    };

    const toggleFullscreen = () => {
      const el = containerRef.current;
      if (!el) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen().catch(() => undefined);
    };

    useImperativeHandle(ref, () => ({
      zoomBy: (f) => applyZoom(f),
      fit: fitView,
      reset: resetView,
      toggleFullscreen,
    }));

    // Wheel zoom (native, non-passive)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const fx = e.clientX - rect.left;
        const fy = e.clientY - rect.top;
        applyZoom(Math.exp(-e.deltaY * 0.0016), fx, fy);
      };
      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', onWheel);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      canvasRef.current?.setPointerCapture(e.pointerId);
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointersRef.current.set(e.pointerId, { x, y });

      if (pointersRef.current.size === 1) {
        dragRef.current = { active: true, lastX: x, lastY: y, startX: x, startY: y, startT: performance.now(), moved: 0 };
      } else if (pointersRef.current.size === 2) {
        dragRef.current = { active: true, lastX: x, lastY: y, startX: x, startY: y, startT: performance.now(), moved: 0 };
        const [p0, p1] = [...pointersRef.current.values()];
        pinchRef.current = { dist: Math.hypot(p1.x - p0.x, p1.y - p0.y), k: transformRef.current.k };
      }
      dirtyRef.current = true;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const canvas = canvasRef.current;

      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x, y });

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [p0, p1] = [...pointersRef.current.values()];
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const t = transformRef.current;
        const wt = { x: (mx - t.tx) / t.k, y: (my - t.ty) / t.k };
        const nk = clamp(pinchRef.current.k * (d / pinchRef.current.dist), MIN_K, MAX_K);
        t.tx = mx - wt.x * nk;
        t.ty = my - wt.y * nk;
        t.k = nk;
        userAdjustedRef.current = true;
        dirtyRef.current = true;
      } else if (dragRef.current.active) {
        const dx = x - dragRef.current.lastX;
        const dy = y - dragRef.current.lastY;
        dragRef.current.moved += Math.hypot(dx, dy);
        dragRef.current.lastX = x;
        dragRef.current.lastY = y;
        transformRef.current.tx += dx;
        transformRef.current.ty += dy;
        userAdjustedRef.current = true;
        dirtyRef.current = true;
        if (canvas) canvas.style.cursor = 'grabbing';
      } else {
        const hit = hitTest(x, y);
        const hoverChanged =
          (hit.node ?? null) !== (hoverRef.current.node ?? null) ||
          (hit.edge ?? null) !== (hoverRef.current.edge ?? null);
        hoverRef.current = hit;
        if (canvas) canvas.style.cursor = hit.node || hit.edge ? 'pointer' : 'grab';
        if (hoverChanged) dirtyRef.current = true;
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointersRef.current.delete(e.pointerId);
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (pointersRef.current.size <= 1) pinchRef.current = null;

      const dbl = dragRef.current;
      const wasClick =
        dbl.active &&
        dbl.moved < 6 &&
        performance.now() - dbl.startT < 500 &&
        !pinchRef.current;
      if (wasClick) {
        const hit = hitTest(x, y);
        if (hit.node && hit.node.startsWith('cluster:')) {
          // Expand/collapse the cluster in place
          setExpandedClusters((prev) => {
            const next = new Set(prev);
            if (next.has(hit.node!)) next.delete(hit.node!);
            else next.add(hit.node!);
            return next;
          });
          hoverRef.current = {};
        } else if (hit.node) {
          onSelect(hit.node);
        } else if (hit.edge) {
          const ei = edgeInfoRef.current.get(hit.edge);
          if (ei) {
            // Real relationship: report the full edge so the detail panel can
            // show source -> relationship -> target. The selectedEdgeId prop
            // keeps the edge highlighted in the canvas.
            onEdgeSelect?.(ei.edge as KnowledgeGraphEdge);
          } else {
            // cluster pseudo-edge — select a real endpoint if present
            const sceneEdge = sceneRef.current.edges.find((e) => e.edge.id === hit.edge);
            const ep = sceneEdge?.edge.from || sceneEdge?.edge.to;
            if (sceneEdge && ep && !ep.startsWith('cluster:') && sceneEdge.edge.to && !sceneEdge.edge.to.startsWith('cluster:')) {
              onEdgeSelect?.(sceneEdge.edge as KnowledgeGraphEdge);
            } else {
              onSelect(ep && !ep.startsWith('cluster:') ? ep : null);
            }
          }
        } else {
          if (onEdgeSelect) onEdgeSelect(null);
          onSelect(null);
        }
      }
      if (pointersRef.current.size === 0) {
        dragRef.current.active = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }
      dirtyRef.current = true;
    };

    const handlePointerLeave = () => {
      if (pointersRef.current.size === 0) {
        dragRef.current.active = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        hoverRef.current = {};
        dirtyRef.current = true;
      }
    };

    const [fullscreen, setFullscreen] = React.useState(false);
    useEffect(() => {
      const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener('fullscreenchange', onChange);
      return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const controlBtn =
      'flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-all duration-150 hover:border-primary/30 hover:bg-card hover:text-foreground active:scale-95';

    return (
      <div
        ref={containerRef}
        className={cn(
          'graph-overlay relative h-full w-full touch-none select-none overflow-hidden',
          'bg-[#F6F5FB]',
          className
        )}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Floating controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
          {[
            { icon: <ZoomIn className="h-4 w-4" />, label: 'Zoom in', action: () => applyZoom(1.25) },
            { icon: <ZoomOut className="h-4 w-4" />, label: 'Zoom out', action: () => applyZoom(0.8) },
          ].map((c) => (
            <button key={c.label} onClick={c.action} aria-label={c.label} className={cn(controlBtn, 'border-transparent bg-card/45 backdrop-blur-md hover:bg-card/70')}>
              {c.icon}
            </button>
          ))}
          <button onClick={fitView} aria-label="Fit graph" className={cn(controlBtn, 'border-transparent bg-card/45 backdrop-blur-md hover:bg-card/70')}>
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={resetView} aria-label="Reset view" className={cn(controlBtn, 'border-transparent bg-card/45 backdrop-blur-md hover:bg-card/70')}>
            <Focus className="h-4 w-4" />
          </button>
          <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" className={cn(controlBtn, 'border-transparent bg-card/45 backdrop-blur-md hover:bg-card/70')}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Fullscreen className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }
);