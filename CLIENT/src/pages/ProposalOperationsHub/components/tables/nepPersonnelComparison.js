const amount = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const roundCurrency = value => Math.round((amount(value) + Number.EPSILON) * 100) / 100;

export const PERSONNEL_SECTIONS = [
  {
    code: '1',
    title: 'Salaries and Wages',
    rows: [
      {
        code: '1.a',
        label: 'Salaries - Regular (Authorized Positions)',
        fields: ['annualSalary'],
        appointment: 'permanent',
      },
      {
        code: '1.b',
        label: 'Casual Personnel',
        fields: ['annualSalary'],
        appointment: 'casual',
      },
    ],
  },
  {
    code: '2',
    title: 'Other Compensation',
    rows: [
      { code: '2.a', label: 'PERA', fields: ['PERA'] },
      { code: '2.b', label: 'Representation Allowance', fields: ['RATA'] },
      { code: '2.d', label: 'Honoraria', fields: ['honoraria'] },
      { code: '2.e', label: 'Uniform/Clothing Allowance', fields: ['uniformALLOWANCE'] },
      { code: '2.f', label: 'Children Allowances', fields: ['childrenAllowance'] },
      { code: '2.g', label: 'Medical Allowances', fields: ['medical'] },
      { code: '2.h', label: 'Additional Medical Allowance', fields: ['additionalMedical'] },
      { code: '2.i', label: 'Meal Allowances', fields: ['meal'] },
      {
        code: '2.k',
        label: 'Subsistence Allowance',
        fields: ['subsistenceAllowance', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST'],
      },
      { code: '2.l', label: 'Longevity Pay (Loyalty Award)', fields: ['loyaltyAward'] },
      { code: '2.m', label: 'Overtime Services', fields: ['overtimePay'] },
      {
        code: '2.o',
        label: 'Productivity Enhancement Incentive',
        fields: ['productivityIncentive'],
      },
      { code: '2.p', label: 'Cash Gift', fields: ['cashGift'] },
      {
        code: '2.q',
        label: 'Mid-Year and Year-End Bonus',
        fields: ['midyearBonus', 'yearEndBonus'],
      },
      { code: '2.s', label: 'Hazard Pay', fields: ['hazardPay'] },
    ],
  },
  {
    code: '3',
    title: 'Other Benefits',
    rows: [
      { code: '3.a', label: 'Retirement Benefits', fields: ['retirementBenefits'] },
      { code: '3.b', label: 'Terminal Leave Benefits', fields: ['terminalLeave'] },
    ],
  },
  {
    code: '4',
    title: 'Fixed Personnel Expenditures',
    rows: [
      { code: '4.a', label: 'GSIS Ret. & Life Insurance Premium', fields: ['gsisPremium'] },
      { code: '4.b', label: 'PAG-IBIG Contributions', fields: ['pagibigPremium'] },
      { code: '4.c', label: 'PHILHEALTH Contributions', fields: ['philhealthPremium'] },
      {
        code: '4.d',
        label: 'Employees Compensation Insurance Premium',
        fields: ['employeeCompensation'],
      },
      { code: '4.e', label: 'Provident Fund', fields: ['providentFund'] },
    ],
  },
  {
    code: '6',
    title: 'Leave Monetization/Earned Leaves',
    rows: [{ code: '6.a', label: 'Earned Leaves', fields: ['earnedLeaves'] }],
  },
];

export const PERSONNEL_AMOUNT_FIELDS = [
  ...new Set(PERSONNEL_SECTIONS.flatMap(section => section.rows.flatMap(row => row.fields))),
];

const isCasual = item =>
  String(item?.statusOfAppointment || item?.appointmentType || '')
    .trim()
    .toLowerCase()
    .includes('casual');

const matchesAppointment = (item, appointment) => {
  if (!appointment) return true;
  return appointment === 'casual' ? isCasual(item) : !isCasual(item);
};

const fallbackAllocation = (item, field, initial = false) => {
  const sourceAmount = amount(initial ? item?.nepInitialValues?.[field] ?? item?.[field] : item?.[field]);
  const allocationKey = initial ? 'nepInitialAllocations' : 'nepAllocations';
  const saved = item?.[allocationKey]?.[field];
  if (saved && (saved.income !== undefined || saved.subsidy !== undefined)) {
    return { income: amount(saved.income), subsidy: amount(saved.subsidy) };
  }

  // Legacy personnel rows only tracked the salary portion charged to income.
  // Other PS components remain subsidy-funded until an explicit NEP allocation is saved.
  const income =
    field === 'annualSalary' && item?.chargedToIncomeEligible !== false
      ? Math.min(sourceAmount, amount(item?.chargedToIncomeAmount))
      : 0;
  return { income, subsidy: Math.max(0, sourceAmount - income) };
};

export const buildPersonnelComparisonRows = personnel =>
  PERSONNEL_SECTIONS.map(section => {
    const rows = section.rows.map(definition => {
      const sourceSlots = [];
      const totals = {
        initialIncome: 0,
        initialSubsidy: 0,
        nepIncome: 0,
        nepSubsidy: 0,
      };

      personnel.forEach((item, index) => {
        if (!matchesAppointment(item, definition.appointment)) return;
        definition.fields.forEach(field => {
          const initial = fallbackAllocation(item, field, true);
          const current = fallbackAllocation(item, field, false);
          totals.initialIncome += initial.income;
          totals.initialSubsidy += initial.subsidy;
          totals.nepIncome += current.income;
          totals.nepSubsidy += current.subsidy;
          // Only existing budget-line values are eligible for aggregate edits.
          // This prevents a blank canonical row from silently creating and
          // spreading a new benefit across every personnel record.
          if (
            initial.income + initial.subsidy + current.income + current.subsidy > 0
          ) {
            sourceSlots.push({ index, field });
          }
        });
      });

      return {
        ...definition,
        sourceSlots,
        initialIncome: roundCurrency(totals.initialIncome),
        initialSubsidy: roundCurrency(totals.initialSubsidy),
        nepIncome: roundCurrency(totals.nepIncome),
        nepSubsidy: roundCurrency(totals.nepSubsidy),
      };
    });
    return { ...section, rows };
  });

const snapshotAllocation = (item, field) => {
  const value = amount(item[field]);
  const existing = fallbackAllocation(item, field, false);
  item.nepInitialValues = {
    ...(item.nepInitialValues || {}),
    ...(!Object.prototype.hasOwnProperty.call(item.nepInitialValues || {}, field)
      ? { [field]: value }
      : {}),
  };
  item.nepInitialAllocations = {
    ...(item.nepInitialAllocations || {}),
    [field]: item.nepInitialAllocations?.[field] || existing,
  };
  item.nepAllocations = {
    ...(item.nepAllocations || {}),
    [field]: item.nepAllocations?.[field] || existing,
  };
};

const recalculatePersonnelRecord = item => {
  let income = 0;
  let subsidy = 0;
  PERSONNEL_AMOUNT_FIELDS.forEach(field => {
    const allocation = item.nepAllocations?.[field] || fallbackAllocation(item, field, false);
    income += amount(allocation.income);
    subsidy += amount(allocation.subsidy);
  });
  item.chargedToIncomeAmount = roundCurrency(income);
  item.chargedToSubsidyAmount = roundCurrency(subsidy);
  item.chargedToIncomeEligible = income > 0;
  item.subsidyAmount = roundCurrency(subsidy);
  item.subsidyEligible = subsidy > 0;
  item.Total = roundCurrency(income + subsidy);
  return item;
};

export const applyPersonnelLineAllocation = (personnel, row, funding, nextAmount) => {
  const updated = personnel.map(item => ({
    ...item,
    nepInitialValues: item.nepInitialValues ? { ...item.nepInitialValues } : undefined,
    nepInitialAllocations: item.nepInitialAllocations
      ? { ...item.nepInitialAllocations }
      : undefined,
    nepAllocations: item.nepAllocations ? { ...item.nepAllocations } : undefined,
  }));
  const slots = row.sourceSlots.map(slot => {
    const item = updated[slot.index];
    snapshotAllocation(item, slot.field);
    const allocation = item.nepAllocations[slot.field];
    return {
      ...slot,
      current: amount(allocation[funding]),
      base: amount(allocation.income) + amount(allocation.subsidy),
    };
  });
  if (!slots.length) return updated;

  const currentTotal = slots.reduce((sum, slot) => sum + slot.current, 0);
  const baseTotal = slots.reduce((sum, slot) => sum + slot.base, 0);
  let allocated = 0;
  slots.forEach((slot, position) => {
    const weight =
      currentTotal > 0
        ? slot.current / currentTotal
        : baseTotal > 0
          ? slot.base / baseTotal
          : 1 / slots.length;
    const value =
      position === slots.length - 1
        ? roundCurrency(amount(nextAmount) - allocated)
        : roundCurrency(amount(nextAmount) * weight);
    allocated = roundCurrency(allocated + value);
    const item = updated[slot.index];
    const allocation = { ...item.nepAllocations[slot.field], [funding]: value };
    item.nepAllocations = { ...item.nepAllocations, [slot.field]: allocation };
    item[slot.field] = roundCurrency(amount(allocation.income) + amount(allocation.subsidy));
  });

  [...new Set(slots.map(slot => slot.index))].forEach(index => recalculatePersonnelRecord(updated[index]));
  return updated;
};

export const getPersonnelComparisonTotals = sections =>
  sections.flatMap(section => section.rows).reduce(
    (totals, row) => ({
      initialIncome: roundCurrency(totals.initialIncome + row.initialIncome),
      initialSubsidy: roundCurrency(totals.initialSubsidy + row.initialSubsidy),
      nepIncome: roundCurrency(totals.nepIncome + row.nepIncome),
      nepSubsidy: roundCurrency(totals.nepSubsidy + row.nepSubsidy),
    }),
    { initialIncome: 0, initialSubsidy: 0, nepIncome: 0, nepSubsidy: 0 }
  );
