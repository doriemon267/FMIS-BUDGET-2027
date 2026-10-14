const ExcelJS = require('exceljs');
let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (error) {
  console.warn('Muhammara not installed, PDF generation will be unavailable');
  MuhammaraRecipe = null;
}
const fs = require('fs');
const path = require('path');
const BRDConsolidation = require('../models/BRDConsolidation');
const PersonnelServices = require('../models/PersonnelServices');
const MooeProposal = require('../models/MooeProposal');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const COSPersonnel = require('../models/COSPersonnel');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const {
  shouldShowDraftWatermark,
  drawMuhammaraDraftWatermark,
} = require('./proposalPdfWatermark');
const { getFolioPageSize } = require('./reportPageLayout');
const { chunkRegionalMatrixRegions } = require('./regionalReportMatrix');

const CONSO_PDF_REGIONS_PER_PAGE = 3;
const CONSO_PDF_SUMMARY_LABELS = Object.freeze({
  subTotal: 'SUB TOTAL',
  total: 'TOTAL',
});
const CONSO_PDF_CONTINUATION_LABEL = 'CONTINUATION OF:';

const normalizeSelectedRegions = (regions) => {
  const values = Array.isArray(regions) ? regions : [regions];
  return [...new Set(values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter((value) => value && value.toLowerCase() !== 'all'))];
};

const getConsoPdfRegionGroups = (regions = []) => (
  chunkRegionalMatrixRegions(regions, CONSO_PDF_REGIONS_PER_PAGE)
);

// Helper to format currency
const formatCurrency = (amount) => {
  if (!amount) return '0.00';
  return parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Aggregation map
const createCategoryMap = () => ({
  income: {
    irrigationServiceFees: 0,
    rentIncome: 0,
    waterServiceFee: 0,
    miscellaneousIncome: 0,
  },
  budgetarySupport: 0,
  ps: {
    // 1. Salaries
    salariesAndWages: 0,
    casualPersonnel: 0,
    
    // 2. Other Compensation
    pera: 0,
    representationAllowance: 0,
    transportationAllowance: 0,
    honoraria: 0,
    uniformAllowance: 0,
    ChildrenAllowance: 0,
    medicalAllowance: 0,
    mealAllowance: 0,
    additionalMedicalAllowance: 0,
    perDiem: 0,
    subsistenceAllowance: 0,
    loyaltyAward: 0,
    overtimeServices: 0,
    specialCounselAllowance: 0,
    productivityIncentive: 0,
    cashGift: 0,
    midYearAndYearEndBonus: 0,
    performanceBasedBonus: 0,
    hazardPay: 0,
    otherBonuses: 0,
    anniversaryBonus: 0,

    // 3. Other Benefits
    retirementBenefits: 0,
    terminalLeave: 0,

    // 4. Fixed Personnel Expenditures
    gsisPremium: 0,
    pagibigPremium: 0,
    philhealthPremium: 0,
    employeeCompensation: 0,
    providentFund: 0,
    
    // 5. Leave Monetization
    leaveMonetization: 0,

    total: 0
  },
  mooe: {
    travellingExpenses: 0,
    trainingAndScholarship: 0,
    suppliesAndMaterials: 0,
    utilityExpenses: 0,
    communicationExpenses: 0,
    awardsRewards: 0,
    professionalServices: 0,
    generalServices: 0,
    repairsMaintenance: 0,
    subsidiesDonations: 0,
    extraordinaryMiscellaneous: 0,
    taxesInsurance: 0,
    otherMooe: 0,
    financialExpenses: 0
  },
  co: {
    furnitureFixtures: 0,
    machineryEquipment: 0,
    investmentOutlay: 0,
    transportationEquipment: 0,
    intangibleAssets: 0,
    acquisitionOfLand: 0,
    implementationConstruction: 0,
    total: 0
  },
  totalSources: 0,
  totalUses: 0,
  surplusDeficit: 0
});

const calculateTotals = (map) => {
  const sumObj = (obj) => Object.entries(obj)
    .filter(([k]) => k !== 'total')
    .reduce((a, [_, v]) => a + (typeof v === 'number' ? v : 0), 0);

  map.ps.total = sumObj(map.ps);
  map.mooe.total = sumObj(map.mooe);
  map.co.total = sumObj(map.co);
  map.income.total = sumObj(map.income);

  map.totalCurrent = map.ps.total + map.mooe.total;
  map.totalUses = map.ps.total + map.mooe.total + map.co.total;
  map.totalSources = map.income.total + map.budgetarySupport;
  map.surplusDeficit = map.totalSources - map.totalUses;
};

const getConsoPdfFinancialValues = (mapSource, type, subCategory) => {
  if (!mapSource || (!type && !subCategory)) return { income: 0, subsidy: 0, budget: 0 };

  let income = 0;
  let subsidy = 0;
  if (!type && ['totalUses', 'totalCurrent', 'surplusDeficit'].includes(subCategory)) {
    subsidy = Number(mapSource[subCategory]) || 0;
  } else if (type === 'income') {
    income = Number(mapSource.income?.[subCategory]) || 0;
  } else if (type === 'budgetarySupport') {
    subsidy = Number(mapSource.budgetarySupport) || 0;
  } else if (type) {
    subsidy = Number(mapSource[type]?.[subCategory]) || 0;
  }

  return { income, subsidy, budget: income + subsidy };
};

const getConsoPdfSummaryValues = (mapSource) => ({
  income: Number(mapSource?.income?.total) || 0,
  subsidy: Number(mapSource?.budgetarySupport) || 0,
  budget: Number(mapSource?.totalUses) || 0,
});

const sumConsoPdfValues = (values = []) => values.reduce((totals, value) => ({
  income: totals.income + (Number(value?.income) || 0),
  subsidy: totals.subsidy + (Number(value?.subsidy) || 0),
  budget: totals.budget + (Number(value?.budget) || 0),
}), { income: 0, subsidy: 0, budget: 0 });

const getConsolidatedData = async (fiscalYear, { selectedRegions = [], regionalOnly = false } = {}) => {
  const query = { status: 'ACTIVE' };
  if (fiscalYear) {
    query.fiscalYear = fiscalYear;
  }
  const normalizedRegions = normalizeSelectedRegions(selectedRegions);
  if (regionalOnly) query.isCentralOffice = { $ne: true };
  if (normalizedRegions.length > 0) query.region = { $in: normalizedRegions };
  
  const consolidations = await BRDConsolidation.find(query).lean();
  const proposalIds = consolidations.map(c => c.proposalId);

  const data = {
    grandTotal: createCategoryMap(),
    centralOffice: createCategoryMap(),
    totalRegions: createCategoryMap(),
    regions: {},
    proposalStatuses: [],
  };

  if (proposalIds.length === 0) return data;

  try {
    const workflows = await NewProposalWorkflow.find({ _id: { $in: proposalIds } })
      .select('status')
      .lean();
    data.proposalStatuses = workflows.map((workflow) => workflow.status);
  } catch (error) {
    // Missing or unverifiable workflow status intentionally leaves the PDF in DRAFT mode.
  }

  consolidations.forEach(c => {
    if (!c.isCentralOffice) {
      if (!data.regions[c.region]) {
        data.regions[c.region] = createCategoryMap();
      }
    }
  });

  const addToMap = (map, type, category, amount) => {
    amount = parseFloat(amount) || 0;
    if (amount === 0) return;
    
    if (type === 'budgetarySupport') {
      map.budgetarySupport += amount;
    } else if (map[type] && typeof map[type][category] !== 'undefined') {
      map[type][category] += amount;
    }
  };

  const processRecord = (record, type, categoryMapFn, amountField = 'Total', linkField = 'proposalId') => {
    const amount = record[amountField] || record.amount || record.cost || 0;
    if (amount === 0) return;

    const recordRefId = record[linkField];
    const c = consolidations.find(cons => cons.proposalId && recordRefId && cons.proposalId.toString() === recordRefId.toString());
    const regionName = c ? c.region : record.region;
    const isCentralOffice = c ? c.isCentralOffice : (regionName && regionName.toLowerCase().includes('central office'));
    
    const mappedCategory = categoryMapFn(record);

    addToMap(data.grandTotal, type, mappedCategory, amount);

    if (isCentralOffice) {
      addToMap(data.centralOffice, type, mappedCategory, amount);
    } else {
      addToMap(data.totalRegions, type, mappedCategory, amount);
      if (regionName && data.regions[regionName]) {
        addToMap(data.regions[regionName], type, mappedCategory, amount);
      }
    }
  };

  const getSafeString = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.categoryName && typeof val.categoryName === 'string') return val.categoryName;
    if (val.name && typeof val.name === 'string') return val.name;
    return String(val);
  };

  const psRecords = await PersonnelServices.find({ workflowRef: { $in: proposalIds } }).lean();
  psRecords.forEach(r => {
    const recordRefId = r.workflowRef;
    const c = consolidations.find(cons => cons.proposalId && recordRefId && cons.proposalId.toString() === recordRefId.toString());
    const regionName = c ? c.region : r.region;
    const isCentralOffice = c ? c.isCentralOffice : (regionName && regionName.toLowerCase().includes('central office'));
    
    const addPsValue = (subCategory, value) => {
      const amount = Number(value) || 0;
      if (amount === 0) return;
      addToMap(data.grandTotal, 'ps', subCategory, amount);
      if (isCentralOffice) {
        addToMap(data.centralOffice, 'ps', subCategory, amount);
      } else {
        addToMap(data.totalRegions, 'ps', subCategory, amount);
        if (regionName && data.regions[regionName]) {
          addToMap(data.regions[regionName], 'ps', subCategory, amount);
        }
      }
    };

    // 1. Salaries
    if (r.statusOfAppointment && r.statusOfAppointment.toLowerCase().includes('casual')) {
      addPsValue('casualPersonnel', r.annualSalary);
    } else {
      addPsValue('salariesAndWages', r.annualSalary);
    }
    
    // 2. Other Compensation
    addPsValue('pera', r.PERA);
    addPsValue('representationAllowance', r.RATA); // Mapping full RATA to RA
    addPsValue('honoraria', r.honoraria);
    addPsValue('uniformAllowance', r.uniformALLOWANCE);
    addPsValue('ChildrenAllowance', r.ChildrenAllowance);
    addPsValue('medicalAllowance', r.medical);
    addPsValue('mealAllowance', r.meal);
    addPsValue('additionalMedicalAllowance', r.additionalMedical);
    addPsValue('subsistenceAllowance', (Number(r.subsistenceAllowance) || 0) + (Number(r.subsistenceAllowanceMDS) || 0) + (Number(r.subsistenceAllowanceST) || 0));
    addPsValue('loyaltyAward', r.loyaltyAward);
    addPsValue('overtimeServices', r.overtimePay);
    addPsValue('specialCounselAllowance', r.courtAppearance);
    addPsValue('productivityIncentive', r.productivityIncentive);
    addPsValue('cashGift', r.cashGift);
    addPsValue('midYearAndYearEndBonus', (Number(r.midyearBonus) || 0) + (Number(r.yearEndBonus) || 0));
    addPsValue('hazardPay', r.hazardPay);
    
    // 3. Other Benefits
    addPsValue('retirementBenefits', r.retirementBenefits);
    addPsValue('terminalLeave', r.terminalLeave);

    // 4. Fixed Personnel Expenditures
    addPsValue('gsisPremium', r.gsisPremium);
    addPsValue('pagibigPremium', r.pagibigPremium);
    addPsValue('philhealthPremium', r.philhealthPremium);
    addPsValue('employeeCompensation', r.employeeCompensation);

    // 5. Leave Monetization
    addPsValue('leaveMonetization', r.earnedLeaves);
  });

  const mooeRecords = await MooeProposal.find({ proposalId: { $in: proposalIds } }).lean();
  mooeRecords.forEach(r => {
    processRecord(r, 'mooe', (rec) => {
      const cat = getSafeString(rec.category || rec.accountingTitle || rec.particulars).toLowerCase();
      if (cat.includes('travel')) return 'travellingExpenses';
      if (cat.includes('train')) return 'trainingAndScholarship';
      if (cat.includes('supplies') || cat.includes('material')) return 'suppliesAndMaterials';
      if (cat.includes('utilit') || cat.includes('water') || cat.includes('electricity')) return 'utilityExpenses';
      if (cat.includes('communicat') || cat.includes('telephone') || cat.includes('internet')) return 'communicationExpenses';
      if (cat.includes('award') || cat.includes('reward')) return 'awardsRewards';
      if (cat.includes('profession') || cat.includes('consult')) return 'professionalServices';
      if (cat.includes('general') || cat.includes('janitorial') || cat.includes('security')) return 'generalServices';
      if (cat.includes('repair') || cat.includes('maintenance')) return 'repairsMaintenance';
      if (cat.includes('subsid') || cat.includes('donation')) return 'subsidiesDonations';
      if (cat.includes('extraordinary') || cat.includes('miscellaneous')) return 'extraordinaryMiscellaneous';
      if (cat.includes('tax') || cat.includes('insurance')) return 'taxesInsurance';
      if (cat.includes('bank') || cat.includes('interest')) return 'financialExpenses';
      return 'otherMooe';
    });
  });

  const coRecords = await CapitalOutlay.find({ proposalId: { $in: proposalIds } }).populate('category').lean();
  coRecords.forEach(r => {
    processRecord(r, 'co', (rec) => {
      const cat = getSafeString(rec.category || rec.itemDescription || rec.particulars).toLowerCase();
      if (cat.includes('furniture')) return 'furnitureFixtures';
      if (cat.includes('machinery') || cat.includes('equipment')) return 'machineryEquipment';
      if (cat.includes('transportation')) return 'transportationEquipment';
      if (cat.includes('intangible')) return 'intangibleAssets';
      if (cat.includes('land')) return 'acquisitionOfLand';
      if (cat.includes('construct') || cat.includes('implement')) return 'implementationConstruction';
      return 'investmentOutlay';
    });
  });

  const incomeRecords = await Income.find({ proposalId: { $in: proposalIds } }).populate('category').lean();
  incomeRecords.forEach(r => {
    processRecord(r, 'income', (rec) => {
      const cat = getSafeString(rec.category || rec.particulars).toLowerCase();
      if (cat.includes('irrigation')) return 'irrigationServiceFees';
      if (cat.includes('rent')) return 'rentIncome';
      if (cat.includes('water')) return 'waterServiceFee';
      return 'miscellaneousIncome';
    }, 'amount');
  });

  // Calculate totals for all groups
  calculateTotals(data.grandTotal);
  calculateTotals(data.centralOffice);
  calculateTotals(data.totalRegions);
  Object.values(data.regions).forEach(calculateTotals);

  return data;
};

const generateConsoProposalExcel = async (fiscalYear) => {
  const data = await getConsolidatedData(fiscalYear);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('CONSO PROPOSAL');

  const columns = [
    { header: 'PARTICULAR', key: 'particular', width: 45 }
  ];
  
  const addGroupColumns = (prefix) => {
    columns.push({ header: 'PROJECTED CORPORATE INCOME', key: `${prefix}_income`, width: 25 });
    columns.push({ header: 'PROJECTED SUBSIDY', key: `${prefix}_subsidy`, width: 25 });
    columns.push({ header: 'PROPOSED BUDGET', key: `${prefix}_budget`, width: 25 });
  };

  addGroupColumns('grandTotal');
  addGroupColumns('centralOffice');
  addGroupColumns('totalRegions');

  const regionNames = Object.keys(data.regions).sort();
  regionNames.forEach(region => {
    addGroupColumns(`region_${region.replace(/\s+/g, '_')}`);
  });

  sheet.columns = columns;

  const superHeader = [''];
  superHeader.push('GRAND TOTAL', '', '');
  superHeader.push('CENTRAL OFFICE', '', '');
  superHeader.push('TOTAL REGIONS', '', '');
  regionNames.forEach(region => {
    superHeader.push(region, '', '');
  });

  sheet.insertRow(1, superHeader);

  const topRow = sheet.getRow(1);
  topRow.font = { bold: true, size: 12 };
  topRow.alignment = { horizontal: 'center', vertical: 'middle' };
  topRow.height = 30;

  let col = 2;
  const numGroups = 3 + regionNames.length;
  for (let i = 0; i < numGroups; i++) {
    sheet.mergeCells(1, col, 1, col + 2);
    col += 3;
  }

  const subHeaderRow = sheet.getRow(2);
  subHeaderRow.font = { bold: true };
  subHeaderRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  subHeaderRow.height = 40;

  const addDataRow = (title, categoryType, subCategory, isBold = false) => {
    const rowObj = { particular: title };
    
    const populateGroup = (prefix, mapSource) => {
      if (!categoryType && !subCategory) return;
      
      let incomeVal = 0;
      let subsidyVal = 0;
      
      if (!categoryType && subCategory === 'totalUses') {
        subsidyVal = mapSource.totalUses || 0;
      } else if (!categoryType && subCategory === 'totalCurrent') {
        subsidyVal = mapSource.totalCurrent || 0;
      } else if (!categoryType && subCategory === 'surplusDeficit') {
        subsidyVal = mapSource.surplusDeficit || 0;
      } else if (categoryType === 'income') {
        incomeVal = mapSource.income[subCategory] || 0;
      } else if (categoryType === 'budgetarySupport') {
        subsidyVal = mapSource.budgetarySupport || 0;
      } else if (categoryType) {
        subsidyVal = mapSource[categoryType][subCategory] || 0;
      }
      
      rowObj[`${prefix}_income`] = incomeVal || '';
      rowObj[`${prefix}_subsidy`] = subsidyVal || '';
      rowObj[`${prefix}_budget`] = (incomeVal + subsidyVal) || '';
    };

    populateGroup('grandTotal', data.grandTotal);
    populateGroup('centralOffice', data.centralOffice);
    populateGroup('totalRegions', data.totalRegions);
    
    regionNames.forEach(region => {
      populateGroup(`region_${region.replace(/\s+/g, '_')}`, data.regions[region]);
    });

    const row = sheet.addRow(rowObj);
    if (isBold) {
      row.font = { bold: true };
    }
    
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  };

  addDataRow('SOURCES OF FUNDS', null, null, true);
  addDataRow('  1. CORPORATE INCOME', null, null, true);
  addDataRow('     Irrigation Service Fees', 'income', 'irrigationServiceFees');
  addDataRow('     Rent Income', 'income', 'rentIncome');
  addDataRow('     Water Service Fee', 'income', 'waterServiceFee');
  addDataRow('     Miscellaneous Income', 'income', 'miscellaneousIncome');
  addDataRow('  TOTAL CORPORATE INCOME', 'income', 'total', true);
  addDataRow('  2. BUDGETARY SUPPORT', 'budgetarySupport', 'budgetarySupport');

  addDataRow('USES OF FUNDS', null, null, true);
  addDataRow('  CURRENT OPERATING EXPENDITURES', null, null, true);
  
  addDataRow('  1. PERSONAL SERVICES', null, null, true);
  
  addDataRow('     1. Salaries and Wages', null, null, true);
  addDataRow('        a. Salaries - Regular (Authorized Positions)', 'ps', 'salariesAndWages');
  addDataRow('        b. Casual Personnel', 'ps', 'casualPersonnel');
  
  addDataRow('     2. Other Compensation', null, null, true);
  addDataRow('        a. PERA', 'ps', 'pera');
  addDataRow('        b. Representation Allowance', 'ps', 'representationAllowance');
  addDataRow('        c. Transportation Allowance', 'ps', 'transportationAllowance');
  addDataRow('        d. Honoraria', 'ps', 'honoraria');
  addDataRow('        e. Uniform/Clothing Allowance', 'ps', 'uniformAllowance');
  addDataRow('        f. Children Allowances', 'ps', 'ChildrenAllowance');
  addDataRow('        g. Medical Allowances', 'ps', 'medicalAllowance');
  addDataRow('        h. Meal Allowances', 'ps', 'mealAllowance');
  addDataRow('        i. Additional Medical Allowance', 'ps', 'additionalMedicalAllowance');
  addDataRow('        j. Per Diem & Allowance of Board of Directors', 'ps', 'perDiem');
  addDataRow('        k. Subsistence Allowance', 'ps', 'subsistenceAllowance');
  addDataRow('        l. Longevity Pay (Loyalty Award)', 'ps', 'loyaltyAward');
  addDataRow('        m. Overtime Services', 'ps', 'overtimeServices');
  addDataRow('        n. Special Counsel Allowance', 'ps', 'specialCounselAllowance');
  addDataRow('        o. Productivity Enhancement Incentive', 'ps', 'productivityIncentive');
  addDataRow('        p. Cash Gift', 'ps', 'cashGift');
  addDataRow('        q. Mid-Year and Year-End Bonus', 'ps', 'midYearAndYearEndBonus');
  addDataRow('        r. Performance Based Bonus', 'ps', 'performanceBasedBonus');
  addDataRow('        s. Hazard Pay', 'ps', 'hazardPay');
  addDataRow('        t. Other Bonuses and Allowances', 'ps', 'otherBonuses');
  addDataRow('        u. Anniversary Bonus', 'ps', 'anniversaryBonus');
  
  addDataRow('     3. Other Benefits', null, null, true);
  addDataRow('        a. Retirement Benefits', 'ps', 'retirementBenefits');
  addDataRow('        b. Terminal Leave Benefits', 'ps', 'terminalLeave');
  
  addDataRow('     4. Fixed Personnel Expenditures', null, null, true);
  addDataRow('        a. GSIS Ret. & Life Insurance Premium', 'ps', 'gsisPremium');
  addDataRow('        b. PAG-IBIG Contributions', 'ps', 'pagibigPremium');
  addDataRow('        c. PHILHEALTH Contributions', 'ps', 'philhealthPremium');
  addDataRow('        d. Employees Compensation Insurance Premium', 'ps', 'employeeCompensation');
  addDataRow('        e. Provident Fund', 'ps', 'providentFund');

  addDataRow('     5. Leave Monetization/Earned Leaves', 'ps', 'leaveMonetization', true);

  addDataRow('  TOTAL PERSONAL SERVICES', 'ps', 'total', true);
  
  addDataRow('  2. MAINTENANCE & OTHER OPERATING EXPENSES', null, null, true);
  addDataRow('     Travelling Expenses', 'mooe', 'travellingExpenses');
  addDataRow('     Training and Scholarship Expenses', 'mooe', 'trainingAndScholarship');
  addDataRow('     Supplies and Materials', 'mooe', 'suppliesAndMaterials');
  addDataRow('     Utility Expenses', 'mooe', 'utilityExpenses');
  addDataRow('     Communication Expenses', 'mooe', 'communicationExpenses');
  addDataRow('     Awards/Rewards Expenses', 'mooe', 'awardsRewards');
  addDataRow('     Professional Services', 'mooe', 'professionalServices');
  addDataRow('     General Services', 'mooe', 'generalServices');
  addDataRow('     Repairs & Maintenance', 'mooe', 'repairsMaintenance');
  addDataRow('     Subsidies and Donations', 'mooe', 'subsidiesDonations');
  addDataRow('     Extraordinary & Miscellaneous Exp.', 'mooe', 'extraordinaryMiscellaneous');
  addDataRow('     Taxes, Insurance Premiums', 'mooe', 'taxesInsurance');
  addDataRow('     Financial Expenses', 'mooe', 'financialExpenses');
  addDataRow('     Other MOOE', 'mooe', 'otherMooe');
  addDataRow('  TOTAL MOOE', 'mooe', 'total', true);

  addDataRow('  3. CAPITAL OUTLAY', null, null, true);
  addDataRow('     Furniture & Fixtures', 'co', 'furnitureFixtures');
  addDataRow('     Machinery and Equipment', 'co', 'machineryEquipment');
  addDataRow('     Investment Outlay', 'co', 'investmentOutlay');
  addDataRow('     Transportation Equipment', 'co', 'transportationEquipment');
  addDataRow('     Intangible Assets', 'co', 'intangibleAssets');
  addDataRow('     Acquisition of Land', 'co', 'acquisitionOfLand');
  addDataRow('     Implementation/Construction', 'co', 'implementationConstruction');
  addDataRow('  TOTAL CAPITAL OUTLAY', 'co', 'total', true);
  
  addDataRow('  TOTAL USES OF FUNDS', null, 'totalUses', true);
  
  // Footer row for Surplus / Deficit
  const footerRowObj = { particular: 'SURPLUS/DEFICIT (SOURCES - USES)' };
  const populateFooter = (prefix, mapSource) => {
    // Only put the value in the budget column for the footer? Or across all?
    // Usually it makes sense in the proposed budget column
    footerRowObj[`${prefix}_income`] = '';
    footerRowObj[`${prefix}_subsidy`] = '';
    footerRowObj[`${prefix}_budget`] = mapSource.surplusDeficit;
  };
  
  populateFooter('grandTotal', data.grandTotal);
  populateFooter('centralOffice', data.centralOffice);
  populateFooter('totalRegions', data.totalRegions);
  regionNames.forEach(region => {
    populateFooter(`region_${region.replace(/\s+/g, '_')}`, data.regions[region]);
  });
  
  const footerRow = sheet.addRow(footerRowObj);
  footerRow.font = { bold: true };
  // A nice subtle highlight
  footerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFEFEF' }
  };
  
  footerRow.eachCell((cell, colNumber) => {
    if (colNumber > 1 && cell.value !== '' && typeof cell.value === 'number') {
      cell.numFmt = '#,##0.00';
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

const generateConsoProposalPdf = async (fiscalYear, { selectedRegions = [] } = {}) => {
  if (!MuhammaraRecipe) {
    throw new Error('PDF generation library (muhammara) is not installed on the server.');
  }

  const normalizedRegions = normalizeSelectedRegions(selectedRegions);
  const data = await getConsolidatedData(fiscalYear, {
    selectedRegions: normalizedRegions,
    regionalOnly: true,
  });
  const regionNames = Object.keys(data.regions).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  if (regionNames.length === 0) {
    const error = new Error('No active regional consolidation data was found for the selected regions.');
    error.statusCode = 404;
    throw error;
  }

  const reportRows = [
    ['SOURCES OF FUNDS', null, null, true],
    ['1. CORPORATE INCOME', null, null, true],
    ['  Irrigation Service Fees', 'income', 'irrigationServiceFees'],
    ['  Rent Income', 'income', 'rentIncome'],
    ['  Water Service Fee', 'income', 'waterServiceFee'],
    ['  Miscellaneous Income', 'income', 'miscellaneousIncome'],
    ['TOTAL CORPORATE INCOME', 'income', 'total', true],
    ['2. BUDGETARY SUPPORT', 'budgetarySupport', 'budgetarySupport'],
    ['USES OF FUNDS', null, null, true],
    ['1. PERSONAL SERVICES', null, null, true],
    ['  1. Salaries and Wages', null, null, true],
    ['    a. Salaries - Regular (Authorized Positions)', 'ps', 'salariesAndWages'],
    ['    b. Casual Personnel', 'ps', 'casualPersonnel'],
    ['  2. Other Compensation', null, null, true],
    ['    a. PERA', 'ps', 'pera'],
    ['    b. Representation Allowance', 'ps', 'representationAllowance'],
    ['    c. Transportation Allowance', 'ps', 'transportationAllowance'],
    ['    d. Honoraria', 'ps', 'honoraria'],
    ['    e. Uniform/Clothing Allowance', 'ps', 'uniformAllowance'],
    ['    f. Children Allowances', 'ps', 'ChildrenAllowance'],
    ['    g. Medical Allowances', 'ps', 'medicalAllowance'],
    ['    h. Meal Allowances', 'ps', 'mealAllowance'],
    ['    i. Additional Medical Allowance', 'ps', 'additionalMedicalAllowance'],
    ['    j. Per Diem & Allowance of Board', 'ps', 'perDiem'],
    ['    k. Subsistence Allowance', 'ps', 'subsistenceAllowance'],
    ['    l. Longevity Pay (Loyalty Award)', 'ps', 'loyaltyAward'],
    ['    m. Overtime Services', 'ps', 'overtimeServices'],
    ['    n. Special Counsel Allowance', 'ps', 'specialCounselAllowance'],
    ['    o. Productivity Enhancement', 'ps', 'productivityIncentive'],
    ['    p. Cash Gift', 'ps', 'cashGift'],
    ['    q. Mid-Year and Year-End Bonus', 'ps', 'midYearAndYearEndBonus'],
    ['    r. Performance Based Bonus', 'ps', 'performanceBasedBonus'],
    ['    s. Hazard Pay', 'ps', 'hazardPay'],
    ['    t. Other Bonuses and Allowances', 'ps', 'otherBonuses'],
    ['    u. Anniversary Bonus', 'ps', 'anniversaryBonus'],
    ['  3. Other Benefits', null, null, true],
    ['    a. Retirement Benefits', 'ps', 'retirementBenefits'],
    ['    b. Terminal Leave Benefits', 'ps', 'terminalLeave'],
    ['  4. Fixed Personnel Expenditures', null, null, true],
    ['    a. GSIS Ret. & Life Ins.', 'ps', 'gsisPremium'],
    ['    b. PAG-IBIG Contributions', 'ps', 'pagibigPremium'],
    ['    c. PHILHEALTH Contributions', 'ps', 'philhealthPremium'],
    ['    d. Employees Compensation Ins.', 'ps', 'employeeCompensation'],
    ['    e. Provident Fund', 'ps', 'providentFund'],
    ['  5. Leave Monetization', 'ps', 'leaveMonetization', true],
    ['TOTAL PERSONAL SERVICES', 'ps', 'total', true],
    ['2. MAINTENANCE AND OTHER OPERATING EXPENSES (MOOE)', null, null, true],
    ['  Travelling Expenses', 'mooe', 'travellingExpenses'],
    ['  Training and Scholarship Expenses', 'mooe', 'trainingAndScholarship'],
    ['  Supplies and Materials', 'mooe', 'suppliesAndMaterials'],
    ['  Utility Expenses', 'mooe', 'utilityExpenses'],
    ['  Communication Expenses', 'mooe', 'communicationExpenses'],
    ['  Awards/Rewards Expenses', 'mooe', 'awardsRewards'],
    ['  Professional Services', 'mooe', 'professionalServices'],
    ['  General Services', 'mooe', 'generalServices'],
    ['  Repairs & Maintenance', 'mooe', 'repairsMaintenance'],
    ['  Subsidies and Donations', 'mooe', 'subsidiesDonations'],
    ['  Extraordinary & Miscellaneous Exp.', 'mooe', 'extraordinaryMiscellaneous'],
    ['  Taxes, Insurance Premiums', 'mooe', 'taxesInsurance'],
    ['  Financial Expenses', 'mooe', 'financialExpenses'],
    ['  Other MOOE', 'mooe', 'otherMooe'],
    ['TOTAL MOOE', 'mooe', 'total', true],
    ['3. CAPITAL OUTLAY', null, null, true],
    ['  Furniture & Fixtures', 'co', 'furnitureFixtures'],
    ['  Machinery and Equipment', 'co', 'machineryEquipment'],
    ['  Investment Outlay', 'co', 'investmentOutlay'],
    ['  Transportation Equipment', 'co', 'transportationEquipment'],
    ['  Intangible Assets', 'co', 'intangibleAssets'],
    ['  Acquisition of Land', 'co', 'acquisitionOfLand'],
    ['  Implementation/Construction', 'co', 'implementationConstruction'],
    ['TOTAL CAPITAL OUTLAY', 'co', 'total', true],
    ['TOTAL CURRENT OPERATING EXPENDITURES (PS + MOOE)', null, 'totalCurrent', true],
    ['TOTAL USES OF FUNDS', null, 'totalUses', true],
  ].map(([title, type, subCategory, bold = false]) => ({ title, type, subCategory, bold }));

  const tmpFilePath = path.join(require('os').tmpdir(), `conso_proposal_${Date.now()}.pdf`);
  const recipe = new MuhammaraRecipe('new', tmpFilePath, {
    author: 'FMIS',
    title: 'CONSO PROPOSAL',
    subject: `Selected regional consolidated proposed budget for FY ${fiscalYear || 'ALL'}`,
  });
  const showDraftWatermark = shouldShowDraftWatermark(data.proposalStatuses);
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = getFolioPageSize(true);
  const MARGIN = 18;
  const CONTENT_LEFT = MARGIN;
  const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
  const TABLE_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
  const PARTICULARS_WIDTH = 300;
  const HEADER_HEIGHT = 34;
  const GROUP_HEADER_HEIGHT = 17;
  const SUMMARY_ROW_HEIGHT = 18;
  const SUMMARY_GAP = 6;
  const SUMMARY_BLOCK_HEIGHT = (SUMMARY_ROW_HEIGHT * 2) + SUMMARY_GAP;
  const PAGE_CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - 16;
  const FINANCIAL_COLUMNS = [
    { key: 'income', label: 'INCOME' },
    { key: 'subsidy', label: 'SUBSIDY' },
    { key: 'budget', label: 'BUDGET' },
  ];
  const regionGroups = getConsoPdfRegionGroups(regionNames);
  const overallTotal = getConsoPdfSummaryValues(data.grandTotal);
  let pageNo = 0;
  let pageOpen = false;
  let firstPage = true;
  let currentY = MARGIN;

  const wrapText = (value, maxWidth, fontSize = 7) => {
    const text = String(value || '').trim();
    if (!text) return [''];
    const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.52)));
    const lines = [];
    let line = '';
    text.split(/\s+/).forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  };

  const drawPageChrome = (isFirstPage) => {
    drawMuhammaraDraftWatermark(recipe, {
      show: showDraftWatermark,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    recipe.text('CONSO PROPOSAL - SELECTED REGIONS', CONTENT_LEFT, PAGE_HEIGHT - 17, {
      fontSize: 6.5,
      color: '#555555',
    });
    recipe.text(`Page ${pageNo}`, CONTENT_RIGHT, PAGE_HEIGHT - 17, {
      fontSize: 6.5,
      color: '#555555',
      align: 'right',
    });

    if (isFirstPage) {
      try {
        recipe.image(path.join(__dirname, '../assets/logo.png'), CONTENT_LEFT, 24, { width: 48, height: 48 });
      } catch (error) {
        // A missing logo must not prevent report generation.
      }
      recipe.text('NATIONAL IRRIGATION ADMINISTRATION', PAGE_WIDTH / 2, 29, {
        color: '#000000', fontSize: 13, bold: true, align: 'center',
      });
      recipe.text(`CONSOLIDATED PROPOSED BUDGET FOR FY ${fiscalYear || 'ALL'}`, PAGE_WIDTH / 2, 49, {
        color: '#000000', fontSize: 11.5, bold: true, align: 'center',
      });
      recipe.text(`BY REGION - ${regionNames.length} SELECTED`, PAGE_WIDTH / 2, 66, {
        color: '#000000', fontSize: 10, bold: true, align: 'center',
      });
      currentY = 88;
      return;
    }

    currentY = MARGIN + 8;
    recipe.text(CONSO_PDF_CONTINUATION_LABEL, CONTENT_LEFT, currentY, {
      color: '#000000', fontSize: 7.5, bold: true,
    });
    recipe.text('CONSOLIDATED PROPOSED BUDGET BY REGION', CONTENT_LEFT + 82, currentY, {
      color: '#000000', fontSize: 7.5, bold: true,
    });
    recipe.text(`FISCAL YEAR ${fiscalYear || 'ALL'}`, CONTENT_RIGHT, currentY, {
      color: '#000000', fontSize: 7.5, bold: true, align: 'right',
    });
    currentY += 12;
    recipe.rectangle(CONTENT_LEFT, currentY, TABLE_WIDTH, 0.6, {
      fill: '#555555', stroke: '#555555', lineWidth: 0,
    });
    currentY += 6;
  };

  const getLayout = (regions) => {
    const groupWidth = (TABLE_WIDTH - PARTICULARS_WIDTH) / (regions.length + 1);
    return { groupWidth, subcolumnWidth: groupWidth / FINANCIAL_COLUMNS.length };
  };

  const drawMatrixHeader = (regions, layout) => {
    const y = currentY;
    recipe.rectangle(CONTENT_LEFT, y, PARTICULARS_WIDTH, HEADER_HEIGHT, {
      fill: '#e5e7eb', stroke: '#555555', lineWidth: 0.4,
    });
    recipe.text('PARTICULARS', CONTENT_LEFT + 5, y + 11, {
      color: '#000000', fontSize: 7, bold: true,
    });
    [...regions, CONSO_PDF_SUMMARY_LABELS.subTotal].forEach((label, groupIndex) => {
      const groupX = CONTENT_LEFT + PARTICULARS_WIDTH + (groupIndex * layout.groupWidth);
      recipe.rectangle(groupX, y, layout.groupWidth, GROUP_HEADER_HEIGHT, {
        fill: '#e5e7eb', stroke: '#555555', lineWidth: 0.4,
      });
      wrapText(label, layout.groupWidth - 6, 5.8).slice(0, 2).forEach((line, lineIndex) => {
        recipe.text(line, groupX + (layout.groupWidth / 2), y + 4 + (lineIndex * 6.5), {
          color: '#000000', fontSize: 5.8, bold: true, align: 'center',
        });
      });
      FINANCIAL_COLUMNS.forEach((column, columnIndex) => {
        const columnX = groupX + (columnIndex * layout.subcolumnWidth);
        recipe.rectangle(columnX, y + GROUP_HEADER_HEIGHT, layout.subcolumnWidth, HEADER_HEIGHT - GROUP_HEADER_HEIGHT, {
          fill: '#f3f4f6', stroke: '#777777', lineWidth: 0.3,
        });
        recipe.text(column.label, columnX + (layout.subcolumnWidth / 2), y + GROUP_HEADER_HEIGHT + 5, {
          color: '#000000', fontSize: 5.1, bold: true, align: 'center',
        });
      });
    });
    currentY += HEADER_HEIGHT;
  };

  const startPage = (regions) => {
    if (pageOpen) recipe.endPage();
    pageNo += 1;
    recipe.createPage(PAGE_WIDTH, PAGE_HEIGHT);
    pageOpen = true;
    drawPageChrome(firstPage);
    firstPage = false;
    const layout = getLayout(regions);
    drawMatrixHeader(regions, layout);
    return layout;
  };

  const getFittedAmountFontSize = (text, maxWidth, bold = false) => {
    const defaultFontSize = 5.2;
    const minimumFontSize = 1;
    let measuredWidth = 0;

    try {
      const dimensions = recipe.textDimensions(text, {
        font: bold ? 'Helvetica-Bold' : 'Helvetica',
        size: defaultFontSize,
      });
      measuredWidth = Math.max(
        Number(dimensions?.width) || 0,
        Number(dimensions?.xMax) || 0
      );
    } catch (error) {
      // Keep PDF generation compatible with Muhammara versions without textDimensions.
    }

    if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
      measuredWidth = [...text].reduce((width, character) => {
        if (character === ',' || character === '.') return width + (defaultFontSize * 0.28);
        if (character === '-' || character === '(' || character === ')') return width + (defaultFontSize * 0.34);
        return width + (defaultFontSize * 0.56);
      }, 0);
    }

    if (measuredWidth <= maxWidth) return defaultFontSize;
    return Math.max(
      minimumFontSize,
      Math.min(defaultFontSize, defaultFontSize * (maxWidth / measuredWidth) * 0.92)
    );
  };

  const drawFinancialValues = (values, groupX, y, height, layout, { bold = false } = {}) => {
    FINANCIAL_COLUMNS.forEach((column, columnIndex) => {
      const cellX = groupX + (columnIndex * layout.subcolumnWidth);
      recipe.rectangle(cellX, y, layout.subcolumnWidth, height, {
        stroke: '#aaaaaa', lineWidth: 0.25,
      });
      const amount = Number(values?.[column.key]) || 0;
      if (!amount) return;

      const amountText = formatCurrency(amount);
      const horizontalPadding = 4;
      const availableWidth = Math.max(1, layout.subcolumnWidth - (horizontalPadding * 2));
      const fontSize = getFittedAmountFontSize(amountText, availableWidth, bold);
      recipe.text(amountText, cellX + layout.subcolumnWidth - horizontalPadding, y + (height / 2), {
        color: '#000000',
        size: fontSize,
        fontSize,
        bold,
        align: 'right center',
      });
    });
  };

  for (const regions of regionGroups) {
    let layout = startPage(regions);
    let pageHasRows = false;

    const drawSummaryRow = (label, valuesByRegion, totalValues, fill, showRegionValues = true) => {
      recipe.rectangle(CONTENT_LEFT, currentY, PARTICULARS_WIDTH, SUMMARY_ROW_HEIGHT, {
        fill, stroke: '#555555', lineWidth: 0.4,
      });
      recipe.text(label, CONTENT_LEFT + 5, currentY + 5, {
        color: '#000000', fontSize: 7, bold: true,
      });
      regions.forEach((region, index) => {
        const groupX = CONTENT_LEFT + PARTICULARS_WIDTH + (index * layout.groupWidth);
        if (showRegionValues) {
          drawFinancialValues(valuesByRegion?.[region], groupX, currentY, SUMMARY_ROW_HEIGHT, layout, { bold: true });
        } else {
          FINANCIAL_COLUMNS.forEach((column, columnIndex) => {
            recipe.rectangle(groupX + (columnIndex * layout.subcolumnWidth), currentY, layout.subcolumnWidth, SUMMARY_ROW_HEIGHT, {
              fill, stroke: '#777777', lineWidth: 0.3,
            });
          });
        }
      });
      const totalX = CONTENT_LEFT + PARTICULARS_WIDTH + (regions.length * layout.groupWidth);
      drawFinancialValues(totalValues, totalX, currentY, SUMMARY_ROW_HEIGHT, layout, { bold: true });
      currentY += SUMMARY_ROW_HEIGHT;
    };

    const drawPageSummaries = () => {
      if (!pageHasRows) return;
      const valuesByRegion = Object.fromEntries(regions.map((region) => [
        region,
        getConsoPdfSummaryValues(data.regions[region]),
      ]));
      drawSummaryRow(
        CONSO_PDF_SUMMARY_LABELS.subTotal,
        valuesByRegion,
        sumConsoPdfValues(Object.values(valuesByRegion)),
        '#ededed'
      );
      drawSummaryRow(
        CONSO_PDF_SUMMARY_LABELS.total,
        null,
        overallTotal,
        '#dfe8df',
        false
      );
      currentY += SUMMARY_GAP;
      pageHasRows = false;
    };

    const ensureSpace = (height) => {
      if (currentY + height <= PAGE_CONTENT_BOTTOM - SUMMARY_BLOCK_HEIGHT) return;
      if (!pageHasRows) return;
      drawPageSummaries();
      layout = startPage(regions);
    };

    reportRows.forEach((row) => {
      const lines = wrapText(row.title, PARTICULARS_WIDTH - 10, 6.5);
      const rowHeight = Math.max(15, (Math.max(1, lines.length) * 7.2) + 5);
      ensureSpace(rowHeight);
      const rowY = currentY;
      recipe.rectangle(CONTENT_LEFT, rowY, PARTICULARS_WIDTH, rowHeight, {
        fill: row.bold && !row.type && !row.subCategory ? '#f3f4f6' : undefined,
        stroke: '#aaaaaa',
        lineWidth: 0.25,
      });
      lines.forEach((line, lineIndex) => {
        recipe.text(line, CONTENT_LEFT + 5, rowY + 4 + (lineIndex * 7.2), {
          color: '#000000', fontSize: 6.5, bold: row.bold,
        });
      });

      const hasValues = Boolean(row.type || row.subCategory);
      const rowValues = regions.map((region, regionIndex) => {
        const groupX = CONTENT_LEFT + PARTICULARS_WIDTH + (regionIndex * layout.groupWidth);
        const values = getConsoPdfFinancialValues(data.regions[region], row.type, row.subCategory);
        if (hasValues) {
          drawFinancialValues(values, groupX, rowY, rowHeight, layout, { bold: row.bold });
        } else {
          FINANCIAL_COLUMNS.forEach((column, columnIndex) => {
            recipe.rectangle(groupX + (columnIndex * layout.subcolumnWidth), rowY, layout.subcolumnWidth, rowHeight, {
              fill: '#f3f4f6', stroke: '#aaaaaa', lineWidth: 0.25,
            });
          });
        }
        return values;
      });
      const subTotalX = CONTENT_LEFT + PARTICULARS_WIDTH + (regions.length * layout.groupWidth);
      if (hasValues) {
        drawFinancialValues(sumConsoPdfValues(rowValues), subTotalX, rowY, rowHeight, layout, { bold: true });
      } else {
        FINANCIAL_COLUMNS.forEach((column, columnIndex) => {
          recipe.rectangle(subTotalX + (columnIndex * layout.subcolumnWidth), rowY, layout.subcolumnWidth, rowHeight, {
            fill: '#f3f4f6', stroke: '#aaaaaa', lineWidth: 0.25,
          });
        });
      }
      currentY += rowHeight;
      pageHasRows = true;
    });

    drawPageSummaries();
  }

  recipe.endPage();
  recipe.endPDF();
  try {
    return fs.readFileSync(tmpFilePath);
  } finally {
    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
  }
};

module.exports = {
  generateConsoProposalExcel,
  generateConsoProposalPdf,
  _private: {
    CONSO_PDF_REGIONS_PER_PAGE,
    CONSO_PDF_SUMMARY_LABELS,
    CONSO_PDF_CONTINUATION_LABEL,
    normalizeSelectedRegions,
    getConsoPdfRegionGroups,
    getConsoPdfFinancialValues,
    getConsoPdfSummaryValues,
    sumConsoPdfValues,
    getConsolidatedData,
  },
};