import "@testing-library/jest-dom/vitest";

import { afterAll, beforeAll, vi } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local" });

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});
