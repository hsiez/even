import React from "react";
import { ConnectedApp } from "./ConnectedApp";
export default { title: "Pages/ConnectedApp", component: ConnectedApp };
const loading = () => ({ inventory: () => new Promise(() => {}) });
export const Loading = {
  render: () => <ConnectedApp clientFactory={loading} />,
};
const clientFactory = () => ({ inventory: async () => ({ agents: [] }) });
export const EmptyWorkspace = {
  render: () => (
    <ConnectedApp
      clientFactory={clientFactory}
      dataLabel="Storybook · fixture API"
    />
  ),
};
