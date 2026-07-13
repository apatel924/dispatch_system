/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("portals menu content to document.body so it escapes overflow clipping", () => {
    render(
      <div data-testid="clipping-card" style={{ overflow: "hidden", height: 48 }}>
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Action item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    );

    const item = screen.getByRole("menuitem", { name: "Action item" });
    const card = screen.getByTestId("clipping-card");

    expect(card.contains(item)).toBe(false);
    expect(document.body.contains(item)).toBe(true);
  });
});
