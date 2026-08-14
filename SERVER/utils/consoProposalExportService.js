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
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const COSPersonnel = require('../models/COSPersonnel');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const {
  shouldShowDraftWatermark,
  drawMuhammaraDraftWatermark,
} = require('./proposalPdfWatermark');

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
    childrenAllowance: 0,
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

const getConsolidatedData = async (fiscalYear) => {
  const query = { status: 'ACTIVE' };
  if (fiscalYear) {
    query.fiscalYear = fiscalYear;
  }
  
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
    addPsValue('childrenAllowance', r.childrenAllowance);
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
      
      rowObj[`${prefix}_income`] = incomeVal ? incomeVal : '-';
      rowObj[`${prefix}_subsidy`] = subsidyVal ? subsidyVal : '-';
      rowObj[`${prefix}_budget`] = (incomeVal + subsidyVal) || '-';
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
      if (colNumber > 1 && cell.value !== '-' && typeof cell.value === 'number') {
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
  addDataRow('        f. Children Allowances', 'ps', 'childrenAllowance');
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

const generateConsoProposalPdf = async (fiscalYear) => {
  if (!MuhammaraRecipe) {
    throw new Error('PDF generation library (muhammara) is not installed on the server.');
  }

  const tmpFilePath = path.join(require('os').tmpdir(), `conso_proposal_${Date.now()}.pdf`);
  
  const recipe = new MuhammaraRecipe('new', tmpFilePath, {
    author: 'FMIS',
    title: 'CONSO PROPOSAL'
  });

  const data = await getConsolidatedData(fiscalYear);
  const regionNames = Object.keys(data.regions).sort();
  const showDraftWatermark = shouldShowDraftWatermark(data.proposalStatuses);

  const groupNames = ['GRAND TOTAL', 'CENTRAL OFFICE', 'TOTAL REGIONS', ...regionNames.map(r => r.toUpperCase())];
  
  const SUB_COL_WIDTH = 85; 
  const GROUP_WIDTH = SUB_COL_WIDTH * 3;
  const colX = [40]; // Particular
  const borderX = [35, 240]; 
  const groupStartBorderX = [240]; 
  
  groupNames.forEach((g, i) => {
    const startX = 240 + (i * GROUP_WIDTH);
    colX.push(startX + 5); // Income
    colX.push(startX + SUB_COL_WIDTH + 5); // Subsidy
    colX.push(startX + (SUB_COL_WIDTH * 2) + 5); // Budget
    
    borderX.push(startX + SUB_COL_WIDTH);
    borderX.push(startX + (SUB_COL_WIDTH * 2));
    borderX.push(startX + GROUP_WIDTH);
    groupStartBorderX.push(startX + GROUP_WIDTH);
  });
  
  const TABLE_WIDTH = borderX[borderX.length - 1] - 35;
  const PAGE_WIDTH = Math.max(842, TABLE_WIDTH + 70); 
  const PAGE_HEIGHT = 595;
  
  recipe.createPage(PAGE_WIDTH, PAGE_HEIGHT);
  drawMuhammaraDraftWatermark(recipe, {
    show: showDraftWatermark,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
  });
  
  // Header Logo
  try {
    recipe.image(path.join(__dirname, '../assets/logo.png'), 40, 30, { width: 50, height: 50 });
  } catch (e) {
    // Ignore if logo is missing
  }

  const title1 = "NATIONAL IRRIGATION ADMINISTRATION";
  const title2 = `CONSOLIDATED PROPOSED BUDGET FOR FY ${fiscalYear || 'ALL'}`;
  const title3 = "BY REGION";
  
  recipe.text(title1, (PAGE_WIDTH / 2) - (title1.length * 4), 40, { color: [0, 0, 0], fontSize: 14, bold: true });
  recipe.text(title2, (PAGE_WIDTH / 2) - (title2.length * 3.5), 58, { color: [0, 0, 0], fontSize: 12, bold: true });
  recipe.text(title3, (PAGE_WIDTH / 2) - (title3.length * 3.5), 72, { color: [0, 0, 0], fontSize: 12, bold: true });
  
  let currentRowY = 100;

  const drawHeaders = (y) => {
    recipe.rectangle(35, y, TABLE_WIDTH, 40, { fill: '#eaeaea' });
    recipe.text("PARTICULAR", 40, y + 16, { bold: true, fontSize: 10, color: [0, 0, 0] });
    
    groupNames.forEach((g, i) => {
      const startX = 240 + (i * GROUP_WIDTH);
      recipe.text(g, startX + (GROUP_WIDTH / 2) - (g.length * 2.5), y + 6, { bold: true, fontSize: 10, color: [0, 0, 0] });
      
      recipe.text("PROJECTED CORPORATE", startX + 5, y + 20, { bold: true, fontSize: 6, color: [0, 0, 0] });
      recipe.text("INCOME", startX + 5, y + 28, { bold: true, fontSize: 6, color: [0, 0, 0] });
      
      recipe.text("PROJECTED", startX + SUB_COL_WIDTH + 5, y + 20, { bold: true, fontSize: 6, color: [0, 0, 0] });
      recipe.text("SUBSIDY", startX + SUB_COL_WIDTH + 5, y + 28, { bold: true, fontSize: 6, color: [0, 0, 0] });
      
      recipe.text("PROPOSED", startX + (SUB_COL_WIDTH * 2) + 5, y + 20, { bold: true, fontSize: 6, color: [0, 0, 0] });
      recipe.text("BUDGET", startX + (SUB_COL_WIDTH * 2) + 5, y + 28, { bold: true, fontSize: 6, color: [0, 0, 0] });
    });

    groupStartBorderX.forEach(x => {
      recipe.rectangle(x, y, 1, 40, { fill: [0, 0, 0] });
    });
    borderX.forEach(x => {
      recipe.rectangle(x, y + 16, 1, 24, { fill: [0, 0, 0] });
    });
    recipe.rectangle(35, y, TABLE_WIDTH, 1, { fill: [0, 0, 0] });
    recipe.rectangle(240, y + 16, TABLE_WIDTH - 205, 1, { fill: [0, 0, 0] });
    recipe.rectangle(35, y + 40, TABLE_WIDTH, 1, { fill: [0, 0, 0] });
  };

  drawHeaders(currentRowY);
  currentRowY += 40;

  const getWrappedText = (text, maxLineLength) => {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
      if ((currentLine + ' ' + word).length > maxLineLength) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += (currentLine ? ' ' : '') + word;
      }
    });
    if (currentLine) lines.push(currentLine.trim());
    return lines;
  };

  const drawRow = (title, type, subCategory, isBold = false) => {
    const lines = getWrappedText(title, 32);
    const textHeight = Math.max(lines.length * 10, 10);
    const rowHeight = textHeight + 4; // 2 padding top/bottom

    if (currentRowY + rowHeight > PAGE_HEIGHT - 40) {
      recipe.endPage();
      recipe.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      drawMuhammaraDraftWatermark(recipe, {
        show: showDraftWatermark,
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT,
      });
      
      currentRowY = 40;
      drawHeaders(currentRowY);
      currentRowY += 40;
    }

    const rowBot = currentRowY + rowHeight;
    const textStartY = currentRowY + 2;

    lines.forEach((line, index) => {
      recipe.text(line, colX[0], textStartY + (index * 10), { bold: isBold, fontSize: 9, color: [0, 0, 0] });
    });
    
    if (type || subCategory) {
      let colIdx = 1;
      const populatePDFGroup = (mapSource) => {
        if (!mapSource) { colIdx += 3; return; }
        
        let incomeVal = 0;
        let subsidyVal = 0;
        
        if (!type && subCategory === 'totalUses') subsidyVal = mapSource.totalUses || 0;
        else if (!type && subCategory === 'totalCurrent') subsidyVal = mapSource.totalCurrent || 0;
        else if (!type && subCategory === 'surplusDeficit') subsidyVal = mapSource.surplusDeficit || 0;
        else if (type === 'income') incomeVal = mapSource.income[subCategory] || 0;
        else if (type === 'budgetarySupport') subsidyVal = mapSource.budgetarySupport || 0;
        else if (type) subsidyVal = mapSource[type][subCategory] || 0;
        
        const bgt = incomeVal + subsidyVal;
        
        const incStr = incomeVal ? formatCurrency(incomeVal) : '-';
        const subStr = subsidyVal ? formatCurrency(subsidyVal) : '-';
        const bgtStr = bgt ? formatCurrency(bgt) : '-';
        
        const getStrWidth = (str) => {
          let w = 0;
          for (let i=0; i < str.length; i++) {
            if (str[i] === ',' || str[i] === '.' || str[i] === '-' || str[i] === ' ') w += 2.5;
            else w += 4.5;
          }
          return w;
        };
        
        recipe.text(incStr, borderX[colIdx + 1] - 5 - getStrWidth(incStr), textStartY, { fontSize: 8, color: [0, 0, 0] }); colIdx++;
        recipe.text(subStr, borderX[colIdx + 1] - 5 - getStrWidth(subStr), textStartY, { fontSize: 8, color: [0, 0, 0] }); colIdx++;
        recipe.text(bgtStr, borderX[colIdx + 1] - 5 - getStrWidth(bgtStr), textStartY, { fontSize: 8, color: [0, 0, 0] }); colIdx++;
      };

      populatePDFGroup(data.grandTotal);
      populatePDFGroup(data.centralOffice);
      populatePDFGroup(data.totalRegions);
      regionNames.forEach(r => populatePDFGroup(data.regions[r]));
    }
    
    // Draw borders
    recipe.rectangle(35, rowBot, TABLE_WIDTH, 0.5, { fill: [0, 0, 0] });
    borderX.forEach(x => {
      recipe.rectangle(x, currentRowY, 0.5, rowBot - currentRowY, { fill: [0, 0, 0] });
    });
    
    currentRowY = rowBot;
  };

  drawRow('SOURCES OF FUNDS', null, null, true);
  drawRow('1. CORPORATE INCOME', null, null, true);
  drawRow('  Irrigation Service Fees', 'income', 'irrigationServiceFees');
  drawRow('  Rent Income', 'income', 'rentIncome');
  drawRow('  Water Service Fee', 'income', 'waterServiceFee');
  drawRow('  Miscellaneous Income', 'income', 'miscellaneousIncome');
  drawRow('TOTAL CORPORATE INCOME', 'income', 'total', true);
  drawRow('2. BUDGETARY SUPPORT', 'budgetarySupport', 'budgetarySupport');

  
  drawRow('USES OF FUNDS', null, null, true);
  drawRow('1. PERSONAL SERVICES', null, null, true);
  
  drawRow('  1. Salaries and Wages', null, null, true);
  drawRow('    a. Salaries - Regular (Authorized Positions)', 'ps', 'salariesAndWages');
  drawRow('    b. Casual Personnel', 'ps', 'casualPersonnel');
  
  drawRow('  2. Other Compensation', null, null, true);
  drawRow('    a. PERA', 'ps', 'pera');
  drawRow('    b. Representation Allowance', 'ps', 'representationAllowance');
  drawRow('    c. Transportation Allowance', 'ps', 'transportationAllowance');
  drawRow('    d. Honoraria', 'ps', 'honoraria');
  drawRow('    e. Uniform/Clothing Allowance', 'ps', 'uniformAllowance');
  drawRow('    f. Children Allowances', 'ps', 'childrenAllowance');
  drawRow('    g. Medical Allowances', 'ps', 'medicalAllowance');
  drawRow('    h. Meal Allowances', 'ps', 'mealAllowance');
  drawRow('    i. Additional Medical Allowance', 'ps', 'additionalMedicalAllowance');
  drawRow('    j. Per Diem & Allowance of Board', 'ps', 'perDiem');
  drawRow('    k. Subsistence Allowance', 'ps', 'subsistenceAllowance');
  drawRow('    l. Longevity Pay (Loyalty Award)', 'ps', 'loyaltyAward');
  drawRow('    m. Overtime Services', 'ps', 'overtimeServices');
  drawRow('    n. Special Counsel Allowance', 'ps', 'specialCounselAllowance');
  drawRow('    o. Productivity Enhancement', 'ps', 'productivityIncentive');
  drawRow('    p. Cash Gift', 'ps', 'cashGift');
  drawRow('    q. Mid-Year and Year-End Bonus', 'ps', 'midYearAndYearEndBonus');
  drawRow('    r. Performance Based Bonus', 'ps', 'performanceBasedBonus');
  drawRow('    s. Hazard Pay', 'ps', 'hazardPay');
  drawRow('    t. Other Bonuses and Allowances', 'ps', 'otherBonuses');
  drawRow('    u. Anniversary Bonus', 'ps', 'anniversaryBonus');
  
  drawRow('  3. Other Benefits', null, null, true);
  drawRow('    a. Retirement Benefits', 'ps', 'retirementBenefits');
  drawRow('    b. Terminal Leave Benefits', 'ps', 'terminalLeave');
  
  drawRow('  4. Fixed Personnel Expenditures', null, null, true);
  drawRow('    a. GSIS Ret. & Life Ins.', 'ps', 'gsisPremium');
  drawRow('    b. PAG-IBIG Contributions', 'ps', 'pagibigPremium');
  drawRow('    c. PHILHEALTH Contributions', 'ps', 'philhealthPremium');
  drawRow('    d. Employees Compensation Ins.', 'ps', 'employeeCompensation');
  drawRow('    e. Provident Fund', 'ps', 'providentFund');

  drawRow('  5. Leave Monetization', 'ps', 'leaveMonetization', true);

  drawRow('TOTAL PERSONAL SERVICES', 'ps', 'total', true);
  

  drawRow('2. MAINTENANCE AND OTHER OPERATING EXPENSES (MOOE)', null, null, true);
  drawRow('  Travelling Expenses', 'mooe', 'travellingExpenses');
  drawRow('  Training and Scholarship Expenses', 'mooe', 'trainingAndScholarship');
  drawRow('  Supplies and Materials', 'mooe', 'suppliesAndMaterials');
  drawRow('  Utility Expenses', 'mooe', 'utilityExpenses');
  drawRow('  Communication Expenses', 'mooe', 'communicationExpenses');
  drawRow('  Awards/Rewards Expenses', 'mooe', 'awardsRewards');
  drawRow('  Professional Services', 'mooe', 'professionalServices');
  drawRow('  General Services', 'mooe', 'generalServices');
  drawRow('  Repairs & Maintenance', 'mooe', 'repairsMaintenance');
  drawRow('  Subsidies and Donations', 'mooe', 'subsidiesDonations');
  drawRow('  Extraordinary & Miscellaneous Exp.', 'mooe', 'extraordinaryMiscellaneous');
  drawRow('  Taxes, Insurance Premiums', 'mooe', 'taxesInsurance');
  drawRow('  Financial Expenses', 'mooe', 'financialExpenses');
  drawRow('  Other MOOE', 'mooe', 'otherMooe');
  drawRow('TOTAL MOOE', 'mooe', 'total', true);


  drawRow('3. CAPITAL OUTLAY', null, null, true);
  drawRow('  Furniture & Fixtures', 'co', 'furnitureFixtures');
  drawRow('  Machinery and Equipment', 'co', 'machineryEquipment');
  drawRow('  Investment Outlay', 'co', 'investmentOutlay');
  drawRow('  Transportation Equipment', 'co', 'transportationEquipment');
  drawRow('  Intangible Assets', 'co', 'intangibleAssets');
  drawRow('  Acquisition of Land', 'co', 'acquisitionOfLand');
  drawRow('  Implementation/Construction', 'co', 'implementationConstruction');
  drawRow('TOTAL CAPITAL OUTLAY', 'co', 'total', true);


  drawRow('TOTAL CURRENT OPERATING EXPENDITURES (PS + MOOE)', null, 'totalCurrent', true);
  drawRow('TOTAL USES OF FUNDS', null, 'totalUses', true);

  recipe.endPage();
  recipe.endPDF();

  const buffer = fs.readFileSync(tmpFilePath);
  fs.unlinkSync(tmpFilePath);
  
  return buffer;
};

module.exports = {
  generateConsoProposalExcel,
  generateConsoProposalPdf
};
