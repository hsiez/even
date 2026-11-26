import React from "react";
import { TraceViewer } from "./TraceViewer";
import {
  viewerTrace,
  longViewerTrace,
  partialViewerTrace,
} from "../../test/traceViewerFixtures";
import "./TraceViewer.stories.css";
export default { title: "Trace viewer/TraceViewer", component: TraceViewer };
function Frame({ children }) {
  return (
    <>
      <p className="even-trace-viewer-story-note">
        Synthetic trace fixture · navigation and raw JSON only · no agent is
        executed.
      </p>
      <div className="even-trace-viewer-story">{children}</div>
    </>
  );
}
export const Composed = {
  render: () => (
    <Frame>
      <TraceViewer trace={viewerTrace} defaultSelectedSpanId="logs">
        <TraceViewer.Breadcrumbs />
        <TraceViewer.Path />
        <TraceViewer.Raw />
      </TraceViewer>
    </Frame>
  ),
};
export const CategoryPillMockup = {
  render: () => (
    <Frame>
      <TraceViewer trace={viewerTrace} defaultSelectedSpanId="logs">
        <TraceViewer.Breadcrumbs />
        <TraceViewer.Path categoryAppearance="label" />
        <TraceViewer.Raw />
      </TraceViewer>
    </Frame>
  ),
};
export const NestedAgent = {
  render: () => (
    <Frame>
      <TraceViewer trace={viewerTrace} initialActivationId="research" />
    </Frame>
  ),
};
export const LongExecution = {
  render: () => (
    <Frame>
      <TraceViewer trace={longViewerTrace} defaultSelectedSpanId="model-1" />
    </Frame>
  ),
};
export const PartialTrace = {
  render: () => (
    <Frame>
      <TraceViewer trace={partialViewerTrace} />
    </Frame>
  ),
};
export const Empty = {
  render: () => (
    <Frame>
      <TraceViewer trace={{ traceId: "empty", spans: [] }} />
    </Frame>
  ),
};
export const Loading = {
  render: () => (
    <Frame>
      <TraceViewer loading />
    </Frame>
  ),
};
export const Error = {
  render: () => (
    <Frame>
      <TraceViewer error="Could not read trace segments." />
    </Frame>
  ),
};
