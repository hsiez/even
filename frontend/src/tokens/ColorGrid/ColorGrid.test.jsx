import React from "react";
import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ColorGrid } from "./ColorGrid";

test("shows both theme scopes, palette provenance, roles and validated pairings", () => {
  render(
    <>
      <ColorGrid theme="light" />
      <ColorGrid theme="dark" />
    </>,
  );
  for (const theme of ["light", "dark"]) {
    const region = screen.getByRole("region", {
      name: `${theme} color tokens`,
    });
    expect(region).toHaveAttribute("data-even-theme", theme);
    expect(
      within(region).getByRole("link", { name: "Source: Geist colors" }),
    ).toHaveAttribute("href", "https://vercel.com/geist/colors");
    expect(
      within(region).getByRole("table", {
        name: "Palette scales and intended step roles",
      }),
    ).toBeVisible();
    expect(within(region).getAllByText(/4.5:1 · Pass/).length).toBeGreaterThan(
      0,
    );
    expect(within(region).queryByText(/· Fail/)).toBeNull();
  }
});
