import React from "react";
import { createRoot } from "react-dom/client";
import { ConnectedApp } from "./pages";
import { takeLaunchToken, createApiClient } from "./api/client";
import "./app.css";

let token = takeLaunchToken();
async function initialize() {
  if (token) {
    await createApiClient().connect(token);
    token = undefined;
  }
}
createRoot(document.getElementById("root")).render(
  <ConnectedApp initialize={initialize} />,
);
