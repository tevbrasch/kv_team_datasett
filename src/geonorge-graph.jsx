import { useState, useRef, useEffect } from "react";
import * as d3 from "d3";

// ─────────────────────────────────────────────────────────────────────────────
// Graph builder
// ─────────────────────────────────────────────────────────────────────────────

function buildGraph(jsonLd) {
  const graph = jsonLd["@graph"];
  if (!Array.isArray(graph)) throw new Error('JSON-LD must have a "@graph" array.');

  const nodeMap = new Map();
  const links   = [];

  function addService(svc, parentDsId) {
    const id    = svc["dcterms:identifier"] || svc["@id"];
    const title = svc["dcterms:title"] || "Unnamed Service";
    const fmt   = svc["dcterms:format"] || "";
    if (!id) return;
    if (!nodeMap.has(id))
      nodeMap.set(id, { id, label: title, type: "service", format: fmt });
    links.push({ source: parentDsId, target: id, linkType: "service" });
  }

  function addDataset(ds, teamId) {
    const id          = ds["dcterms:identifier"] || ds["@id"];
    const title       = ds["dcterms:title"] || "Unnamed Dataset";
    const org         = ds["dcterms:publisher"]?.["foaf:name"] || "Unknown";
    const seriesCount = ds["geonorge:seriesCount"] || 0;
    const isDokData   = ds["geonorge:isDokData"]  ?? null;
    const dataAccess  = ds["geonorge:dataAccess"] ?? null;
    if (!id) return;
    if (!nodeMap.has(id))
      nodeMap.set(id, { id, label: title, type: "dataset", organization: org, teamId, seriesCount, isDokData, dataAccess });
    else {
      const n = nodeMap.get(id);
      if (teamId)                  n.teamId     = teamId;
      if (seriesCount)             n.seriesCount = seriesCount;
      if (isDokData  !== null)     n.isDokData   = isDokData;
      if (dataAccess !== null)     n.dataAccess  = dataAccess;
    }
    const svcs = ds["dcat:service"] || [];
    (Array.isArray(svcs) ? svcs : [svcs]).forEach((s) => addService(s, id));
  }

  // Pass 1: team nodes (datasets nested inside)
  graph.forEach((item) => {
    if (item["@type"] !== "geonorge:Team") return;
    const teamId = item["@id"];
    const title  = item["dcterms:title"] || "Unnamed Team";
    if (!nodeMap.has(teamId))
      nodeMap.set(teamId, { id: teamId, label: title, type: "team" });
    const datasets = item["dcat:dataset"] || [];
    (Array.isArray(datasets) ? datasets : [datasets]).forEach((ds) => {
      const dsId = ds["dcterms:identifier"] || ds["@id"];
      if (!dsId) return;
      addDataset(ds, teamId);
      links.push({ source: teamId, target: dsId, linkType: "team" });
    });
  });

  // Pass 2: top-level dataset nodes (no team)
  graph.forEach((item) => {
    if (item["@type"] !== "dcat:Dataset") return;
    addDataset(item, null);
  });

  // Propagate teamId to services
  links.forEach((l) => {
    if (l.linkType !== "service") return;
    const src = nodeMap.get(l.source?.id ?? l.source);
    const tgt = nodeMap.get(l.target?.id ?? l.target);
    if (src?.teamId && tgt && !tgt.teamId) tgt.teamId = src.teamId;
  });

  return { nodes: Array.from(nodeMap.values()), links };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG text wrapping
// ─────────────────────────────────────────────────────────────────────────────

function wrapTextNode(textEl, fullLabel, maxWidth, lineHeight) {
  const words  = fullLabel.split(/\s+/);
  const charW  = 6.2;
  const maxCh  = Math.floor(maxWidth / charW);
  const lines  = [];
  let current  = "";

  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxCh) {
      current = test;
    } else {
      if (current) lines.push(current);
      if (word.length > maxCh) {
        let w = word;
        while (w.length > maxCh) { lines.push(w.slice(0, maxCh)); w = w.slice(maxCh); }
        current = w;
      } else {
        current = word;
      }
    }
  });
  if (current) lines.push(current);

  textEl.selectAll("tspan").remove();
  lines.forEach((line, i) => {
    textEl.append("tspan")
      .attr("x", 0)
      .attr("dy", i === 0 ? 0 : lineHeight)
      .text(line);
  });
  return lines.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:       "#f8fafc",
  panel:    "#ffffff",
  border:   "#e2e8f0",
  text:     "#1e293b",
  muted:    "#64748b",
  accent:   "#0284c7",
  dataset:  "#0284c7",
  service:  "#059669",   // all services green
  serie:    "#7c3aed",
  dok:      "#0891b2",
  linkTeam: "#cbd5e1",
  linkSvc:  "#bfdbfe",
  error:    "#dc2626",
};

const TEAM_PALETTE = [
  "#f472b6","#34d399","#facc15","#60a5fa",
  "#fb923c","#4ade80","#e879f9","#38bdf8",
  "#f87171","#a78bfa",
];

const LABEL = {
  team:    { maxW: 130, fontSize: "10px", fontWeight: "700", lineH: 13 },
  dataset: { maxW: 120, fontSize: "9px",  fontWeight: "400", lineH: 12 },
  service: { maxW: 100, fontSize: "8px",  fontWeight: "400", lineH: 11 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared button
// ─────────────────────────────────────────────────────────────────────────────

function Btn({ children, onClick, disabled, active, color, style: extra = {} }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      padding: "5px 13px", fontSize: 9, fontFamily: "'Roboto', sans-serif",
      letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 3,
      cursor: disabled ? "default" : "pointer", transition: "all 0.15s",
      opacity: disabled ? 0.35 : 1,
      background: active ? (color || C.accent) : "transparent",
      color:      active ? C.bg : (color || C.muted),
      border:     `1px solid ${active ? (color || C.accent) : C.border}`,
      ...extra,
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — Load JSON-LD
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_URL = "https://raw.githubusercontent.com/tevbrasch/kv_team_datasett/main/output_with_teams.json";

function StagePaste({ onLoaded }) {
  const [url,      setUrl]      = useState(DEFAULT_URL);
  const [text,     setText]     = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const loadFromUrl = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      const raw = await res.text();
      buildGraph(JSON.parse(raw));   // validate before accepting
      onLoaded(raw);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handlePaste = () => {
    try {
      const parsed = JSON.parse(text);
      buildGraph(parsed);
      setError("");
      onLoaded(text);
    } catch (e) { setError(e.message); }
  };

  return (
    <div style={{ maxWidth: 700, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, marginBottom: 6 }}>Load JSON-LD</div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
          Load directly from a URL, or paste the JSON-LD manually below.
        </div>
      </div>

      {/* URL loader */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="https://..."
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 4, fontSize: 11,
            border: `1px solid ${C.border}`, background: C.panel,
            color: C.text, fontFamily: "'Roboto Mono', monospace", outline: "none",
          }}
        />
        <Btn active onClick={loadFromUrl} disabled={!url.trim() || loading}>
          {loading ? "Loading…" : "Load URL →"}
        </Btn>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>or paste manually</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* Paste area */}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(""); }}
        placeholder='{ "@context": { ... }, "@graph": [ ... ] }'
        style={{
          width: "100%", height: 280, background: C.panel,
          border: `1px solid ${error ? C.error : C.border}`, borderRadius: 4,
          color: C.text, fontFamily: "'Roboto Mono', monospace", fontSize: 10,
          padding: 12, resize: "vertical", outline: "none",
          boxSizing: "border-box", lineHeight: 1.6,
        }}
      />
      {error && <div style={{ fontSize: 10, color: C.error }}>Error: {error}</div>}
      <Btn active onClick={handlePaste} disabled={!text.trim()}>Build Graph →</Btn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — Force graph
// ─────────────────────────────────────────────────────────────────────────────

function Graph({ jsonLdText, onBack }) {
  const svgRef          = useRef(null);
  const posRef          = useRef(new Map());
  const zoomRef         = useRef(null);          // persists zoom transform across rebuilds
  const zoomBehavior    = useRef(null);          // d3 zoom instance, stable across rebuilds
  const toggleRef       = useRef(null);
  const zoomToTeamRef   = useRef(null);          // fn(teamId) → animated zoom, no re-render
  const teamDatasetsRef = useRef(new Map());     // teamId → [datasetId, ...]
  const deepExpandTeamRef = useRef(null);        // fn(teamId) → deep-expands team + all datasets

  const [selected,    setSelected]    = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [stats,       setStats]       = useState({ teams: 0, datasets: 0, services: 0 });
  const [teams,       setTeams]       = useState([]);

  toggleRef.current = (id) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  deepExpandTeamRef.current = (teamId) => {
    const dsIds = teamDatasetsRef.current.get(teamId) || [];
    setExpandedIds((prev) => {
      const n = new Set(prev);
      const alreadyFull = n.has(teamId) && dsIds.every((id) => n.has(id));
      if (alreadyFull) {
        n.delete(teamId);
        dsIds.forEach((id) => n.delete(id));
      } else {
        n.add(teamId);
        dsIds.forEach((id) => n.add(id));
      }
      return n;
    });
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const jsonLd = JSON.parse(jsonLdText);
    const { nodes: allNodes, links: allLinks } = buildGraph(jsonLd);

    const hasTeams     = allNodes.some((n) => n.type === "team");
    const teamNodes    = allNodes.filter((n) => n.type === "team");
    const teamColorMap = new Map(teamNodes.map((t, i) => [t.id, TEAM_PALETTE[i % TEAM_PALETTE.length]]));

    // Build team → [datasetId] map for deep-expand
    const tdMap = new Map();
    allLinks.forEach((l) => {
      if (l.linkType !== "team") return;
      const src = l.source?.id ?? l.source;
      const tgt = l.target?.id ?? l.target;
      if (!tdMap.has(src)) tdMap.set(src, []);
      tdMap.get(src).push(tgt);
    });
    teamDatasetsRef.current = tdMap;

    setTeams(teamNodes.map((t, i) => ({ id: t.id, label: t.label, color: TEAM_PALETTE[i % TEAM_PALETTE.length] })));
    setStats({
      teams:    teamNodes.length,
      datasets: allNodes.filter((n) => n.type === "dataset").length,
      services: allNodes.filter((n) => n.type === "service").length,
    });

    // ── Visibility ─────────────────────────────────────────────────────────
    const visibleIds = new Set();
    allNodes.forEach((n) => {
      if (n.type === "team") { visibleIds.add(n.id); return; }
      if (n.type === "dataset" && (!hasTeams || !n.teamId || expandedIds.has(n.teamId)))
        visibleIds.add(n.id);
    });
    allLinks.forEach((l) => {
      if (l.linkType !== "service") return;
      const dsId = l.source?.id ?? l.source;
      if (visibleIds.has(dsId) && expandedIds.has(dsId))
        visibleIds.add(l.target?.id ?? l.target);
    });

    const hasChildren = new Set();
    allLinks.forEach((l) => {
      if (l.linkType === "team" || l.linkType === "service")
        hasChildren.add(l.source?.id ?? l.source);
    });

    let nodes = allNodes
      .filter((n) => visibleIds.has(n.id))
      .map((d) => { const p = posRef.current.get(d.id); return p ? { ...d, x: p.x, y: p.y } : { ...d }; });

    const links = allLinks.filter((l) =>
      visibleIds.has(l.source?.id ?? l.source) && visibleIds.has(l.target?.id ?? l.target)
    );

    // ── D3 setup ───────────────────────────────────────────────────────────
    const container = svgRef.current.parentElement;
    const W = container.clientWidth, H = container.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);

    // Background grid
    const defs = svg.append("defs");
    const pat  = defs.append("pattern").attr("id", "grid").attr("width", 40).attr("height", 40).attr("patternUnits", "userSpaceOnUse");
    pat.append("path").attr("d", "M 40 0 L 0 0 0 40").attr("fill", "none").attr("stroke", "#00000008").attr("stroke-width", 1);
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", C.bg);
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "url(#grid)");

    // Glow filters
    ["team","dataset","service"].forEach((t) => {
      const f = defs.append("filter").attr("id", `gl-${t}`);
      f.append("feGaussianBlur").attr("stdDeviation", t === "team" ? 10 : t === "dataset" ? 5 : 3).attr("result", "blur");
      const fm = f.append("feMerge");
      fm.append("feMergeNode").attr("in", "blur");
      fm.append("feMergeNode").attr("in", "SourceGraphic");
    });

    // ── Zoom — create once, restore saved transform ─────────────────────
    const g = svg.append("g");

    if (!zoomBehavior.current) {
      zoomBehavior.current = d3.zoom().scaleExtent([0.06, 6]);
    }
    // Update the zoom handler to point at the new <g> element
    zoomBehavior.current.on("zoom", (e) => {
      g.attr("transform", e.transform);
      zoomRef.current = e.transform;   // save latest transform
    });

    svg.call(zoomBehavior.current);

    // Restore previous transform so the view doesn't jump on expand/collapse
    if (zoomRef.current) {
      svg.call(zoomBehavior.current.transform, zoomRef.current);
    }

    // Expose zoom-to-team so toolbar buttons can call it without any state change
    zoomToTeamRef.current = (teamId) => {
      const pos = posRef.current.get(teamId);
      if (!pos) return;
      const scale = 1.4;
      const tx = W / 2 - scale * pos.x;
      const ty = H / 2 - scale * pos.y;
      svg.transition().duration(650)
        .call(zoomBehavior.current.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    // ── Helpers ────────────────────────────────────────────────────────────
    const nodeRadius = (d) => d.type === "team" ? 20 : d.type === "dataset" ? 13 : 8;
    const nodeColor  = (d) => {
      if (d.type === "service") return C.service;
      const col = d.type === "team"
        ? teamColorMap.get(d.id)
        : (d.teamId ? teamColorMap.get(d.teamId) : null);
      return col || C.dataset;
    };

    // ── Simulation ─────────────────────────────────────────────────────────
    const isInitialLoad = posRef.current.size === 0;
    const anyNew = !isInitialLoad && nodes.some((n) => !posRef.current.has(n.id));

    // Seed brand-new nodes near their parent so they don't appear at the canvas
    // centre and drag everything else with them.
    if (!isInitialLoad) {
      nodes.forEach((n) => {
        if (posRef.current.has(n.id)) return;          // already placed
        const parentLink = allLinks.find((l) => {
          const tgt = l.target?.id ?? l.target;
          const src = l.source?.id ?? l.source;
          return tgt === n.id && posRef.current.has(src);
        });
        if (parentLink) {
          const p = posRef.current.get(parentLink.source?.id ?? parentLink.source);
          n.x = p.x + (Math.random() - 0.5) * 80;
          n.y = p.y + (Math.random() - 0.5) * 80;
        }
      });

      // Pin every already-positioned node so it cannot drift while the
      // simulation settles the newly-added ones (or cleans up after removal).
      nodes.forEach((n) => {
        if (posRef.current.has(n.id)) { n.fx = n.x; n.fy = n.y; }
      });
    }

    const sim = d3.forceSimulation(nodes)
      .alpha(isInitialLoad ? 0.9 : anyNew ? 0.45 : 0.01)
      .alphaDecay(isInitialLoad ? 0.028 : 0.06)
      .force("link", d3.forceLink(links).id((d) => d.id)
        .distance((l) => l.linkType === "team" ? 180 : 110)
        .strength(0.5))
      .force("charge",    d3.forceManyBody().strength((d) => d.type === "team" ? -800 : d.type === "dataset" ? -300 : -150))
      // forceCenter only on initial load — afterwards it pulls nodes away from
      // wherever the user has panned and causes the viewport to feel like it jumped.
      .force("center",    isInitialLoad ? d3.forceCenter(W / 2, H / 2) : null)
      .force("collision", d3.forceCollide().radius((d) => nodeRadius(d) + 55));

    // Release the position pins once the simulation has cooled so dragging
    // still works normally afterwards.
    if (!isInitialLoad) {
      sim.on("end", () => { nodes.forEach((n) => { n.fx = null; n.fy = null; }); });
    }

    // ── Links ──────────────────────────────────────────────────────────────
    const linkEl = g.append("g").selectAll("line").data(links).join("line")
      .attr("stroke",           (l) => l.linkType === "team" ? C.linkTeam : C.linkSvc)
      .attr("stroke-width",     (l) => l.linkType === "team" ? 2 : 1.5)
      .attr("stroke-opacity",   0.85)
      .attr("stroke-dasharray", (l) => l.linkType === "team" ? "none" : "4,3");

    // ── Node groups ────────────────────────────────────────────────────────
    const nodeG = g.append("g").selectAll("g").data(nodes).join("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (e, d) => {
        e.stopPropagation();
        if (d.type === "team") {
          deepExpandTeamRef.current(d.id);
        }
        setSelected(d);
      });

    svg.on("click", () => setSelected(null));

    // Glow
    nodeG.append("circle")
      .attr("r",      (d) => nodeRadius(d) + 10)
      .attr("fill",   (d) => nodeColor(d) + "12")
      .attr("filter", (d) => `url(#gl-${d.type})`);

    // Team ring (filled)
    nodeG.filter((d) => d.type === "team").append("circle")
      .attr("r",            20)
      .attr("fill",         (d) => nodeColor(d) + "22")
      .attr("stroke",       nodeColor)
      .attr("stroke-width", 2.5);

    // Dataset / service ring (hollow)
    nodeG.filter((d) => d.type !== "team").append("circle")
      .attr("r",            nodeRadius)
      .attr("fill",         C.bg)
      .attr("stroke",       nodeColor)
      .attr("stroke-width", 2);

    // Core dot
    nodeG.append("circle")
      .attr("r",    (d) => d.type === "team" ? 6 : d.type === "dataset" ? 4 : 2.5)
      .attr("fill", nodeColor);

    // ── Labels ─────────────────────────────────────────────────────────────
    const labelG = nodeG.append("text")
      .attr("text-anchor",    "middle")
      .attr("font-family",    "'Roboto', sans-serif")
      .attr("fill",           (d) => d.type === "team" ? nodeColor(d) : C.muted)
      .attr("font-size",      (d) => LABEL[d.type].fontSize)
      .attr("font-weight",    (d) => LABEL[d.type].fontWeight)
      .attr("pointer-events", "none");

    labelG.each(function(d) {
      const el  = d3.select(this);
      const cfg = LABEL[d.type];
      wrapTextNode(el, d.label, cfg.maxW, cfg.lineH);
      const baseY = nodeRadius(d) + 10;
      // Position first tspan at baseY, subsequent ones offset by lineH
      el.selectAll("tspan").each(function(_, i) {
        d3.select(this).attr("dy", i === 0 ? baseY : cfg.lineH);
      });
    });

    // ── Series count badge ──────────────────────────────────────────────────
    nodeG.filter((d) => d.type === "dataset" && d.seriesCount > 0).each(function(d) {
      const el    = d3.select(this);
      const label = `${d.seriesCount} series`;
      const bw    = label.length * 5.5 + 10;
      const bh    = 14;
      el.append("rect")
        .attr("x", -bw / 2).attr("y", -(nodeRadius(d) + bh + 4))
        .attr("width", bw).attr("height", bh).attr("rx", 3)
        .attr("fill",         C.serie + "25")
        .attr("stroke",       C.serie + "80")
        .attr("stroke-width", 1);
      el.append("text")
        .attr("x", 0).attr("y", -(nodeRadius(d) + 4) - bh / 2)
        .attr("text-anchor",       "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size",         "7.5px")
        .attr("font-family",       "'Roboto', sans-serif")
        .attr("fill",              C.serie)
        .attr("pointer-events",    "none")
        .text(label);
    });

    // ── Expand / collapse badges ───────────────────────────────────────────
    nodeG.filter((d) => hasChildren.has(d.id)).append("g")
      .attr("transform", (d) => `translate(${nodeRadius(d) - 2}, ${-(nodeRadius(d) - 2)})`)
      .on("click", (e, d) => { e.stopPropagation(); toggleRef.current(d.id); })
      .call((bg) => {
        bg.append("circle")
          .attr("r",            7)
          .attr("fill",         C.panel)
          .attr("stroke",       (d) => expandedIds.has(d.id) ? C.service : nodeColor(d))
          .attr("stroke-width", 1.5)
          .style("cursor",      "pointer");
        bg.append("text")
          .attr("text-anchor",       "middle")
          .attr("dominant-baseline", "central")
          .attr("font-size",         "13px")
          .attr("font-family",       "sans-serif")
          .attr("fill",              (d) => expandedIds.has(d.id) ? C.service : nodeColor(d))
          .attr("pointer-events",    "none")
          .text((d) => expandedIds.has(d.id) ? "−" : "+");
      });

    // ── Hover highlight ────────────────────────────────────────────────────
    nodeG.on("mouseenter", (_, d) => {
      const conn = new Set([d.id]);
      links.forEach((l) => {
        const s = l.source?.id ?? l.source, t = l.target?.id ?? l.target;
        if (s === d.id) conn.add(t); if (t === d.id) conn.add(s);
      });
      nodeG.style("opacity",  (n) => conn.has(n.id) ? 1 : 0.07);
      linkEl.style("opacity", (l) => {
        const s = l.source?.id ?? l.source, t = l.target?.id ?? l.target;
        return (conn.has(s) && conn.has(t)) ? 1 : 0.03;
      }).attr("stroke", (l) => {
        const s = l.source?.id ?? l.source, t = l.target?.id ?? l.target;
        if (!(conn.has(s) && conn.has(t))) return C.linkTeam;
        return l.linkType === "team" ? nodeColor(d) : C.accent;
      });
    }).on("mouseleave", () => {
      nodeG.style("opacity", 1);
      linkEl.style("opacity", 0.85)
            .attr("stroke", (l) => l.linkType === "team" ? C.linkTeam : C.linkSvc);
    });

    // ── Tick ───────────────────────────────────────────────────────────────
    sim.on("tick", () => {
      linkEl.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeG.attr("transform", (d) => `translate(${d.x},${d.y})`);
      nodes.forEach((n) => posRef.current.set(n.id, { x: n.x, y: n.y }));
    });

    return () => sim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonLdText, expandedIds]);

  // ── Expand / collapse all ─────────────────────────────────────────────────
  const allExpandableIds = (() => {
    try {
      const { links } = buildGraph(JSON.parse(jsonLdText));
      const ids = new Set();
      links.forEach((l) => {
        if (l.linkType === "team" || l.linkType === "service")
          ids.add(l.source?.id ?? l.source);
      });
      return [...ids];
    } catch { return []; }
  })();
  const allExpanded = allExpandableIds.length > 0 && allExpandableIds.every((id) => expandedIds.has(id));

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, flexWrap: "wrap" }}>
        <Btn onClick={onBack} style={{ padding: "4px 10px" }}>← Paste</Btn>
        <div style={{ width: 1, height: 22, background: C.border }} />
        {[
          { l: "Teams",    v: stats.teams,    col: TEAM_PALETTE[0] },
          { l: "Datasets", v: stats.datasets, col: C.dataset },
          { l: "Services", v: stats.services, col: C.service },
        ].map((s) => (
          <div key={s.l} style={{ textAlign: "center", minWidth: 42 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.col, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
          </div>
        ))}
        <div style={{ width: 1, height: 22, background: C.border }} />
        <Btn active={allExpanded} color={C.service}
          onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(allExpandableIds))}
          style={{ padding: "4px 12px" }}>
          {allExpanded ? "− Collapse all" : "+ Expand all"}
        </Btn>
        {teams.length > 0 && (
          <>
            <div style={{ width: 1, height: 22, background: C.border }} />
            {teams.map((t) => {
              const active = expandedIds.has(t.id);
              return (
                <Btn key={t.id} active={active} color={t.color}
                  onClick={() => zoomToTeamRef.current?.(t.id)}>
                  ◎ {t.label}
                </Btn>
              );
            })}
          </>
        )}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 14, left: 14, background: C.panel, border: `1px solid ${C.border}`, padding: "10px 14px", borderRadius: 4, minWidth: 160 }}>
          {[
            { col: TEAM_PALETTE[0], l: "Team",         solid: true  },
            { col: C.dataset,       l: "Dataset",       solid: false },
            { col: C.service,       l: "Service",       solid: false },
            { col: C.serie,         l: "Series count",  solid: false },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: x.solid ? x.col + "35" : C.bg, border: `2px solid ${x.col}`, flexShrink: 0 }} />
              {x.l}
            </div>
          ))}
          <div style={{ fontSize: 8, color: C.border, marginTop: 6 }}>
            <span style={{ color: C.accent + "99" }}>+</span> expand · Click team to expand all · Drag · Scroll zoom
          </div>
        </div>

        {/* Detail panel */}
        {selected && (() => {
          const teamCol   = selected.type === "team"
            ? teams.find((t) => t.id === selected.id)?.color || C.accent
            : selected.teamId ? teams.find((t) => t.id === selected.teamId)?.color || C.dataset : C.dataset;
          const borderCol = selected.type === "service" ? C.service : teamCol;
          return (
            <div style={{ position: "absolute", top: 14, right: 14, width: 310, background: C.panel, border: `1px solid ${borderCol}`, borderRadius: 4, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, color: borderCol }}>
                  {selected.type}{selected.format ? ` · ${selected.format}` : ""}
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12, lineHeight: 1.4 }}>{selected.label}</div>
              <div style={{ fontSize: 9, lineHeight: 2.2 }}>
                {[
                  { k: "ID",     v: selected.id },
                  selected.organization && { k: "Org",    v: selected.organization },
                  selected.teamId       && { k: "Team",   v: teams.find((t) => t.id === selected.teamId)?.label || selected.teamId },
                  selected.seriesCount  && { k: "Series", v: `${selected.seriesCount} datasets` },
                  selected.isDokData !== null && selected.isDokData !== undefined && { k: "DOK",    v: selected.isDokData ? "Yes" : "No", highlight: selected.isDokData ? C.dok : null },
                  selected.dataAccess != null && { k: "Access", v: selected.dataAccess },
                ].filter(Boolean).map((row) => (
                  <div key={row.k} style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0, width: 44 }}>{row.k}</span>
                    <span style={{ color: row.highlight || C.text, wordBreak: "break-all" }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [stage,      setStage]      = useState("paste");
  const [jsonLdText, setJsonLdText] = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Roboto+Mono&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: C.bg, color: C.text, fontFamily: "'Roboto', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "9px 18px", borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: "0.15em" }}>GEONORGE</div>
        <div style={{ color: C.border }}>|</div>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.1em" }}>DCAT JSON-LD · Team → Dataset → Service Graph</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          {[["paste","1 · JSON-LD"],["graph","2 · Graph"]].map(([s, l], i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <div style={{ color: C.border }}>›</div>}
              <div style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: stage === s ? C.accent : C.border, fontWeight: stage === s ? 700 : 400 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: stage === "graph" ? "stretch" : "center", justifyContent: "center", padding: stage === "graph" ? 0 : "40px 24px", overflowY: stage === "graph" ? "hidden" : "auto" }}>
        {stage === "paste" && <StagePaste onLoaded={(ld) => { setJsonLdText(ld); setStage("graph"); }} />}
        {stage === "graph" && <Graph jsonLdText={jsonLdText} onBack={() => setStage("paste")} />}
      </div>
    </div>
  );
}
