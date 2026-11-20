import React from "react";
import { expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedApp } from "./ConnectedApp";

test("sidebar theme selection replaces the header action and updates the document without resetting tabs", async () => {
  const user = userEvent.setup();
  const previous = document.documentElement.dataset.evenTheme;
  const client = {
    inventory: async () => ({ agents: [{ id: "support" }] }),
    search: async () => ({
      results: [],
      total: 0,
      nextCursor: null,
      coverage: { complete: true },
    }),
  };
  try {
    render(<ConnectedApp clientFactory={() => client} />);
    await screen.findByRole("button", { name: "support", exact: true });
    await user.click(
      screen.getByRole("button", { name: "New tab", exact: true }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "New chat playground" }),
    );
    await user.click(
      screen.getByRole("radio", { name: "Light theme", exact: true }),
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.evenTheme).toBe("light"),
    );
    expect(
      screen.getByRole("tab", { name: "Playground 1", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: /Use .* theme/ })).toBeNull();
    await user.click(
      screen.getByRole("radio", { name: "Dark theme", exact: true }),
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.evenTheme).toBe("dark"),
    );
  } finally {
    if (previous === undefined)
      delete document.documentElement.dataset.evenTheme;
    else document.documentElement.dataset.evenTheme = previous;
  }
});

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
