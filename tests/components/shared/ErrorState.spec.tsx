// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/shared/ErrorState";

describe("ErrorState", () => {
  it("names what failed rather than apologising", () => {
    render(<ErrorState />);

    expect(screen.getByText("We couldn't load this")).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/oops/i)).not.toBeInTheDocument();
  });

  it("renders a custom message", () => {
    render(<ErrorState message="We couldn't reach the approvals service" />);

    expect(
      screen.getByText("We couldn't reach the approvals service")
    ).toBeInTheDocument();
  });

  it("offers a retry control when a retry is possible", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("does not offer retry when there is nothing to retry", () => {
    render(<ErrorState message="Error" />);

    expect(
      screen.queryByRole("button", { name: /try again/i })
    ).not.toBeInTheDocument();
  });

  it("announces itself to assistive technology", () => {
    render(<ErrorState message="Error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
