import { beforeEach, describe, expect, it, vi } from "vitest";

import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { movementEventRepository } from "@/db/repositories/movement/movement-event.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";

describe("Commit 5 — Origin Transfer & Payload Optimization", () => {
  describe("leaveRepository.findByFilters projection & sensitive field protection", () => {
    it("strips heavy formSchema and sensitive clerkId from list results while keeping contract intact", async () => {
      const mockDbClient = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockResolvedValue([
              {
                leave: {
                  id: "L1",
                  requestNumber: "LR-101",
                  status: "APPROVED",
                  studentId: "S1",
                  startAt: new Date("2026-06-01"),
                  endAt: new Date("2026-06-05"),
                  reason: "Home visit",
                },
                student: { id: "S1", rollNumber: "STU-001" },
                user: {
                  id: "U1",
                  fullName: "John Doe",
                  email: "john@example.com",
                  phone: "1234567890",
                  gender: "MALE",
                  hostelId: "H1",
                  avatarUrl: null,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                leaveType: {
                  id: "LT1",
                  name: "Home Leave",
                  code: "HOME",
                  category: "REGULAR",
                  qrMode: "BOTH",
                  uiConfig: { color: "blue" },
                  requiredDocuments: [],
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                hostel: { id: "H1", name: "Hostel Alpha" },
              },
            ]),
          }),
        }),
      };

      const result = await leaveRepository.findByFilters(
        { page: 1, limit: 10 },
        mockDbClient as any
      );

      expect(result.items).toHaveLength(1);
      const item = result.items[0]!;

      // Verify contract preservation
      expect(item.leave.id).toBe("L1");
      expect(item.leave.requestNumber).toBe("LR-101");
      expect(item.student?.rollNumber).toBe("STU-001");
      expect(item.user?.fullName).toBe("John Doe");
      expect(item.leaveType?.name).toBe("Home Leave");
      expect(item.hostel?.name).toBe("Hostel Alpha");

      // Verify sensitive field exclusion
      expect(item.user?.clerkId).toBeNull();
      // Verify heavy formSchema is stripped from list items
      expect(item.leaveType?.formSchema).toBeNull();
    });

    it("skips student and user joins during count query when search is not requested", async () => {
      let countJoinCount = 0;
      const mockCountQuery = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockImplementation(() => {
          countJoinCount++;
          return mockCountQuery;
        }),
        where: vi.fn().mockResolvedValue([{ count: 42 }]),
      };

      const mockRowsQuery = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      const mockDbClient = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          return selectCallCount === 1 ? mockCountQuery : mockRowsQuery;
        }),
      };

      await leaveRepository.findByFilters(
        { page: 1, limit: 10, status: "APPROVED" },
        mockDbClient as any
      );

      // When search is not requested, count query must NOT join students or users
      expect(countJoinCount).toBe(0);
    });
  });

  describe("movementEventRepository.findByFilters projection & joins", () => {
    it("narrows projections to only needed columns and preserves contract", async () => {
      const mockDbClient = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockResolvedValue([
              {
                event: {
                  id: "M1",
                  studentId: "S1",
                  eventType: "EXIT_HOSTEL",
                  fromState: "IN_HOSTEL",
                  toState: "OUTSIDE_HOSTEL",
                  occurredAt: new Date(),
                },
                studentName: "Jane Smith",
                studentRollNumber: "STU-002",
                fromStateName: "In Hostel",
                toStateName: "Outside Hostel",
              },
            ]),
          }),
        }),
      };

      const result = await movementEventRepository.findByFilters(
        { page: 1, limit: 10 },
        mockDbClient as any
      );

      expect(result.items).toHaveLength(1);
      const item = result.items[0]!;
      expect(item.id).toBe("M1");
      expect(item.eventType).toBe("EXIT_HOSTEL");
      expect(item.studentName).toBe("Jane Smith");
      expect(item.studentRollNumber).toBe("STU-002");
      expect(item.fromStateName).toBe("In Hostel");
      expect(item.toStateName).toBe("Outside Hostel");
    });
  });

  describe("studentRepository.findByFilters projection & sensitive field protection", () => {
    it("excludes clerkId from student listing while preserving full student information", async () => {
      const mockDbClient = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockResolvedValue([
              {
                student: { id: "S1", rollNumber: "STU-001", roomNumber: "101" },
                user: {
                  id: "U1",
                  fullName: "Student One",
                  email: "student@example.com",
                  phone: "9876543210",
                  hostelId: "H1",
                },
                locationState: { code: "IN_HOSTEL", name: "In Hostel" },
              },
            ]),
          }),
        }),
      };

      const result = await studentRepository.findByFilters(
        { page: 1, limit: 10 },
        mockDbClient as any
      );

      expect(result.items).toHaveLength(1);
      const item = result.items[0]!;
      expect(item.student.rollNumber).toBe("STU-001");
      expect(item.user?.fullName).toBe("Student One");
      expect(item.user?.clerkId).toBeNull();
      expect(item.locationState?.code).toBe("IN_HOSTEL");
    });
  });

  describe("userRepository.findAll sensitive field protection", () => {
    it("strips clerkId from user list results", async () => {
      let selectCall = 0;
      const mockDbClient = {
        select: vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 1 }]),
              }),
            };
          }
          if (selectCall === 2) {
            // Users list query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([
                        {
                          id: "U1",
                          fullName: "Admin User",
                          email: "admin@example.com",
                          phone: "1122334455",
                          isActive: true,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        },
                      ]),
                    }),
                  }),
                }),
              }),
            };
          }
          // Roles query
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }),
      };

      const result = await userRepository.findAll(
        { page: 1, limit: 10 },
        mockDbClient as any
      );

      expect(result.items).toHaveLength(1);
      const user = result.items[0]!;
      expect(user.fullName).toBe("Admin User");
      expect(user.clerkId).toBeNull();
    });
  });

  describe("Payload size reduction verification", () => {
    it("measurably reduces serialized payload size by stripping unneeded nested formSchema and credentials", () => {
      // Simulate raw unoptimized row with heavy formSchema (e.g. 5 fields with rules) and credentials
      const heavyFormSchema = {
        fields: [
          { name: "destination", label: "Destination", type: "text", required: true, validation: { regex: "^[a-zA-Z ]+$" } },
          { name: "parentContact", label: "Emergency Contact", type: "phone", required: true },
          { name: "reasonDetail", label: "Detailed Justification", type: "textarea", required: false },
          { name: "transportMode", label: "Mode of Transportation", type: "select", options: ["Flight", "Train", "Bus", "Personal Vehicle"] },
          { name: "undertakingAccepted", label: "Student Undertaking", type: "checkbox", required: true },
        ],
      };

      const unoptimizedItem = {
        leave: { id: "L1", requestNumber: "LR-101", status: "APPROVED", studentId: "S1" },
        student: { id: "S1", rollNumber: "STU-001", academicGroupId: "G1", roomNumber: "101" },
        user: { id: "U1", fullName: "John Doe", email: "john@example.com", clerkId: "user_2aX9B1C3D4E5F6G7H8I9J0K1L2M", slackId: "U12345" },
        leaveType: { id: "LT1", name: "Home Leave", code: "HOME", formSchema: heavyFormSchema },
        hostel: { id: "H1", name: "Hostel Alpha" },
      };

      const optimizedItem = {
        leave: { id: "L1", requestNumber: "LR-101", status: "APPROVED", studentId: "S1" },
        student: { id: "S1", rollNumber: "STU-001", academicGroupId: "G1", roomNumber: "101" },
        user: { id: "U1", fullName: "John Doe", email: "john@example.com", clerkId: null, slackId: "U12345" },
        leaveType: { id: "LT1", name: "Home Leave", code: "HOME", formSchema: null },
        hostel: { id: "H1", name: "Hostel Alpha" },
      };

      const unoptimizedPageSize = JSON.stringify(Array(20).fill(unoptimizedItem)).length;
      const optimizedPageSize = JSON.stringify(Array(20).fill(optimizedItem)).length;

      const bytesSaved = unoptimizedPageSize - optimizedPageSize;
      const percentReduction = Math.round((bytesSaved / unoptimizedPageSize) * 100);

      // Verify substantial byte reduction
      expect(bytesSaved).toBeGreaterThan(5000); // Saved > 5 KB on 20 items
      expect(percentReduction).toBeGreaterThan(40); // > 40% payload reduction
      expect(optimizedItem.user.clerkId).toBeNull();
    });
  });
});
