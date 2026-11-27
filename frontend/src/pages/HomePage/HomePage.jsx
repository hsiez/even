import React, { useCallback, useId, useReducer, useRef } from "react";
import { RegisteredTab } from "../../components/WorkbenchTabs/RegisteredTab";
import {
  Button,
  MessageComposer,
  Notice,
  Sidebar,
  ThemeToggle,
  WorkbenchLayout,
  WorkbenchTabs,
} from "../../components";
import { TraceExplorer } from "./TraceExplorer";
import { createWorkspace, workspaceReducer } from "./workspaceState";
import "./HomePage.css";

export function HomePage({
  workspaceName = "Workspace",
  agents = [],
  traces = [],
  actions,
  theme,
  onThemeChange,
  dataLabel,
  initialQuery = "",
  initialAgentId = "",
  allowAllAgents = true,
  ...explorerProps
}) {
  const agentsLabel = useId();
  const [workspace, dispatch] = useReducer(workspaceReducer, null, () =>
    createWorkspace(
      initialAgentId || (allowAllAgents ? "" : (agents[0]?.id ?? "")),
      initialQuery,
    ),
  );
  const { agentId, spaces } = workspace;
  const space = spaces.find((item) => item.agentId === agentId);
  const tabRefs = useRef(new Map());
  const nextId = useRef(0);
  const focusRequested = useRef(false);
  const refKey = (source, tab) => JSON.stringify([source, tab]);
  const registerTab = useCallback(
    (key, node) => {
      if (!node) {
        tabRefs.current.delete(key);
        return;
      }
      tabRefs.current.set(key, node);
      const currentSpace = workspace.spaces.find(
        (item) => item.agentId === workspace.agentId,
      );
      const activeKey = JSON.stringify([
        workspace.agentId,
        currentSpace.activeTabId,
      ]);
      if (key === activeKey && focusRequested.current) {
        node.focus({ preventScroll: true });
        focusRequested.current = false;
      }
    },
    [workspace],
  );
  function openTab(kind) {
    focusRequested.current = true;
    dispatch({ type: "open", kind, id: `tab-${++nextId.current}` });
  }
  function closeTab(id) {
    focusRequested.current = true;
    dispatch({ type: "close", id });
  }
  return (
    <WorkbenchLayout
      className="even-home"
      navigation={
        <Sidebar className="even-home-sidebar" label="Workspace navigation">
          <div className="even-home-brand">
            <span className="even-home-mark" aria-hidden="true">
              e
            </span>
            <span>even</span>
          </div>
          <div className="even-home-workspace">
            <span>Workspace</span>
            <strong>{workspaceName}</strong>
          </div>
          <div className="even-home-agent-heading">
            <h2 id={agentsLabel}>Agents</h2>
            <span>{agents.length}</span>
          </div>
          <ul className="even-home-agents" aria-labelledby={agentsLabel}>
            {allowAllAgents && (
              <li>
                <Button
                  variant="ghost"
                  aria-pressed={!agentId}
                  onClick={() => dispatch({ type: "visit", agentId: "" })}
                >
                  <span>All agents</span>
                  <span className="even-home-count" aria-hidden="true">
                    {traces.length}
                  </span>
                </Button>
              </li>
            )}
            {agents.map((agent) => (
              <li key={agent.id}>
                <Button
                  variant="ghost"
                  aria-pressed={agentId === agent.id}
                  onClick={() => dispatch({ type: "visit", agentId: agent.id })}
                >
                  <span>{agent.name ?? agent.id}</span>
                  {!explorerProps.dataSource && (
                    <span className="even-home-count" aria-hidden="true">
                      {
                        traces.filter((trace) => trace.agentId === agent.id)
                          .length
                      }
                    </span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
          <div className="even-home-sidebar-footer">
            <p className="even-home-sidebar-note">
              Inspect the execution behind every response.
            </p>
            {onThemeChange && (
              <ThemeToggle value={theme} onValueChange={onThemeChange} />
            )}
          </div>
        </Sidebar>
      }
    >
      <div className="even-home-context">
        <p className="even-home-breadcrumb">
          {workspaceName}
          <span aria-hidden="true"> / </span>
          {agents.find((agent) => agent.id === agentId)?.name ??
            (agentId || "Observability")}
        </p>
        <div className="even-home-actions">{actions}</div>
      </div>
      {spaces.map((item) => (
        <WorkbenchTabs
          key={item.agentId}
          value={item.activeTabId}
          hidden={item.agentId !== agentId}
          onValueChange={(id) =>
            dispatch({ type: "activate", agentId: item.agentId, id })
          }
        >
          <WorkbenchTabs.Bar>
            <WorkbenchTabs.List
              label={`${agents.find((agent) => agent.id === item.agentId)?.name ?? (item.agentId || "All agents")} workbench tabs`}
            >
              {item.tabs.map((tab) => (
                <RegisteredTab
                  key={tab.id}
                  kind={tab.kind}
                  value={tab.id}
                  nodeKey={refKey(item.agentId, tab.id)}
                  register={registerTab}
                  onClose={tab.pinned ? undefined : () => closeTab(tab.id)}
                >
                  {tab.label}
                </RegisteredTab>
              ))}
            </WorkbenchTabs.List>
            <WorkbenchTabs.New
              onCreate={openTab}
              finalFocus={() =>
                tabRefs.current.get(refKey(agentId, space.activeTabId))
              }
            />
          </WorkbenchTabs.Bar>
          {item.tabs.map((tab) =>
            tab.kind === "traces" ? (
              <TraceExplorer
                key={tab.id}
                {...explorerProps}
                agents={agents}
                traces={traces}
                agentId={item.agentId}
                tabId={tab.id}
                initialQuery={tab.initialQuery}
                header={<ViewHeader title={tab.label} dataLabel={dataLabel} />}
                active={item.agentId === agentId && item.activeTabId === tab.id}
              />
            ) : (
              <WorkbenchTabs.Panel
                key={tab.id}
                value={tab.id}
                keepMounted={false}
              >
                {item.agentId === agentId && item.activeTabId === tab.id && (
                  <>
                    <ViewHeader title={tab.label} dataLabel={dataLabel} />
                    <section
                      className="even-home-playground"
                      aria-label="Playground preview"
                    >
                      <h2>Chat playground</h2>
                      <Notice>
                        Layout preview · Live conversations are not connected
                        yet. Opening this tab does not start an agent.
                      </Notice>
                      <MessageComposer disabled />
                    </section>
                  </>
                )}
              </WorkbenchTabs.Panel>
            ),
          )}
        </WorkbenchTabs>
      ))}
    </WorkbenchLayout>
  );
}

function ViewHeader({ title, dataLabel }) {
  return (
    <header className="even-home-header even-home-control-area">
      <div className="even-home-title">
        <h1>{title}</h1>
        {dataLabel && <span className="even-home-data-label">{dataLabel}</span>}
      </div>
    </header>
  );
}
