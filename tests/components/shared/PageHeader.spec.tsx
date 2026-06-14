// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/shared/PageHeader";

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(<PageHeader title="Dashboard" description="Overview of your activity." />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Overview of your activity.")).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<PageHeader title="Settings" />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders action element", () => {
    render(
      <PageHeader
        title="Users"
        action={<button>Add User</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });
});
