jest.mock("../../utils/routePermissionCache", () => ({
  getPermission: jest.fn(),
}));

const routePermissionCache = require("../../utils/routePermissionCache");
const requireDynamicPermission = require("../../middleware/requireDynamicPermission");

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const budgetPreparer = {
  Roles: ["BUDGET_PREPARER"],
  workflowRoles: ["divisionCreator"],
};

describe("requireDynamicPermission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fails closed for an unassigned protected Settings route", async () => {
    routePermissionCache.getPermission.mockResolvedValue({
      path: "/position-titles",
      isActive: true,
      requiredWorkflowRoles: [],
      excludeRoles: [],
    });
    const res = createResponse();
    const next = jest.fn();

    await requireDynamicPermission("/position-titles")(
      { user: budgetPreparer },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("fails closed when a protected Settings configuration is missing", async () => {
    routePermissionCache.getPermission.mockResolvedValue(null);
    const res = createResponse();
    const next = jest.fn();

    await requireDynamicPermission("/position-titles")(
      { user: budgetPreparer },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("matches legacy preparer aliases", async () => {
    routePermissionCache.getPermission.mockResolvedValue({
      path: "/position-titles",
      isActive: true,
      requiredWorkflowRoles: ["preparer"],
      excludeRoles: [],
    });
    const res = createResponse();
    const next = jest.fn();

    await requireDynamicPermission("/position-titles")(
      { user: budgetPreparer },
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("honors explicit role exclusions", async () => {
    routePermissionCache.getPermission.mockResolvedValue({
      path: "/position-titles",
      isActive: true,
      requiredWorkflowRoles: ["preparer"],
      excludeRoles: ["BUDGET_PREPARER"],
    });
    const res = createResponse();
    const next = jest.fn();

    await requireDynamicPermission("/position-titles")(
      { user: budgetPreparer },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("keeps non-sensitive unassigned routes backward compatible", async () => {
    routePermissionCache.getPermission.mockResolvedValue({
      path: "/allproposal",
      isActive: true,
      requiredWorkflowRoles: [],
      excludeRoles: [],
    });
    const res = createResponse();
    const next = jest.fn();

    await requireDynamicPermission("/allproposal")(
      { user: budgetPreparer },
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("lets a Super Admin recover a protected route without configuration", async () => {
    routePermissionCache.getPermission.mockResolvedValue(null);
    const res = createResponse();
    const next = jest.fn();

    await requireDynamicPermission("/position-titles")(
      { user: { Roles: ["SUPER_ADMIN"] } },
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(routePermissionCache.getPermission).not.toHaveBeenCalled();
  });
});

