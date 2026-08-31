// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";

/**
 * A destructive action states its consequence and names itself. The props are
 * required with no defaults precisely so a caller cannot fall back to
 * "Are you sure? / OK / Cancel".
 */
describe("ConfirmationDialog", () => {
  it("does not render when closed", () => {
    render(
      <ConfirmationDialog
        open={false}
        onOpenChange={() => {}}
        title="Delete this document?"
        consequence="The file is removed permanently."
        confirmLabel="Delete document"
        onConfirm={() => {}}
      />
    );

    expect(
      screen.queryByText("Delete this document?")
    ).not.toBeInTheDocument();
  });

  it("states the consequence when open", () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Delete this document?"
        consequence="The file is removed permanently and cannot be recovered."
        confirmLabel="Delete document"
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText("Delete this document?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The file is removed permanently and cannot be recovered."
      )
    ).toBeInTheDocument();
  });

  it("names the action on the confirm button", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Cancel this leave request?"
        consequence="Your approval is withdrawn."
        confirmLabel="Cancel request"
        onConfirm={onConfirm}
      />
    );

    expect(
      screen.getByRole("button", { name: "Cancel request" })
    ).toBeInTheDocument();
    // Never "OK" or a bare "Yes".
    expect(screen.queryByRole("button", { name: "OK" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
  });

  it("says what dismissing preserves rather than 'Cancel'", () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Cancel this leave request?"
        consequence="Your approval is withdrawn."
        confirmLabel="Cancel request"
        onConfirm={() => {}}
      />
    );

    // "Cancel" is ambiguous when the action itself is called cancel.
    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
  });

  it("states the count for a bulk operation", () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Deactivate these accounts?"
        consequence="They lose access immediately."
        confirmLabel="Deactivate accounts"
        count={12}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText(/12 records/)).toBeInTheDocument();
  });
});
