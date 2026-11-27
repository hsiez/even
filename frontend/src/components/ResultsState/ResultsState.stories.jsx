import React, { useState } from "react";
import { ResultsState } from "./ResultsState";

export default { title: "Workbench/ResultsState", component: ResultsState };

export const Loading = {
  render: function Example() {
    return <ResultsState state="loading" />;
  },
};

export const Empty = {
  render: function Example() {
    return <ResultsState state="empty" />;
  },
};

export const NoMatches = {
  render: function Example() {
    return <ResultsState state="no-matches" />;
  },
};

export const Error = {
  render: function Example() {
    const [, setValue] = useState("");
    return (
      <ResultsState state="error" onRetry={() => setValue("Retry requested")} />
    );
  },
};

export const StaleWhileLoading = {
  render: function Example() {
    return (
      <ResultsState state="loading">
        <p>Previously loaded results remain visible.</p>
      </ResultsState>
    );
  },
};
