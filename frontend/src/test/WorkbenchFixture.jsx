import React, { useState } from "react";
import { WorkbenchLayout } from "../components/WorkbenchLayout/WorkbenchLayout";
import { Sidebar } from "../components/Sidebar/Sidebar";
import { AgentSelector } from "../components/AgentSelector/AgentSelector";
import { TraceToolbar } from "../components/TraceToolbar/TraceToolbar";
import { ResultsState } from "../components/ResultsState/ResultsState";
import { TraceTable } from "../components/TraceTable/TraceTable";
import { InspectorPanel } from "../components/InspectorPanel/InspectorPanel";
import { TraceSummary } from "../components/TraceSummary/TraceSummary";
import { SpanWaterfall } from "../components/SpanWaterfall/SpanWaterfall";
import { SpanDetails } from "../components/SpanDetails/SpanDetails";
import { Tabs } from "../components/Tabs/Tabs";
import { SessionSelector } from "../components/SessionSelector/SessionSelector";
import { MessageComposer } from "../components/MessageComposer/MessageComposer";
import { Conversation } from "../components/Conversation/Conversation";
import { agents, trace } from "./fixtures";

// Demonstrates composition with deterministic data, not a live Eve connection.
export function WorkbenchFixture() {
  const [agent, setAgent] = useState("support");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState();
  const [spanId, setSpanId] = useState();
  const [sort, setSort] = useState({
    key: "startedAt",
    direction: "descending",
  });
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState({});
  const traces = [trace].filter(
    (item) =>
      item.agentNames.includes(agent) &&
      `${item.traceId} ${item.label}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <WorkbenchLayout
      navigation={
        <Sidebar>
          <AgentSelector
            agents={agents}
            value={agent}
            onValueChange={(id) => {
              setAgent(id);
              setSelected(undefined);
              setSpanId(undefined);
              setSessionId("");
            }}
          />
        </Sidebar>
      }
      inspector={
        <InspectorPanel
          open={!!selected}
          onClose={() => setSelected(undefined)}
        >
          <InspectorPanel.Header>
            <h2>Inspect execution</h2>
            <InspectorPanel.Close />
          </InspectorPanel.Header>
          <InspectorPanel.Body>
            {selected && (
              <>
                <TraceSummary trace={selected} />
                <SpanWaterfall
                  spans={selected.spans}
                  selectedSpanId={spanId}
                  onSelectSpan={setSpanId}
                  defaultExpandedSpanIds={["root"]}
                >
                  <SpanWaterfall.Tree />
                  <SpanWaterfall.Timeline />
                </SpanWaterfall>
                <SpanDetails
                  span={selected.spans.find((span) => span.spanId === spanId)}
                />
              </>
            )}
          </InspectorPanel.Body>
        </InspectorPanel>
      }
    >
      <h1>Even component workbench</h1>
      <p>Fixture data only. No Eve server or model is contacted.</p>
      <Tabs defaultValue="traces">
        <Tabs.List label="Workbench views">
          <Tabs.Trigger value="traces">Traces</Tabs.Trigger>
          <Tabs.Trigger value="playground">Playground</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="traces">
          <TraceToolbar
            query={query}
            onQueryChange={setQuery}
            onRefresh={() => {}}
          />
          <ResultsState
            state={traces.length ? "ready" : query ? "no-matches" : "empty"}
          >
            <TraceTable
              traces={traces}
              sort={sort}
              onSortChange={setSort}
              selectedTraceId={selected?.traceId}
              onSelectTrace={() => {
                setSpanId(undefined);
                setSelected(trace);
              }}
            />
          </ResultsState>
        </Tabs.Panel>
        <Tabs.Panel value="playground">
          <SessionSelector
            sessions={sessions.filter((session) => session.agentId === agent)}
            value={sessionId}
            onValueChange={setSessionId}
            onCreate={() => {
              const id = `fixture-${sessions.length + 1}`;
              setSessions([...sessions, { id, agentId: agent }]);
              setSessionId(id);
            }}
          />
          <Conversation key={sessionId} messages={messages[sessionId] ?? []} />
          <MessageComposer
            key={`composer-${sessionId}`}
            disabled={!sessionId}
            onSend={async (content) => {
              setMessages((previous) => ({
                ...previous,
                [sessionId]: [
                  ...(previous[sessionId] ?? []),
                  { id: `message-${Date.now()}`, role: "user", content },
                ],
              }));
            }}
          />
        </Tabs.Panel>
      </Tabs>
    </WorkbenchLayout>
  );
}
