import api from "../config/api";

const SUBSIDY_ENDPOINT = "/personnelServices/subsidy/bulk";

export const updatePersonnelSubsidy = async ({
  items,
  defaultAmount = 0,
  subsidyEligible = true,
  notes,
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one personnel item is required");
  }

  const payload = {
    items,
    defaultAmount,
    subsidyEligible,
  };

  if (notes) {
    payload.notes = notes;
  }

  return api.put(SUBSIDY_ENDPOINT, payload);
};

export const tagPersonnelSubsidy = async ({ ids, amount, notes }) => {
  const numericAmount = Number(amount) || 0;
  return updatePersonnelSubsidy({
    items: ids.map((id) => ({ _id: id, subsidyAmount: numericAmount })),
    defaultAmount: numericAmount,
    subsidyEligible: true,
    notes,
  });
};

export const untagPersonnelSubsidy = async ({ ids }) => {
  return updatePersonnelSubsidy({
    items: ids.map((id) => ({ _id: id })),
    subsidyEligible: false,
    defaultAmount: 0,
  });
};

// Charged to Income functions
const CHARGED_TO_INCOME_ENDPOINT = "/personnelServices/charged-to-income/bulk";

export const updatePersonnelChargedToIncome = async ({
  items,
  defaultAmount = 0,
  chargedToIncomeEligible = true,
  notes,
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one personnel item is required");
  }

  const payload = {
    items,
    defaultAmount,
    chargedToIncomeEligible,
  };

  if (notes) {
    payload.notes = notes;
  }

  return api.put(CHARGED_TO_INCOME_ENDPOINT, payload);
};

export const chargePersonnelToIncome = async ({ ids, amount, notes }) => {
  const numericAmount = Number(amount) || 0;
  return updatePersonnelChargedToIncome({
    items: ids.map((id) => ({ _id: id, chargedToIncomeAmount: numericAmount })),
    defaultAmount: numericAmount,
    chargedToIncomeEligible: true,
    notes,
  });
};

export const unchargePersonnelFromIncome = async ({ ids }) => {
  return updatePersonnelChargedToIncome({
    items: ids.map((id) => ({ _id: id })),
    chargedToIncomeEligible: false,
    defaultAmount: 0,
  });
};
