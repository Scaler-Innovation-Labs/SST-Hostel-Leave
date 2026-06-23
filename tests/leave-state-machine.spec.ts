import { describe, it, expect } from "vitest";
import { getNextState, canTransition, LEAVE_ACTION } from "../src/lib/workflows/leave-state-machine";
import { ConflictError } from "../src/lib/errors";

describe("leave-state-machine", () => {
  it("PENDING -> APPROVE -> APPROVED", () => {
    expect(getNextState("PENDING", LEAVE_ACTION.APPROVE)).toBe("APPROVED");
  });

  it("PENDING -> REJECT -> REJECTED", () => {
    expect(getNextState("PENDING", LEAVE_ACTION.REJECT)).toBe("REJECTED");
  });

  it("PENDING -> CANCEL -> CANCELLED", () => {
    expect(getNextState("PENDING", LEAVE_ACTION.CANCEL)).toBe("CANCELLED");
  });

  it("PENDING -> COMPLETE should throw", () => {
    expect(() => getNextState("PENDING", LEAVE_ACTION.COMPLETE)).toThrow(ConflictError);
  });

  it("APPROVED -> COMPLETE -> COMPLETED", () => {
    expect(getNextState("APPROVED", LEAVE_ACTION.COMPLETE)).toBe("COMPLETED");
  });

  it("APPROVED -> EXPIRE -> EXPIRED", () => {
    expect(getNextState("APPROVED", LEAVE_ACTION.EXPIRE)).toBe("EXPIRED");
  });

  it("APPROVED -> CANCEL -> CANCELLED", () => {
    expect(getNextState("APPROVED", LEAVE_ACTION.CANCEL)).toBe("CANCELLED");
  });

  it("APPROVED -> EXTEND -> APPROVED", () => {
    expect(getNextState("APPROVED", LEAVE_ACTION.EXTEND)).toBe("APPROVED");
  });

  it("APPROVED -> APPROVE should throw", () => {
    expect(() => getNextState("APPROVED", LEAVE_ACTION.APPROVE)).toThrow(ConflictError);
  });

  it("REJECTED -> APPROVE should throw", () => {
    expect(() => getNextState("REJECTED", LEAVE_ACTION.APPROVE)).toThrow(ConflictError);
  });

  it("CANCELLED -> APPROVE should throw", () => {
    expect(() => getNextState("CANCELLED", LEAVE_ACTION.APPROVE)).toThrow(ConflictError);
  });

  it("COMPLETED -> any action should throw", () => {
    expect(() => getNextState("COMPLETED", LEAVE_ACTION.APPROVE)).toThrow(ConflictError);
    expect(() => getNextState("COMPLETED", LEAVE_ACTION.CANCEL)).toThrow(ConflictError);
  });

  it("EXPIRED -> any action should throw", () => {
    expect(() => getNextState("EXPIRED", LEAVE_ACTION.APPROVE)).toThrow(ConflictError);
    expect(() => getNextState("EXPIRED", LEAVE_ACTION.CANCEL)).toThrow(ConflictError);
  });

  it("canTransition returns correct booleans", () => {
    expect(canTransition("PENDING", LEAVE_ACTION.APPROVE)).toBe(true);
    expect(canTransition("PENDING", LEAVE_ACTION.CANCEL)).toBe(true);
    expect(canTransition("PENDING", LEAVE_ACTION.COMPLETE)).toBe(false);
    expect(canTransition("APPROVED", LEAVE_ACTION.COMPLETE)).toBe(true);
    expect(canTransition("APPROVED", LEAVE_ACTION.EXPIRE)).toBe(true);
    expect(canTransition("APPROVED", LEAVE_ACTION.EXTEND)).toBe(true);
    expect(canTransition("REJECTED", LEAVE_ACTION.APPROVE)).toBe(false);
    expect(canTransition("CANCELLED", LEAVE_ACTION.APPROVE)).toBe(false);
    expect(canTransition("UNKNOWN_STATUS", LEAVE_ACTION.APPROVE)).toBe(false);
  });
});
