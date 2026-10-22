import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicBaseUrl } from "@/lib/base-url";

const PRODUCTION_BASE_URL = "https://leave.sst-dashboard.com";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPublicBaseUrl", () => {
  it("uses a public configured base URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://sst.example.com");

    expect(getPublicBaseUrl()).toBe("https://sst.example.com");
  });

  it("strips trailing slashes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://sst.example.com///");

    expect(getPublicBaseUrl()).toBe("https://sst.example.com");
  });

  it("never emits a localhost URL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");

    expect(getPublicBaseUrl()).toBe(PRODUCTION_BASE_URL);
  });

  it("falls back to the production domain when nothing is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");

    expect(getPublicBaseUrl()).toBe(PRODUCTION_BASE_URL);
  });

  it("ignores localhost in development unless localhost links are allowed", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");
    vi.stubEnv("ALLOW_LOCALHOST_LINKS", "false");

    expect(getPublicBaseUrl()).toBe(PRODUCTION_BASE_URL);
  });

  it("uses the configured localhost URL when localhost links are allowed", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");
    vi.stubEnv("ALLOW_LOCALHOST_LINKS", "true");

    expect(getPublicBaseUrl()).toBe("http://localhost:3000");
  });

  it("defaults to localhost in development when localhost links are allowed", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    vi.stubEnv("ALLOW_LOCALHOST_LINKS", "true");

    expect(getPublicBaseUrl()).toBe("http://localhost:3000");
  });

  it("does not default to localhost without the opt-in flag", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    vi.stubEnv("ALLOW_LOCALHOST_LINKS", "");

    expect(getPublicBaseUrl()).toBe(PRODUCTION_BASE_URL);
  });

  it("prefers a public URL over the localhost opt-in", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://sst.example.com/");
    vi.stubEnv("ALLOW_LOCALHOST_LINKS", "true");

    expect(getPublicBaseUrl()).toBe("https://sst.example.com");
  });

  it("treats 127.0.0.1 as localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://127.0.0.1:3000");

    expect(getPublicBaseUrl()).toBe(PRODUCTION_BASE_URL);
  });

  it("falls back to NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_BASE_URL is not set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.sst.scaler.com");

    expect(getPublicBaseUrl()).toBe("https://app.sst.scaler.com");
  });

  it("prefers canonical domain over unbranded vercel.app URLs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://sst-hostel-leave.vercel.app");

    expect(getPublicBaseUrl()).toBe(PRODUCTION_BASE_URL);
  });

  it("uses the preview URL when in VERCEL_ENV preview environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "sst-hostel-leave-git-feature.vercel.app");

    expect(getPublicBaseUrl()).toBe("https://sst-hostel-leave-git-feature.vercel.app");
  });
});
