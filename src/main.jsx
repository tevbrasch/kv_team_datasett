import { useState } from "react";
import { createRoot } from "react-dom/client";
import GraphApp from "./geonorge-graph";
import TablesApp from "./geonorge-tables";

function Launcher() {
  const [view, setView] = useState(null);
  if (view === "graph")  return <GraphApp />;
  if (view === "tables") return <TablesApp />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100vh", gap: 16, fontFamily: "sans-serif" }}>
      <h2>GeoNorge Viewer</h2>
      <button onClick={() => setView("graph")}>Graph View</button>
      <button onClick={() => setView("tables")}>Table View</button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Launcher />);
createRoot(document.getElementById("root")).render(<Root />);
