const DEFAULT_DISCOUNT_SETTING = Object.freeze({
  applyDiscount: true,
  discountType: 'percentage',
  discountValue: 10,
});

const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const normalizeRegionName = (value) => String(value || '').trim();

const normalizeDiscountSetting = (setting) => {
  if (!setting) return { ...DEFAULT_DISCOUNT_SETTING };

  const rawValue = Number(setting.discountValue);
  return {
    applyDiscount: setting.applyDiscount !== false,
    discountType: setting.discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number.isFinite(rawValue)
      ? Math.max(0, rawValue)
      : DEFAULT_DISCOUNT_SETTING.discountValue,
  };
};

const buildDiscountSettingsByRegion = (regionNames = [], settings = []) => {
  const documentsByRegion = new Map();

  (settings || []).forEach((setting) => {
    const regionName = normalizeRegionName(setting?.region);
    const key = regionName.toLowerCase();
    if (key && !documentsByRegion.has(key)) {
      documentsByRegion.set(key, setting);
    }
  });

  return Object.fromEntries(
    (regionNames || []).map((regionName) => {
      const normalizedName = normalizeRegionName(regionName);
      return [
        normalizedName,
        normalizeDiscountSetting(documentsByRegion.get(normalizedName.toLowerCase())),
      ];
    })
  );
};

const getDiscountLabel = (settingsByRegion = {}) => {
  const appliedSettings = Object.values(settingsByRegion).filter(
    (setting) => setting.applyDiscount && setting.discountValue > 0
  );

  if (appliedSettings.length === 0) return 'Less: Discount on Current Account';

  const settingKeys = new Set(
    appliedSettings.map(
      (setting) => `${setting.discountType}:${setting.discountValue}`
    )
  );

  if (settingKeys.size !== 1) return 'Less: ISF Discount on Current Account';

  const [{ discountType, discountValue }] = appliedSettings;
  return discountType === 'percentage'
    ? `Less: ${discountValue}% Discount on Current Account`
    : 'Less: Discount on Current Account (Fixed)';
};

const calculateCorporateIncomeDiscounts = ({
  regionNames = [],
  currentAccountByRegion = {},
  isfByRegion = {},
  grossTotalByRegion = {},
  settings = [],
} = {}) => {
  const normalizedRegionNames = [...new Set(
    (regionNames || []).map(normalizeRegionName).filter(Boolean)
  )];
  const settingsByRegion = buildDiscountSettingsByRegion(
    normalizedRegionNames,
    settings
  );
  const discountRegionAmounts = {};
  const netIsfRegionAmounts = {};
  const netTotalByRegion = {};
  let currentAccountGrandTotal = 0;
  let discountGrandTotal = 0;
  let isfGrandTotal = 0;

  normalizedRegionNames.forEach((regionName) => {
    const currentAccount = toAmount(currentAccountByRegion[regionName]);
    const isfAmount = toAmount(isfByRegion[regionName]);
    const grossTotal = toAmount(grossTotalByRegion[regionName]);
    const setting = settingsByRegion[regionName];
    let discountAmount = 0;

    if (setting.applyDiscount && setting.discountValue > 0 && currentAccount > 0) {
      discountAmount = setting.discountType === 'percentage'
        ? currentAccount * (setting.discountValue / 100)
        : Math.min(setting.discountValue, currentAccount);
    }

    currentAccountGrandTotal += currentAccount;
    isfGrandTotal += isfAmount;
    discountGrandTotal += discountAmount;
    discountRegionAmounts[regionName] = discountAmount;
    netIsfRegionAmounts[regionName] = isfAmount - discountAmount;
    netTotalByRegion[regionName] = grossTotal - discountAmount;
  });

  return {
    applyDiscount: Object.values(settingsByRegion).some(
      (setting) => setting.applyDiscount && setting.discountValue > 0
    ),
    currentAccountGrandTotal,
    discountGrandTotal,
    discountLabel: getDiscountLabel(settingsByRegion),
    discountRegionAmounts,
    isfGrandTotal,
    netIsfGrandTotal: isfGrandTotal - discountGrandTotal,
    netIsfRegionAmounts,
    netTotalByRegion,
    settingsByRegion,
  };
};

module.exports = {
  DEFAULT_DISCOUNT_SETTING,
  buildDiscountSettingsByRegion,
  calculateCorporateIncomeDiscounts,
};
