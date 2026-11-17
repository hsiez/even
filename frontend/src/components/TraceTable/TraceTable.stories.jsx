import React, { useState } from "react";
import { TraceTable } from "./TraceTable";
import { trace, spans, agents, sessions } from "../../test/fixtures";
import { traceHistory, observedReloads } from "../../test/fixtures";
import { Button } from "../Button/Button";
import "./InlineEllipsisExperiment.css";

export default { title: "Workbench/TraceTable", component: TraceTable };

export const Default = {
  parameters: {
    docs: {
      description: {
        story:
          "Hover the header row to reveal subtle column-resize dividers. Hover or drag a handle to emphasize it; keyboard focus reveals it without a pointer.",
      },
    },
  },
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <TraceTable
        traces={[trace, { traceId: "b", label: "Unknown execution" }]}
        selectedTraceId={value}
        onSelectTrace={setValue}
        onSortChange={() => {}}
      />
    );
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <TraceTable traces={[]} />;
  },
};

export const SelectedRow = {
  parameters: {
    docs: {
      description: {
        story:
          "Selected text and the Operation action share the selection foreground. Outcome labels retain their own status colors; hover and keyboard focus preserve the row’s selection surface.",
      },
    },
  },
  render: function Example() {
    const [selected, setSelected] = useState(trace.traceId);
    return (
      <TraceTable
        traces={traceHistory}
        selectedTraceId={selected}
        onSelectTrace={setSelected}
      />
    );
  },
};

export const ReloadTimeline = {
  render: function Example() {
    const [selected, setSelected] = useState();
    const [sort, setSort] = useState({
      key: "startedAt",
      direction: "descending",
    });
    const ordered = [...traceHistory].sort(
      (a, b) =>
        (sort.direction === "ascending" ? 1 : -1) *
        (sort.key === "startedAt"
          ? Date.parse(a.startedAt) - Date.parse(b.startedAt)
          : a.durationMs - b.durationMs),
    );
    return (
      <TraceTable
        traces={ordered}
        reloads={observedReloads}
        selectedTraceId={selected}
        onSelectTrace={setSelected}
        sort={sort}
        onSortChange={setSort}
      />
    );
  },
};

export const ReloadBeforeAnyTraces = {
  render: () => <TraceTable traces={[]} reloads={observedReloads} />,
};

export const ControlledColumnWidths = {
  render: function Example() {
    const [widths, setWidths] = useState({ durationMs: 160 });
    const [selected, setSelected] = useState();
    return (
      <>
        <Button onClick={() => setWidths({})}>Reset column widths</Button>
        <TraceTable
          traces={traceHistory}
          reloads={observedReloads}
          columnWidths={widths}
          onColumnWidthsChange={setWidths}
          selectedTraceId={selected}
          onSelectTrace={setSelected}
        />
        <pre aria-label="Controlled column widths">
          {JSON.stringify(widths, null, 2)}
        </pre>
      </>
    );
  },
};

export const NarrowWithLongContent = {
  render: function Example() {
    const [selected, setSelected] = useState();
    const longTraces = traceHistory.map((trace) => ({
      ...trace,
      label: `${trace.label}: ${"Long recorded operation details ".repeat(12)}`,
      agentNames: [
        "support-agent-with-a-long-name-that-must-not-widen-the-column",
      ],
    }));
    return (
      <div style={{ width: "min(100%, 32rem)" }}>
        <TraceTable
          traces={longTraces}
          reloads={observedReloads}
          defaultColumnWidths={{
            startedAt: 160,
            durationMs: 112,
            agent: 96,
            operation: 160,
            calls: 112,
          }}
          selectedTraceId={selected}
          onSelectTrace={setSelected}
        />
      </div>
    );
  },
};

export const CharacterEllipsis = {
  parameters: {
    docs: {
      description: {
        story:
          "Resize Operation to sweep a fixed, right-aligned ellipsis over the label. Complete graphemes disappear as space runs out; full labels remain accessible.",
      },
    },
  },
  render: function Example() {
    const [widths, setWidths] = useState({ operation: 200 });
    const [selected, setSelected] = useState();
    const labels = [
      "Investigate deployment failure across production",
      "Inspect configuration for the support agent",
      "Read deployment logs 👩🏽‍💻 and retry",
      "Verify permissions and await approval",
    ];
    const traces = traceHistory.map((trace, index) => ({
      ...trace,
      label: labels[index],
    }));
    return (
      <>
        <p>
          Drag the right edge of Operation. Hidden values use a fixed right-edge
          ellipsis; complete characters return as space becomes available.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--even-space-gap-related)",
            marginBlockEnd: "var(--even-space-gap-group)",
          }}
        >
          <Button onClick={() => setWidths({ operation: 200 })}>
            Reset column width
          </Button>
        </div>
        <TraceTable
          traces={traces}
          reloads={observedReloads}
          columnWidths={widths}
          onColumnWidthsChange={setWidths}
          selectedTraceId={selected}
          onSelectTrace={setSelected}
        />
      </>
    );
  },
};

export const InlineEllipsisExperiment = {
  parameters: {
    docs: {
      description: {
        story:
          "Storybook-only native ellipsis experiment. The marker follows the last visible character, leaving spare space between the text plus ellipsis and the column boundary. Toggle it to compare with the current fixed-marker table. No font or default component behavior changes.",
      },
    },
  },
  render: function Example() {
    const [inline, setInline] = useState(true);
    const [widths, setWidths] = useState({ operation: 200 });
    const [selected, setSelected] = useState();
    const labels = [
      "Investigate deployment failure across production",
      "Inspect configuration for the support agent",
      "Read deployment logs 👩🏽‍💻 and retry",
      "Verify permissions and await approval",
    ];
    return (
      <>
        <p>
          Experiment: drag Operation’s right divider slowly. The text and
          ellipsis retreat together; spare space opens after the ellipsis.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--even-space-gap-related)",
            marginBlockEnd: "var(--even-space-gap-group)",
          }}
        >
          <Button
            aria-pressed={inline}
            onClick={() => setInline((value) => !value)}
          >
            Inline ellipsis
          </Button>
          <Button onClick={() => setWidths({ operation: 200 })}>
            Reset column width
          </Button>
        </div>
        <div className={inline ? "even-inline-ellipsis-experiment" : undefined}>
          <TraceTable
            traces={traceHistory.map((trace, index) => ({
              ...trace,
              label: labels[index],
            }))}
            reloads={observedReloads}
            columnWidths={widths}
            onColumnWidthsChange={setWidths}
            selectedTraceId={selected}
            onSelectTrace={setSelected}
          />
        </div>
      </>
    );
  },
};
