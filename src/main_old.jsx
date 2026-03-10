import { useState } from "react";
import { createRoot } from "react-dom/client";
import GraphApp from "./geonorge-graph.jsx";
import TablesApp from "./geonorge-tables.jsx";

const C = {
  bg:     "#080d16",
  panel:  "#0d1424",
  border: "#1a2540",
  text:   "#dce8f5",
  muted:  "#4a6080",
  accent: "#38bdf8",
};

function Root() {
  const [view, setView] = useState("graph");

  return (
    <div style={{ width: "100vw", height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 18px", background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: "0.15em", fontFamily: "'Courier New', monospace", marginRight: 20, padding: "10px 0" }}>
          GEONORGE
        </div>

        {[
          { id: "graph",  label: "Graph View" },
          { id: "tables", label: "Table View" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              padding:       "12px 18px",
              fontSize:       10,
              fontFamily:    "'Courier New', monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background:    "transparent",
              color:          view === tab.id ? C.accent : C.muted,
              border:         "none",
              borderBottom:  `2px solid ${view === tab.id ? C.accent : "transparent"}`,
              cursor:         "pointer",
              transition:    "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* View */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: view === "graph"  ? "contents" : "none" }}><GraphApp /></div>
        <div style={{ display: view === "tables" ? "contents" : "none" }}><TablesApp /></div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
