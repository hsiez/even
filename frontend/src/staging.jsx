import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./components";
import { HomePage } from "./pages";
import {
  createSampleTrace,
  previewAgents,
  previewTraces,
} from "./pages/HomePage/previewData";
import "./app.css";

function StagingApp() {
  const [traces, setTraces] = useState(previewTraces);
  const sequence = useRef(previewTraces.length);
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    document.documentElement.dataset.evenTheme = theme;
  }, [theme]);
  return (
    <HomePage
      workspaceName="Staging workspace"
      agents={previewAgents}
      traces={traces}
      dataLabel="Staging · simulated data"
      theme={theme}
      onThemeChange={setTheme}
      actions={
        <>
          <Button
            size="compact"
            onClick={() => {
              const trace = createSampleTrace(++sequence.current);
              setTraces((previous) => [trace, ...previous]);
            }}
          >
            Generate sample trace
          </Button>
        </>
      }
    />
  );
}

createRoot(document.getElementById("root")).render(<StagingApp />);
