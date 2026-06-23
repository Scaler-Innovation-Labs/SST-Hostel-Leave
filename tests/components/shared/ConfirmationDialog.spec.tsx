// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("does not render when closed", () => {
    render(
      <ConfirmationDialog
        open={false}
        onOpenChange={() => {}}
        title="Confirm"
        description="Are you sure?"
        confirmLabel="Yes"
        onConfirm={() => {}}
      />
    );

    expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
  });

  it("renders title and description when open", () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete Item"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("renders confirm button when open", () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Are you sure?"
        confirmLabel="Yes"
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  });
});
