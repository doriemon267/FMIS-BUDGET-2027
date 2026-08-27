jest.mock("../../models/Settings", () => ({
  findOne: jest.fn(),
}));

const Settings = require("../../models/Settings");
const {
  getTierRoleProfile,
  requireTierAccess,
} = require("../../middleware/tierAccessControl");

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const mockActiveBudgetType = (budgetType) => {
  const lean = jest.fn().mockResolvedValue({ budgetType, fiscalYear: "2027" });
  const select = jest.fn(() => ({ lean }));
  Settings.findOne.mockReturnValue({ select });
};

describe("Tier access control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    "BUDGET_PREPARER",
    "BUDGET_REVIEWER",
    "BUDGET_APPROVER",
  ])("allows %s when the active Budget Type is NEP", async (role) => {
    mockActiveBudgetType("NEP");
    const req = { user: { Roles: [role] } };
    const res = createResponse();
    const next = jest.fn();

    await requireTierAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(["Initial", "GAA", null])(
    "denies proposal workflow roles when the active Budget Type is %s",
    async (budgetType) => {
      mockActiveBudgetType(budgetType);
      const req = { user: { Roles: ["BUDGET_PREPARER"] } };
      const res = createResponse();
      const next = jest.fn();

      await requireTierAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "TIER_PHASE_ACCESS_DENIED" })
      );
    }
  );

  it.each([
    "SUPER_ADMIN",
    "BUDGET_PLANNING_ANALYST",
    "BUDGET_OFFICER",
    "BUDGET_MANAGER",
  ])("keeps %s available for Tier administration", async (role) => {
    const req = { user: { Roles: [role] } };
    const res = createResponse();
    const next = jest.fn();

    await requireTierAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(Settings.findOne).not.toHaveBeenCalled();
  });

  it("denies unrelated roles", async () => {
    const req = { user: { Roles: ["EMPLOYEE"] } };
    const res = createResponse();
    const next = jest.fn();

    await requireTierAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(Settings.findOne).not.toHaveBeenCalled();
  });

  it("marks Reviewers and Approvers as non-editor profiles", () => {
    expect(getTierRoleProfile({ Roles: ["BUDGET_REVIEWER"] })).toEqual(
      expect.objectContaining({ isReviewer: true, isPreparer: false })
    );
    expect(getTierRoleProfile({ Roles: ["BUDGET_APPROVER"] })).toEqual(
      expect.objectContaining({ isApprover: true, isPreparer: false })
    );
  });
});

