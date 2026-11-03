import { describe, expect, it } from "vitest";

import { NAVIGATION, STUDENT_BOTTOM_NAV } from "@/constants/navigation";
import { resolveActiveHref } from "@/utils/navigation";

const STUDENT_HREFS = STUDENT_BOTTOM_NAV.map((item) => item.href);

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

  it("surfaces How to use guide in student navigation and bottom nav", () => {
    const studentGroups = NAVIGATION.student;
    const supportGroup = studentGroups.find((g) => g.heading === "Support");
    const guideItem = supportGroup?.items.find((i) => i.label === "How to use");
    expect(guideItem).toBeDefined();
    expect(guideItem?.href).toBe("/student/guide");
    expect(STUDENT_BOTTOM_NAV.some((item) => item.label === "How to use")).toBe(true);
  });

  it("highlights only Request leave on its own page", () => {
    expect(resolveActiveHref("/student/leaves/new", STUDENT_HREFS)).toBe(
      "/student/leaves/new"
    );
  });

  it("highlights How to use on guide page", () => {
    expect(resolveActiveHref("/student/guide", STUDENT_HREFS)).toBe(
      "/student/guide"
    );
  });

  it("still highlights My leaves for a single leave detail page", () => {
    expect(resolveActiveHref("/student/leaves/123", STUDENT_HREFS)).toBe(
      "/student/leaves"
    );
  });
});
