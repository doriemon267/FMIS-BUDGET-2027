const {
  normalizeUacsCode,
  normalizeCapitalOutlayCategoryName,
  findConfiguredCapitalOutlayCategory,
  isMooe502Account,
  selectCapitalOutlayMapping,
  validateCapitalOutlayAccount,
} = require("../utils/capitalOutlayAccountValidation");

describe("Capital Outlay account validation", () => {
  test.each([
    ["5-02-03-060", "50203060"],
    ["5020306000", "5020306000"],
    ["5 02 13 040", "50213040"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeUacsCode(input)).toBe(expected);
  });

  test.each(["5-02-03-060", "5020306000", "5 02 13 040"])(
    "blocks 502-series MOOE code %s",
    (uacsCode) => {
      expect(isMooe502Account(uacsCode)).toBe(true);
      expect(validateCapitalOutlayAccount({ uacsCode })).toMatchObject({
        valid: false,
        code: "MOOE_502_NOT_ALLOWED_IN_CAPITAL_OUTLAY",
      });
    }
  );

  test("blocks semi-expendable labels even when the code is missing", () => {
    expect(
      validateCapitalOutlayAccount({
        sublineItem: "Semi-Expendable Machinery and Equipment",
      })
    ).toMatchObject({
      valid: false,
      code: "SEMI_EXPENDABLE_NOT_ALLOWED_IN_CAPITAL_OUTLAY",
    });
  });

  test.each(["5-06-04-050", "5060405003", "1-06-05-030"])(
    "allows non-502 Capital Outlay code %s",
    (uacsCode) => {
      expect(
        validateCapitalOutlayAccount({
          uacsCode,
          sublineItem: "Machinery and Equipment",
        })
      ).toEqual({ valid: true });
    }
  );

  test("selects Machinery and Equipment instead of a 502 semi-expendable mapping", () => {
    const selected = selectCapitalOutlayMapping(
      [
        {
          sublineItem: "Semi-Expendable Machinery and Equipment",
          accountingTitle: "Semi-Expendable Machinery and Equipment Expenses",
          uacsCode: "5-02-03-060",
        },
        {
          sublineItem: "Machinery and Equipment",
          accountingTitle: "Information and Communication Technology Equipment",
          uacsCode: "5060405003",
        },
      ],
      {
        sublineItem: "Machinery and Equipment",
        allowedSublineItems: ["Machinery and Equipment"],
      }
    );

    expect(selected).toMatchObject({
      sublineItem: "Machinery and Equipment",
      uacsCode: "5060405003",
    });
  });

  test.each([
    [
      "ACQUISITION OF FURNITURE & FIXTURES AND BOOKS",
      "ACQUISITION OF FURNITURE AND FIXTURES AND BOOKS",
    ],
    [
      "  II.  ACQUISITION   OF MACHINERY AND EQUIPMENT  ",
      "ACQUISITION OF MACHINERY AND EQUIPMENT",
    ],
    [
      "IMPLEMENTATION / CONSTRUCTION / REHABILITATION OF GOVERNMENT FACILITIES / BUILDINGS & STRUCTURES (REGULAR)",
      "IMPLEMENTATION CONSTRUCTION REHABILITATION OF GOVERNMENT FACILITIES BUILDINGS AND STRUCTURES REGULAR",
    ],
  ])("normalizes category title %s", (input, expected) => {
    expect(normalizeCapitalOutlayCategoryName(input)).toBe(expected);
  });

  test("matches an uploaded title only to an existing configured category", () => {
    const configuredCategory = {
      _id: "configured",
      categoryName: "ACQUISITION OF FURNITURE & FIXTURES AND BOOKS",
      sublineItems: ["Furniture and Fixtures"],
    };

    expect(
      findConfiguredCapitalOutlayCategory(
        "I. Acquisition of Furniture and Fixtures and Books",
        [configuredCategory]
      )
    ).toBe(configuredCategory);

    expect(
      findConfiguredCapitalOutlayCategory("UNCONFIGURED NEW TITLE", [configuredCategory])
    ).toBeNull();
  });

  test("prefers the category configured with subline items over an old upload-created duplicate", () => {
    const oldDuplicate = {
      _id: "old-duplicate",
      categoryName: "ACQUISITION OF MACHINERY & EQUIPMENT",
      sublineItems: [],
    };
    const configuredCategory = {
      _id: "configured",
      categoryName: "ACQUISITION OF MACHINERY AND EQUIPMENT",
      sublineItems: ["Machinery and Equipment"],
    };

    expect(
      findConfiguredCapitalOutlayCategory(
        "ACQUISITION OF MACHINERY & EQUIPMENT",
        [oldDuplicate, configuredCategory]
      )
    ).toBe(configuredCategory);
  });
});
