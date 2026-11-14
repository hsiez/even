import React, { useState } from "react";
import { ResultsState } from "./ResultsState";
import { trace, spans, agents, sessions } from "../../test/fixtures";

export default { title: "Workbench/ResultsState", component: ResultsState };

export const Loading = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <ResultsState state="loading" />;
  },
};

export const Empty = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <ResultsState state="empty" />;
  },
};

export const NoMatches = {
  render: function Example() {
    const [value, setValue] = useState("");
    return <ResultsState state="no-matches" />;
  },
};

export const Error = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <ResultsState state="error" onRetry={() => setValue("Retry requested")} />
    );
  },
};

export const StaleWhileLoading = {
  render: function Example() {
    const [value, setValue] = useState("");
    return (
      <ResultsState state="loading">
        <p>Previously loaded results remain visible.</p>
      </ResultsState>
    );
  },
};
