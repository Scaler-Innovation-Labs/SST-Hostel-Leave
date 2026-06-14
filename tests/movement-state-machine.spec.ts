import { describe, it, expect } from "vitest";

import {
	MOVEMENT_ACTION,
	canTransition,
	getNextState,
	MOVEMENT_TRANSITIONS,
	MOVEMENT_TRANSITION_MAP,
} from "@/lib/workflows/movement-state-machine";
import type { MovementState } from "@/constants/movement";

describe("movement-state-machine", () => {
	describe("canTransition", () => {
		it("allows APPROVE_LEAVE from IN_HOSTEL", () => {
			expect(
				canTransition("IN_HOSTEL", MOVEMENT_ACTION.APPROVE_LEAVE)
			).toBe(true);
		});

		it("allows EXIT_HOSTEL from APPROVED_LEAVE", () => {
			expect(
				canTransition(
					"APPROVED_LEAVE",
					MOVEMENT_ACTION.EXIT_HOSTEL
				)
			).toBe(true);
		});

		it("allows ENTER_HOSTEL from CHECKED_OUT", () => {
			expect(
				canTransition(
					"CHECKED_OUT",
					MOVEMENT_ACTION.ENTER_HOSTEL
				)
			).toBe(true);
		});

		it("allows MARK_OVERDUE from CHECKED_OUT", () => {
			expect(
				canTransition(
					"CHECKED_OUT",
					MOVEMENT_ACTION.MARK_OVERDUE
				)
			).toBe(true);
		});

		it("allows MANUAL_RETURN from OUTSIDE_HOSTEL", () => {
			expect(
				canTransition(
					"OUTSIDE_HOSTEL",
					MOVEMENT_ACTION.MANUAL_RETURN
				)
			).toBe(true);
		});

		it("allows MANUAL_RETURN from OVERDUE", () => {
			expect(
				canTransition(
					"OVERDUE",
					MOVEMENT_ACTION.MANUAL_RETURN
				)
			).toBe(true);
		});

		it("rejects invalid transition (EXIT_HOSTEL from IN_HOSTEL)", () => {
			expect(
				canTransition("IN_HOSTEL", MOVEMENT_ACTION.EXIT_HOSTEL)
			).toBe(false);
		});

		it("rejects all invalid transitions from IN_HOSTEL", () => {
			expect(
				canTransition("IN_HOSTEL", MOVEMENT_ACTION.EXIT_HOSTEL)
			).toBe(false);
			expect(
				canTransition("IN_HOSTEL", MOVEMENT_ACTION.ENTER_HOSTEL)
			).toBe(false);
			expect(
				canTransition("IN_HOSTEL", MOVEMENT_ACTION.MARK_OVERDUE)
			).toBe(false);
			expect(
				canTransition("IN_HOSTEL", MOVEMENT_ACTION.MANUAL_RETURN)
			).toBe(false);
			expect(
				canTransition(
					"IN_HOSTEL",
					MOVEMENT_ACTION.INVALIDATE_QR
				)
			).toBe(false);
		});
	});

	describe("getNextState", () => {
		it("transitions IN_HOSTEL -> APPROVED_LEAVE", () => {
			expect(
				getNextState("IN_HOSTEL", MOVEMENT_ACTION.APPROVE_LEAVE)
			).toBe("APPROVED_LEAVE");
		});

		it("transitions APPROVED_LEAVE -> CHECKED_OUT", () => {
			expect(
				getNextState(
					"APPROVED_LEAVE",
					MOVEMENT_ACTION.EXIT_HOSTEL
				)
			).toBe("CHECKED_OUT");
		});

		it("transitions APPROVED_LEAVE -> IN_HOSTEL (invalidate QR)", () => {
			expect(
				getNextState(
					"APPROVED_LEAVE",
					MOVEMENT_ACTION.INVALIDATE_QR
				)
			).toBe("IN_HOSTEL");
		});

		it("transitions CHECKED_OUT -> IN_HOSTEL", () => {
			expect(
				getNextState(
					"CHECKED_OUT",
					MOVEMENT_ACTION.ENTER_HOSTEL
				)
			).toBe("IN_HOSTEL");
		});

		it("transitions CHECKED_OUT -> OVERDUE", () => {
			expect(
				getNextState(
					"CHECKED_OUT",
					MOVEMENT_ACTION.MARK_OVERDUE
				)
			).toBe("OVERDUE");
		});

		it("transitions OUTSIDE_HOSTEL -> IN_HOSTEL (manual)", () => {
			expect(
				getNextState(
					"OUTSIDE_HOSTEL",
					MOVEMENT_ACTION.MANUAL_RETURN
				)
			).toBe("IN_HOSTEL");
		});

		it("transitions OVERDUE -> IN_HOSTEL (manual)", () => {
			expect(
				getNextState(
					"OVERDUE",
					MOVEMENT_ACTION.MANUAL_RETURN
				)
			).toBe("IN_HOSTEL");
		});

		it("throws on invalid transition", () => {
			expect(() =>
				getNextState("IN_HOSTEL", MOVEMENT_ACTION.EXIT_HOSTEL)
			).toThrow("Invalid movement transition");
		});
	});

	describe("transition map completeness", () => {
		it("has entries for all movement states", () => {
			const states: MovementState[] = [
				"IN_HOSTEL",
				"APPROVED_LEAVE",
				"CHECKED_OUT",
				"OUTSIDE_HOSTEL",
				"OVERDUE",
			];

			for (const state of states) {
				expect(MOVEMENT_TRANSITIONS[state]).toBeDefined();
				expect(MOVEMENT_TRANSITION_MAP[state]).toBeDefined();
			}
		});

	});
});
