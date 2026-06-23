// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingState } from "@/components/shared/LoadingState";

describe("LoadingState", () => {
  it("renders default count of 3 skeletons", () => {
    const { container } = render(<LoadingState />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(3);
  });

  it("renders custom count of skeletons", () => {
    const { container } = render(<LoadingState count={5} />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(5);
  });

  it("renders with custom className", () => {
    const { container } = render(<LoadingState className="custom-class" count={1} />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
