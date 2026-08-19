// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindDefinitionByCode = vi.fn();
const mockFindDefinitionById = vi.fn();
const mockCreateDefinition = vi.fn();
const mockUpdateDefinition = vi.fn();
const mockReplaceSteps = vi.fn();
const mockFindRolesByCodes = vi.fn();
const mockFindDefinitionWithStepsById = vi.fn();
const mockCreateVersion = vi.fn();

vi.mock("@/db/repositories/workflow/workflow.repository", () => ({
  workflowRepository: {
    findDefinitionByCode: (...args: any[]) => mockFindDefinitionByCode(...args),
    findDefinitionById: (...args: any[]) => mockFindDefinitionById(...args),
    createDefinition: (...args: any[]) => mockCreateDefinition(...args),
    updateDefinition: (...args: any[]) => mockUpdateDefinition(...args),
    replaceSteps: (...args: any[]) => mockReplaceSteps(...args),
    findDefinitionWithStepsById: (...args: any[]) => mockFindDefinitionWithStepsById(...args),
  },
}));

vi.mock("@/services/workflow/workflow-version.service", () => ({
  workflowVersionService: {
    createVersion: (...args: any[]) => mockCreateVersion(...args),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRolesByCodes: (...args: any[]) => mockFindRolesByCodes(...args),
  },
}));

vi.mock("@/lib/db", () => {
  const tx = {};
  return {
    db: {
      transaction: (cb: any) => cb(tx),
    },
  };
});

import { createWorkflow, updateWorkflow } from "@/services/workflow/save-workflow.service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const VALID_DTO = {
  code: "LEAVE_APPROVAL",
  name: "Leave Approval Workflow",
  isActive: true,
  steps: [
    { stepKey: "WARDEN", approverRoleCode: "WARDEN", isRequired: true },
    { stepKey: "ADMIN", approverRoleCode: "ADMIN", isRequired: true },
  ],
};

const MOCK_DEFINITION = { id: "WF1", code: "LEAVE_APPROVAL", name: "Leave Approval Workflow", isActive: true, version: 1, steps: [] };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindDefinitionByCode.mockResolvedValue(null);
  mockFindDefinitionById.mockResolvedValue(null);
  mockCreateDefinition.mockResolvedValue({ id: "WF1" });
  mockUpdateDefinition.mockResolvedValue({ id: "WF1" });
  mockReplaceSteps.mockResolvedValue(undefined);
  mockFindRolesByCodes.mockResolvedValue([{ id: "R1", code: "WARDEN" }, { id: "R2", code: "ADMIN" }]);
  mockFindDefinitionWithStepsById.mockResolvedValue(MOCK_DEFINITION);
  mockCreateVersion.mockResolvedValue({ id: "WV1", version: 1 });
});

describe("createWorkflow service", () => {
  it("creates a workflow with steps", async () => {
    const result = await createWorkflow(VALID_DTO);

    expect(result).toEqual(MOCK_DEFINITION);
    expect(mockCreateDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LEAVE_APPROVAL", name: "Leave Approval Workflow", isActive: true }),
      expect.any(Object)
    );
    expect(mockReplaceSteps).toHaveBeenCalledWith("WF1",
      expect.arrayContaining([
        expect.objectContaining({ stepKey: "WARDEN", stepOrder: 1 }),
        expect.objectContaining({ stepKey: "ADMIN", stepOrder: 2 }),
      ]),
      expect.any(Object)
    );
  });

  it("throws ConflictError when code already exists", async () => {
    mockFindDefinitionByCode.mockResolvedValue({ id: "EXISTING", code: "LEAVE_APPROVAL" });

    await expect(createWorkflow(VALID_DTO)).rejects.toBeInstanceOf(ConflictError);
    expect(mockCreateDefinition).not.toHaveBeenCalled();
  });

  it("throws ValidationError for duplicate step keys", async () => {
    const dto = {
      ...VALID_DTO,
      steps: [
        { stepKey: "WARDEN", approverRoleCode: "WARDEN", isRequired: true },
        { stepKey: "WARDEN", approverRoleCode: "ADMIN", isRequired: true },
      ],
    };

    await expect(createWorkflow(dto)).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError for unknown approver role", async () => {
    mockFindRolesByCodes.mockResolvedValue([]);

    const dto = {
      ...VALID_DTO,
      steps: [{ stepKey: "UNKNOWN", approverRoleCode: "UNKNOWN_ROLE", isRequired: true }],
    };

    await expect(createWorkflow(dto)).rejects.toBeInstanceOf(ValidationError);
  });

  it("handles optional step fields", async () => {
    const dto = {
      ...VALID_DTO,
      steps: [{
        stepKey: "WARDEN",
        approverRoleCode: "WARDEN",
        isRequired: true,
        isParentApproval: false,
        approvalMethod: "SEQUENTIAL",
        condition: "duration > 3",
        timeoutHours: 48,
        escalateToStepKey: "ADMIN",
        notes: "Escalate if pending",
      }],
    };

    await createWorkflow(dto);

    expect(mockReplaceSteps).toHaveBeenCalledWith("WF1",
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            condition: "duration > 3",
            timeoutHours: 48,
            escalateToStepKey: "ADMIN",
            notes: "Escalate if pending",
          }),
        }),
      ]),
      expect.any(Object)
    );
  });
});

describe("updateWorkflow service", () => {
  beforeEach(() => {
    mockFindDefinitionById.mockResolvedValue({ id: "WF1", code: "LEAVE_APPROVAL", name: "Old Name", isActive: true, version: 1 });
    mockFindDefinitionByCode.mockResolvedValue(null);
  });

  it("updates a workflow with steps and increments version", async () => {
    const dto = { ...VALID_DTO, name: "Updated Workflow" };

    await updateWorkflow("WF1", dto);

    expect(mockFindDefinitionById).toHaveBeenCalledWith("WF1", expect.any(Object));
    expect(mockUpdateDefinition).toHaveBeenCalledWith("WF1",
      expect.objectContaining({ name: "Updated Workflow", version: 2 }),
      expect.any(Object)
    );
    expect(mockReplaceSteps).toHaveBeenCalled();
  });

  it("throws NotFoundError when workflow does not exist", async () => {
    mockFindDefinitionById.mockResolvedValue(null);

    await expect(updateWorkflow("NONEXISTENT", VALID_DTO)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdateDefinition).not.toHaveBeenCalled();
  });

  it("throws ConflictError when new code conflicts", async () => {
    mockFindDefinitionByCode.mockResolvedValue({ id: "WF2", code: "LEAVE_APPROVAL" });

    const dto = { ...VALID_DTO, code: "LEAVE_APPROVAL" };

    await expect(updateWorkflow("WF1", dto)).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows update when code belongs to same workflow", async () => {
    mockFindDefinitionByCode.mockResolvedValue({ id: "WF1", code: "LEAVE_APPROVAL" });

    await updateWorkflow("WF1", VALID_DTO);

    expect(mockUpdateDefinition).toHaveBeenCalled();
  });
});
