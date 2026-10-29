import { describe, expect, it } from "vitest";

import { NAVIGATION, STUDENT_BOTTOM_NAV } from "@/constants/navigation";

describe("Student Navigation", () => {
  it("includes Support group with Report bug mailto link", () => {
    const studentGroups = NAVIGATION.student;
    expect(studentGroups).toBeDefined();

    const supportGroup = studentGroups.find((g) => g.heading === "Support");
    expect(supportGroup).toBeDefined();

    const reportBugItem = supportGroup?.items.find((i) => i.label === "Report bug");
    expect(reportBugItem).toBeDefined();
    expect(reportBugItem?.href).toBe(
      "mailto:neerasa.24bcs10005@sst.scaler.com?subject=Bug%20Report%20-%20SST%20Hostel%20Leave"
    );
    expect(reportBugItem?.Icon).toBeDefined();
  });

  it("surfaces Report bug in STUDENT_BOTTOM_NAV", () => {
    const reportBug = STUDENT_BOTTOM_NAV.find((item) => item.label === "Report bug");
    expect(reportBug).toBeDefined();
    expect(reportBug?.href).toContain("neerasa.24bcs10005@sst.scaler.com");
  });
});
