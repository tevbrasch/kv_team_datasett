import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseTeams(jsonLd) {
  const graph = jsonLd["@graph"];
  if (!Array.isArray(graph)) throw new Error('JSON-LD must have a "@graph" array.');

  return graph
    .filter((item) => item["@type"] === "geonorge:Team")
    .map((team) => {
      const datasets = (team["dcat:dataset"] || []).map((ds) => {
        const services = ds["dcat:service"] || [];
        const wfs = (Array.isArray(services) ? services : [services])
          .find((s) => s["dcterms:format"] === "OGC:WFS");
        const wms = (Array.isArray(services) ? services : [services])
          .find((s) => s["dcterms:format"] === "OGC:WMS");
        const seriesCount = ds["geonorge:seriesCount"] || 0;

        return {
          identifier:   ds["dcterms:identifier"] || ds["@id"] || "—",
          title:        ds["dcterms:title"] || "Unnamed Dataset",
          hasSeries:    seriesCount > 0,
          seriesCount,
          wfsTitle:     wfs?.["dcterms:title"] || "",
          wmsTitle:     wms?.["dcterms:title"] || "",
          isDokData:    ds["geonorge:isDokData"]  ?? null,
          dataAccess:   ds["geonorge:dataAccess"] ?? null,
        };
      });

      return {
        id:    team["@id"],
        title: team["dcterms:title"] || "Unnamed Team",
        datasets,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:      "#f8fafc",
  panel:   "#ffffff",
  border:  "#e2e8f0",
  row:     "#f8fafc",
  rowAlt:  "#f1f5f9",
  text:    "#1e293b",
  muted:   "#64748b",
  accent:  "#0284c7",
  service: "#059669",
  serie:   "#7c3aed",
  dok:     "#0891b2",
  yes:     "#059669",
  no:      "#e2e8f0",
  error:   "#dc2626",
};

const TEAM_PALETTE = [
  "#f472b6","#34d399","#facc15","#60a5fa",
  "#fb923c","#4ade80","#e879f9","#38bdf8",
  "#f87171","#a78bfa",
];

// ─────────────────────────────────────────────────────────────────────────────
// Team table
// ─────────────────────────────────────────────────────────────────────────────

const COL_WIDTHS = {
  title:      "23%",
  identifier: "18%",
  series:     "6%",
  wfs:        "18%",
  wms:        "18%",
  dok:        "7%",
  access:     "10%",
};

function TeamTable({ team, color, index }) {
  const [open,    setOpen]    = useState(true);
  const [sortCol, setSortCol] = useState(null);   // "title"|"series"|"wfs"|"wms"|"dok"|"access"
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = [...team.datasets].sort((a, b) => {
    if (!sortCol) return 0;
    let av, bv;
    if (sortCol === "title")  { av = a.title.toLowerCase();   bv = b.title.toLowerCase(); }
    if (sortCol === "series") { av = a.seriesCount;            bv = b.seriesCount; }
    if (sortCol === "wfs")    { av = a.wfsTitle.toLowerCase(); bv = b.wfsTitle.toLowerCase(); }
    if (sortCol === "wms")    { av = a.wmsTitle.toLowerCase(); bv = b.wmsTitle.toLowerCase(); }
    if (sortCol === "dok")    { av = a.isDokData === true ? 0 : a.isDokData === false ? 1 : 2;
                                bv = b.isDokData === true ? 0 : b.isDokData === false ? 1 : 2; }
    if (sortCol === "access") { av = (a.dataAccess ?? "").toLowerCase(); bv = (b.dataAccess ?? "").toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 :  1;
    if (av > bv) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: 3 }}>⇅</span>;
    return <span style={{ marginLeft: 3, color }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Team header */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            10,
          padding:        "10px 16px",
          background:     color + "18",
          border:         `1px solid ${color + "55"}`,
          borderRadius:   open ? "6px 6px 0 0" : 6,
          cursor:         "pointer",
          userSelect:     "none",
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color, letterSpacing: "0.08em", flex: 1, display: "flex", alignItems: "baseline", gap: 8 }}>
          {team.title}
          <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, letterSpacing: 0 }}>
            {team.datasets.length} dataset{team.datasets.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginLeft: 8 }}>{open ? "▲" : "▼"}</div>
      </div>

      {/* Table */}
      {open && (
        <div style={{ border: `1px solid ${color + "30"}`, borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_WIDTHS.title }} />
              <col style={{ width: COL_WIDTHS.identifier }} />
              <col style={{ width: COL_WIDTHS.series }} />
              <col style={{ width: COL_WIDTHS.wfs }} />
              <col style={{ width: COL_WIDTHS.wms }} />
              <col style={{ width: COL_WIDTHS.dok }} />
              <col style={{ width: COL_WIDTHS.access }} />
            </colgroup>
            <thead>
              <tr style={{ background: C.panel }}>
                {[
                  { label: "Title",       col: "title",  color: C.muted },
                  { label: "Identifier",  col: null,     color: C.muted },
                  { label: "Series",      col: "series", color: C.muted,    center: true },
                  { label: "WFS Service", col: "wfs",    color: C.service },
                  { label: "WMS Service", col: "wms",    color: C.service },
                  { label: "DOK",         col: "dok",    color: C.dok,      center: true },
                  { label: "Access",      col: "access", color: C.muted },
                ].map((h) => (
                  <th key={h.label}
                    onClick={h.col ? () => handleSort(h.col) : undefined}
                    style={{
                      padding:       "8px 12px",
                      fontSize:       11,
                      fontFamily:    "'Roboto', sans-serif",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color:          h.col ? (sortCol === h.col ? color : (h.color || C.muted)) : C.muted,
                      textAlign:      h.center ? "center" : "left",
                      fontWeight:     600,
                      borderBottom:  `1px solid ${C.border}`,
                      whiteSpace:    "nowrap",
                      cursor:         h.col ? "pointer" : "default",
                      userSelect:    "none",
                    }}>
                    {h.label}{h.col && <SortIcon col={h.col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((ds, i) => (
                <tr key={ds.identifier}
                  style={{ background: i % 2 === 0 ? C.row : C.rowAlt }}
                  onMouseEnter={(e) => e.currentTarget.style.background = color + "12"}
                  onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? C.row : C.rowAlt}
                >
                  {/* Title */}
                  <td style={{ padding: "9px 12px", fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>
                    {ds.title}
                  </td>

                  {/* Identifier */}
                  <td style={{ padding: "9px 12px", fontSize: 11, color: C.muted, fontFamily: "'Roboto Mono', monospace", borderBottom: `1px solid ${C.border}`, wordBreak: "break-all" }}>
                    {ds.identifier}
                  </td>

                  {/* Series */}
                  <td style={{ padding: "9px 12px", textAlign: "center", borderBottom: `1px solid ${C.border}` }}>
                    {ds.hasSeries ? (
                      <span title={`${ds.seriesCount} datasets in series`} style={{
                        display:       "inline-block",
                        padding:       "2px 7px",
                        fontSize:       10,
                        fontFamily:    "'Roboto', sans-serif",
                        background:    C.serie + "20",
                        color:          C.serie,
                        border:        `1px solid ${C.serie + "60"}`,
                        borderRadius:   3,
                        whiteSpace:    "nowrap",
                      }}>
                        {ds.seriesCount}
                      </span>
                    ) : (
                      <span style={{ color: C.border, fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* WFS */}
                  <td style={{ padding: "9px 12px", fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                    {ds.wfsTitle ? (
                      <span style={{ color: C.service }}>{ds.wfsTitle}</span>
                    ) : (
                      <span style={{ color: C.border }}>—</span>
                    )}
                  </td>

                  {/* WMS */}
                  <td style={{ padding: "9px 12px", fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                    {ds.wmsTitle ? (
                      <span style={{ color: C.service }}>{ds.wmsTitle}</span>
                    ) : (
                      <span style={{ color: C.border }}>—</span>
                    )}
                  </td>

                  {/* DOK */}
                  <td style={{ padding: "9px 12px", textAlign: "center", borderBottom: `1px solid ${C.border}` }}>
                    {ds.isDokData === true ? (
                      <span title="DOK dataset" style={{
                        display: "inline-block", padding: "2px 6px",
                        fontSize: 10, fontFamily: "'Roboto', sans-serif",
                        background: C.dok + "18", color: C.dok,
                        border: `1px solid ${C.dok + "55"}`, borderRadius: 3,
                      }}>✓</span>
                    ) : ds.isDokData === false ? (
                      <span style={{ color: C.border, fontSize: 12 }}>—</span>
                    ) : (
                      <span style={{ color: C.border, fontSize: 12 }}>?</span>
                    )}
                  </td>

                  {/* Access */}
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.border}` }}>
                    {ds.dataAccess != null ? (
                      <span style={{
                        display: "inline-block", padding: "2px 6px",
                        fontSize: 10, fontFamily: "'Roboto', sans-serif",
                        background: C.muted + "15", color: C.text,
                        border: `1px solid ${C.border}`, borderRadius: 3,
                        whiteSpace: "nowrap",
                      }}>{ds.dataAccess}</span>
                    ) : (
                      <span style={{ color: C.border, fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Load panel
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_URL = "https://raw.githubusercontent.com/tevbrasch/kv_team_datasett/main/output_with_teams.json";

function StagePaste({ onLoaded }) {
  const [url,     setUrl]     = useState(DEFAULT_URL);
  const [text,    setText]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const loadFromUrl = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      const raw = await res.text();
      const teams = parseTeams(JSON.parse(raw));   // validate before accepting
      if (!teams.length) throw new Error("No geonorge:Team nodes found in @graph.");
      onLoaded(raw);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handlePaste = () => {
    try {
      const parsed = JSON.parse(text);
      const teams  = parseTeams(parsed);
      if (!teams.length) throw new Error("No geonorge:Team nodes found in @graph.");
      setError("");
      onLoaded(text);
    } catch (e) { setError(e.message); }
  };

  return (
    <div style={{ maxWidth: 640, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, marginBottom: 2 }}>Load JSON-LD</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
        Load directly from a URL, or paste the JSON-LD manually below.
      </div>

      {/* URL loader */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="https://..."
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 4, fontSize: 12,
            border: `1px solid ${C.border}`, background: C.panel,
            color: C.text, fontFamily: "'Roboto Mono', monospace", outline: "none",
          }}
        />
        <button
          onClick={loadFromUrl}
          disabled={!url.trim() || loading}
          style={{
            padding: "8px 18px", fontSize: 12, fontFamily: "'Roboto', sans-serif",
            letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 3,
            background: (!url.trim() || loading) ? C.border : C.accent,
            color: (!url.trim() || loading) ? C.muted : C.panel,
            border: "none", cursor: (!url.trim() || loading) ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Loading…" : "Load URL →"}
        </button>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>or paste manually</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* Paste area */}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(""); }}
        placeholder='{ "@context": { ... }, "@graph": [ ... ] }'
        style={{
          width: "100%", height: 240, background: C.panel,
          border: `1px solid ${error ? C.error : C.border}`, borderRadius: 4,
          color: C.text, fontFamily: "'Roboto Mono', monospace", fontSize: 12,
          padding: 12, resize: "vertical", outline: "none",
          boxSizing: "border-box", lineHeight: 1.6,
        }}
      />
      {error && <div style={{ fontSize: 12, color: C.error }}>Error: {error}</div>}
      <button
        onClick={handlePaste}
        disabled={!text.trim()}
        style={{
          alignSelf: "flex-start", padding: "8px 20px", fontSize: 12,
          fontFamily: "'Roboto', sans-serif", letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: text.trim() ? C.accent : C.border,
          color:      text.trim() ? C.panel  : C.muted,
          border: "none", borderRadius: 3,
          cursor: text.trim() ? "pointer" : "default",
        }}
      >
        Build Tables →
      </button>
    </div>
  );
}

function exportCsv(teams) {
  const esc = (s) => {
    const str = String(s ?? "");
    // Wrap in quotes if the value contains a comma, quote, or newline
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headers = ["Team", "Title", "Identifier", "WFS Service", "WMS Service", "Series Count", "DOK Data", "Data Access"];
  const rows = teams.flatMap((team) =>
    team.datasets.map((ds) => [
      team.title,
      ds.title,
      ds.identifier,
      ds.wfsTitle,
      ds.wmsTitle,
      ds.seriesCount > 0 ? ds.seriesCount : "",
      ds.isDokData === true ? "Yes" : ds.isDokData === false ? "No" : "",
      ds.dataAccess ?? "",
    ].map(esc).join(","))
  );

  // BOM (\uFEFF) ensures Excel opens UTF-8 correctly
  const csv  = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: "kv-datasett-export.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tables view
// ─────────────────────────────────────────────────────────────────────────────

function Tables({ jsonLdText, onBack }) {
  const teams = parseTeams(JSON.parse(jsonLdText));

  const totalDatasets = teams.reduce((n, t) => n + t.datasets.length, 0);
  const totalWfs      = teams.reduce((n, t) => n + t.datasets.filter((d) => d.wfsTitle).length, 0);
  const totalWms      = teams.reduce((n, t) => n + t.datasets.filter((d) => d.wmsTitle).length, 0);
  const totalDok      = teams.reduce((n, t) => n + t.datasets.filter((d) => d.isDokData === true).length, 0);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 20px", borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
        <button onClick={onBack} style={{ padding: "4px 10px", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 3, cursor: "pointer" }}>
          ← Paste
        </button>
        <div style={{ width: 1, height: 22, background: C.border }} />
        {[
          { l: "Teams",    v: teams.length,   col: TEAM_PALETTE[0] },
          { l: "Datasets", v: totalDatasets,  col: C.accent },
          { l: "WFS",      v: totalWfs,       col: C.service },
          { l: "WMS",      v: totalWms,       col: C.service },
          { l: "DOK",      v: totalDok,       col: C.dok },
        ].map((s) => (
          <div key={s.l} style={{ textAlign: "center", minWidth: 36 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.col, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <button onClick={() => exportCsv(teams)} style={{
            padding: "5px 14px", fontSize: 11, fontFamily: "'Roboto', sans-serif",
            letterSpacing: "0.08em", textTransform: "uppercase",
            background: C.accent, color: "#fff",
            border: "none", borderRadius: 3, cursor: "pointer",
          }}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Tables */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {teams.map((team, i) => (
          <TeamTable
            key={team.id}
            team={team}
            color={TEAM_PALETTE[i % TEAM_PALETTE.length]}
            index={i}
          />
        ))}
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
        <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, letterSpacing: "0.15em" }}>GEONORGE</div>
        <div style={{ color: C.border }}>|</div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>DCAT JSON-LD · Dataset Tables by Team</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          {[["paste","1 · JSON-LD"],["tables","2 · Tables"]].map(([s, l], i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <div style={{ color: C.border }}>›</div>}
              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: stage === s ? C.accent : C.border, fontWeight: stage === s ? 700 : 400 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: stage === "tables" ? "stretch" : "center", justifyContent: "center", padding: stage === "tables" ? 0 : "40px 24px" }}>
        {stage === "paste"  && <StagePaste onLoaded={(ld) => { setJsonLdText(ld); setStage("tables"); }} />}
        {stage === "tables" && <Tables jsonLdText={jsonLdText} onBack={() => setStage("paste")} />}
      </div>
    </div>
  );
}
