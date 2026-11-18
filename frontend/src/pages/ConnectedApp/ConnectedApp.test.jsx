import React from "react";
import { expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedApp } from "./ConnectedApp";

test("loads inventory automatically without a token-entry screen", async () => {
  const client = {
    inventory: vi.fn(async () => ({ agents: [{ id: "real-agent" }] })),
    search: vi.fn(async () => ({
      results: [],
      total: 0,
      nextCursor: null,
      coverage: { complete: true },
    })),
  };
  const factory = vi.fn(() => client);
  render(<ConnectedApp clientFactory={factory} />);
  expect(
    await screen.findByRole("button", { name: "real-agent" }),
  ).toBeVisible();
  await waitFor(() => expect(client.search).toHaveBeenCalled());
  expect(factory).toHaveBeenCalledWith();
  expect(screen.queryByLabelText("Launch token")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Generate sample trace" }),
  ).toBeNull();
  expect(client.search.mock.calls[0][0].agentId).toBe("real-agent");
});

test("retains a connection error and lets the user retry inventory", async () => {
  const user = userEvent.setup();
  const client = {
    inventory: vi
      .fn()
      .mockRejectedValueOnce(new Error("Project temporarily unavailable"))
      .mockResolvedValueOnce({ agents: [] }),
  };
  const factory = () => client;
  render(<ConnectedApp clientFactory={factory} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Project temporarily unavailable",
  );
  await user.click(screen.getByRole("button", { name: "Retry connection" }));
  expect(
    await screen.findByText("No agents were found in this project."),
  ).toBeVisible();
});

test("finishes automatic bootstrap before loading inventory and can retry a failed bootstrap", async () => {
  const user = userEvent.setup();
  const initialize = vi
    .fn()
    .mockRejectedValueOnce(new Error("Temporarily unavailable"))
    .mockResolvedValueOnce(undefined);
  const inventory = vi.fn(async () => ({ agents: [] }));
  const factory = () => ({ inventory });
  render(<ConnectedApp initialize={initialize} clientFactory={factory} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Temporarily unavailable",
  );
  expect(inventory).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Retry connection" }));
  expect(
    await screen.findByText("No agents were found in this project."),
  ).toBeVisible();
  expect(initialize).toHaveBeenCalledTimes(2);
});
