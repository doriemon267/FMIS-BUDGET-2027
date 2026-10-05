const CompensationSettings = require("../models/CompensationSettings");
const { calculateEarnedLeaves } = require("../utils/earnedLeaveUtils");
const {
  createCompensationSettings,
  updateCompensationSettingsStandalone,
} = require("../controllers/settingsControllerEnhanced");

afterEach(() => jest.restoreAllMocks());

describe("earned leave budgeting", () => {
  test("defaults new and legacy compensation to 30 days", () => {
    const fresh = new CompensationSettings({ name: "Standard" });
    const legacy = CompensationSettings.hydrate({ name: "Legacy", earnedLeaves: 0.0481927 });
    expect(fresh.earnedLeaveDays).toBe(30);
    expect(fresh.earnedLeaves).toBe(0.0481927);
    expect(legacy.earnedLeaveDays).toBe(30);
    expect(calculateEarnedLeaves(20000, fresh)).toBeCloseTo(28915.62, 2);
    expect(calculateEarnedLeaves(20000, legacy)).toBeCloseTo(28915.62, 2);
    expect(calculateEarnedLeaves(20000, {})).toBeCloseTo(28915.62, 2);
  });

  test.each([[15, 14457.81], [12.5, 12048.175], [0, 0]])(
    "%s days produces the reduced allocation and survives reloading",
    (days, expected) => {
      const saved = new CompensationSettings({ name: "Budget", earnedLeaveDays: days });
      const reloaded = CompensationSettings.hydrate(saved.toObject());
      expect(reloaded.earnedLeaveDays).toBe(days);
      expect(calculateEarnedLeaves(20000, reloaded)).toBeCloseTo(expected, 3);
    }
  );

  test("preserves legacy conversion factors, including an explicit zero", () => {
    expect(calculateEarnedLeaves(20000, { earnedLeaves: 0 })).toBe(0);
    expect(calculateEarnedLeaves(20000, { earnedLeaves: 0.04 })).toBe(24000);
  });

  test.each([-1, Infinity, NaN, "invalid", null])("rejects invalid days %s", (days) => {
    const setting = new CompensationSettings({ name: "Budget", earnedLeaveDays: days });
    expect(setting.validateSync().errors.earnedLeaveDays).toBeDefined();
  });
});

describe("standalone compensation API", () => {
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

  test.each([undefined, 15, 0])("creates compensation with %s days", async (days) => {
    jest.spyOn(CompensationSettings.prototype, "save").mockImplementation(async function () {
      await this.validate();
      return this;
    });
    const res = response();
    await createCompensationSettings({ body: { name: "Budget", earnedLeaveDays: days } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const saved = res.json.mock.calls[0][0].compensationSettings;
    expect(saved.earnedLeaveDays).toBe(days ?? 30);
    expect(saved.earnedLeaves).toBe(0.0481927);
  });

  test("returns a validation error for negative days", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(CompensationSettings.prototype, "save").mockImplementation(async function () {
      await this.validate();
      return this;
    });
    const res = response();
    await createCompensationSettings({ body: { name: "Budget", earnedLeaveDays: -1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("updates the days with validation enabled, including zero", async () => {
    const update = jest.spyOn(CompensationSettings, "findByIdAndUpdate")
      .mockResolvedValue({ name: "Budget", earnedLeaveDays: 0, earnedLeaves: 0.0481927 });
    const res = response();
    await updateCompensationSettingsStandalone({ params: { id: "compensation-id" }, body: { earnedLeaveDays: 0 } }, res);
    expect(update).toHaveBeenCalledWith("compensation-id", { earnedLeaveDays: 0 }, { new: true, runValidators: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].compensationSettings.earnedLeaveDays).toBe(0);
  });
});
