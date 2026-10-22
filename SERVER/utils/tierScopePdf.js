/**
 * Tier Budget Proposal PDF for a single scope (one region / department / division).
 *
 * Mirrors the /tier page layout:
 *   Particulars | Tier 1 (Income, Subsidy) | Tier 2 (Income, Subsidy) | Total (Income, Subsidy) | Proposed Budget
 * and the Sources of Funds report structure (1. Corporate Income ... TOTAL SOURCES OF FUNDS).
 */

const COLORS = {
  headerFill: '#375e38',
  headerLine: '#6f8f70',
  headerText: '#ffffff',
  sectionFill: '#dfe9dc',
  subtotalFill: '#f3f6f2',
  grandFill: '#264524',
  border: '#b9c2b9',
  strongBorder: '#4b5b4b',
  text: '#1d1d1d',
  muted: '#5f6b5f',
};

const MOOE = 'Maintenance and Other Operating Expenses';
const USE_CATEGORIES = [
  { key: 'Personnel Services', total: 'TOTAL PERSONNEL SERVICES' },
  { key: MOOE, total: 'TOTAL MAINTENANCE AND OTHER OPERATING EXPENSES' },
  { key: 'Capital Outlay', total: 'TOTAL CAPITAL OUTLAY' },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatAmount = (value) => {
  if (value === null || value === undefined) return '';
  const n = num(value);
  if (Math.abs(n) < 0.005) return '-';
  const text = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${text})` : text;
};

// Column values: [T1 Income, T1 Subsidy, T2 Income, T2 Subsidy, Total Income, Total Subsidy, Proposed Budget]
const splitValues = ({ tier1Income = 0, tier1 = 0, tier2Income = 0, tier2 = 0 }) => {
  const income = num(tier1Income) + num(tier2Income);
  const subsidy = num(tier1) + num(tier2);
  return [num(tier1Income), num(tier1), num(tier2Income), num(tier2), income, subsidy, income + subsidy];
};
const incomeOnly = (amount) => [null, null, null, null, num(amount), 0, num(amount)];

/** Build the ordered list of report rows from the Tier page report summary. */
const buildTierScopeRows = (reportSummary = {}) => {
  const rows = [];
  const src = reportSummary.sourcesOfFunds || {};
  const uses = reportSummary.usesOfFunds || {};
  const support = src.budgetarySupport || {};
  const lineItems = Array.isArray(reportSummary.lineItems) ? reportSummary.lineItems : [];
  const breakdown = Array.isArray(reportSummary.incomeBreakdown) ? reportSummary.incomeBreakdown : [];

  const corporateIncome = num(src.corporateIncome);
  const incomeTier2 = src.corporateIncomeTier2 !== undefined ? num(src.corporateIncomeTier2) : 0;
  const incomeTier1 = src.corporateIncomeTier1 !== undefined ? num(src.corporateIncomeTier1) : corporateIncome - incomeTier2;

  // A. SOURCES OF FUNDS
  rows.push({ kind: 'section', label: 'A. SOURCES OF FUNDS' });
  rows.push({ kind: 'heading', label: '1. CORPORATE INCOME', indent: 1 });

  const isfGroup = breakdown.find((g) => g && g.isIsf);
  breakdown.forEach((group) => {
    if (!group) return;
    if (group.isNetIsf) {
      const discount = isfGroup ? Math.max(0, num(isfGroup.subtotal) - num(group.subtotal)) : 0;
      if (discount > 0) rows.push({ kind: 'item', label: 'Less: Discount on ISF', indent: 2, bold: true, values: incomeOnly(discount) });
      rows.push({ kind: 'item', label: group.category || 'Net Irrigation Service Fees', indent: 2, bold: true, values: incomeOnly(group.subtotal) });
      return;
    }
    rows.push({ kind: 'heading', label: group.category, indent: 2 });
    (group.items || []).forEach((item) => {
      rows.push({ kind: 'item', label: item.name || item.particulars || '-', indent: 3, values: incomeOnly(item.amount) });
    });
    rows.push({
      kind: 'item',
      label: group.isIsf ? 'Total ISF' : `Subtotal (${group.category})`,
      indent: 3,
      italic: true,
      values: incomeOnly(group.subtotal),
    });
  });

  rows.push({
    kind: 'subtotal',
    label: 'TOTAL-CORPORATE INCOME',
    indent: 2,
    values: splitValues({ tier1Income: incomeTier1, tier2Income: incomeTier2 }),
  });

  rows.push({ kind: 'heading', label: '2. BUDGETARY SUPPORT', indent: 1 });
  rows.push({ kind: 'label', label: 'Subsidy to the National Irrigation Administration:', indent: 2 });
  const supportValues = splitValues({ tier1: support.tier1, tier2: support.tier2 });
  rows.push({ kind: 'item', label: 'a. Operating Requirements', indent: 3, values: supportValues });
  rows.push({ kind: 'subtotal', label: 'TOTAL BUDGETARY SUPPORT', indent: 2, values: supportValues });

  const sourcesValues = splitValues({
    tier1Income: incomeTier1,
    tier1: support.tier1,
    tier2Income: incomeTier2,
    tier2: support.tier2,
  });
  if (src.proposedBudget !== undefined) sourcesValues[6] = num(src.proposedBudget);
  rows.push({ kind: 'grand', label: 'TOTAL SOURCES OF FUNDS', values: sourcesValues });

  // B. USES OF FUNDS
  rows.push({ kind: 'section', label: 'B. USES OF FUNDS' });
  USE_CATEGORIES.forEach(({ key, total }) => {
    const items = lineItems.filter((item) => item && item.category === key);
    rows.push({ kind: 'heading', label: key, indent: 1 });
    let currentSub = null;
    items.forEach((item) => {
      const label = item.description || item.subCategory || '-';
      const sub = item.subCategory && item.subCategory !== label && item.subCategory !== key && item.subCategory !== '—' ? item.subCategory : null;
      if (sub && sub !== currentSub) {
        currentSub = sub;
        rows.push({ kind: 'label', label: sub, indent: 2, bold: true });
      }
      const values = splitValues({
        tier1Income: item.tier1Income !== undefined ? item.tier1Income : item.corporateIncome,
        tier1: item.tier1,
        tier2Income: item.tier2Income,
        tier2: item.tier2,
      });
      rows.push({ kind: 'item', label, indent: sub ? 3 : 2, values });
    });
    const categoryTotals = uses[key] || {};
    rows.push({
      kind: 'subtotal',
      label: total,
      indent: 1,
      values: splitValues({
        tier1Income: categoryTotals.tier1Income !== undefined ? categoryTotals.tier1Income : num(reportSummary.usesCorporateIncome?.[key]),
        tier1: categoryTotals.tier1,
        tier2Income: categoryTotals.tier2Income,
        tier2: categoryTotals.tier2,
      }),
    });
  });

  const sumUses = (field) => USE_CATEGORIES.reduce((s, { key }) => s + num(uses[key]?.[field]), 0);
  rows.push({
    kind: 'grand',
    label: 'TOTAL USES OF FUNDS',
    values: splitValues({
      tier1Income: uses.totalTier1Income !== undefined ? uses.totalTier1Income : sumUses('tier1Income'),
      tier1: uses.totalTier1 !== undefined ? uses.totalTier1 : sumUses('tier1'),
      tier2Income: uses.totalTier2Income !== undefined ? uses.totalTier2Income : sumUses('tier2Income'),
      tier2: uses.totalTier2 !== undefined ? uses.totalTier2 : sumUses('tier2'),
    }),
  });
  rows.push({
    kind: 'subtotal',
    label: 'SURPLUS / (DEFICIT)',
    values: [null, null, null, null, null, null, num(reportSummary.surplusDeficit)],
  });

  return rows;
};

/**
 * Draw the report on a muhammara Recipe. Leaves the last page open so the caller can
 * finish with recipe.endPage().endPDF().
 */
const renderTierScopePdf = (recipe, {
  reportSummary,
  pageWidth = 1008,
  pageHeight = 612,
  logoPath = null,
  fiscalYear,
  regionDisplay = 'All',
  departmentDisplay = 'All',
  divisionDisplay = 'All',
  versionDisplay = '—',
  documentId = '',
  generatedAt = new Date(),
  onPageCreated = () => {},
} = {}) => {
  const MARGIN = 30;
  const tableWidth = pageWidth - MARGIN * 2;
  const amountWidth = 94;
  const proposedWidth = 116;
  const particularsWidth = tableWidth - amountWidth * 6 - proposedWidth;
  const colWidths = [particularsWidth, ...Array(6).fill(amountWidth), proposedWidth];
  const colX = [];
  colWidths.reduce((x, w) => { colX.push(x); return x + w; }, MARGIN);
  const tableRight = MARGIN + tableWidth;
  const FOOTER_SPACE = 30;
  const FONT = 7.6;
  const LINE = 9.6;

  let page = 0;
  let y = 0;

  // Measure with the real Helvetica metrics (muhammara's own right/center alignment drifts at small sizes).
  const fontCache = {};
  const measure = (text, size, { bold = false, italic = false } = {}) => {
    const variant = bold && italic ? 'bi' : bold ? 'b' : italic ? 'i' : 'r';
    try {
      if (!(variant in fontCache)) {
        const file = recipe.fonts?.helvetica?.[variant];
        fontCache[variant] = file && recipe.writer ? recipe.writer.getFontForFile(file) : null;
      }
      const font = fontCache[variant];
      if (font) return font.calculateTextDimensions(String(text), size).xMax;
    } catch (_) {
      fontCache[variant] = null;
    }
    return String(text).length * size * 0.52;
  };
  // align: 'left' | 'right' | 'center' relative to x
  const write = (text, x, top, opts = {}, align = 'left') => {
    const value = String(text);
    let left = x;
    if (align !== 'left') {
      const w = measure(value, opts.size || 8, opts);
      left = align === 'right' ? x - w : x - w / 2;
    }
    recipe.text(value, left, top, opts);
  };

  const vline = (x, top, height, color = COLORS.border, w = 0.5) => recipe.rectangle(x, top, w, height, { fill: color });
  const hline = (top, color = COLORS.border, w = 0.5) => recipe.rectangle(MARGIN, top, tableWidth, w, { fill: color });

  const drawFooter = () => {
    const fy = pageHeight - 20;
    write(`Tier Budget Proposal Report  |  FY ${fiscalYear || '-'}  |  ${regionDisplay}`, MARGIN, fy, { size: 7, color: COLORS.muted });
    if (documentId) write(`Document ID: ${documentId}`, pageWidth / 2, fy, { size: 7, color: COLORS.muted}, 'center');
    write(`Page ${page}`, tableRight, fy, { size: 7, color: COLORS.muted}, 'right');
  };

  const drawTableHeader = () => {
    const top = y;
    const h1 = 17;
    const h2 = 15;
    recipe.rectangle(MARGIN, top, tableWidth, h1 + h2, { fill: COLORS.headerFill });
    const headText = { size: 7.8, bold: true, color: COLORS.headerText };
    write('PARTICULARS', MARGIN + 6, top + (h1 + h2) / 2 - 4, headText);
    ['TIER 1', 'TIER 2', 'TOTAL'].forEach((label, i) => {
      const x = colX[1 + i * 2];
      write(label, x + amountWidth, top + 5, { ...headText }, 'center');
      vline(x, top, h1 + h2, COLORS.headerLine);
    });
    recipe.rectangle(colX[1], top + h1, amountWidth * 6, 0.5, { fill: COLORS.headerLine });
    for (let i = 1; i <= 6; i += 1) {
      const label = i % 2 === 1 ? 'Income' : 'Subsidy';
      write(label, colX[i] + amountWidth - 5, top + h1 + 4, { ...headText, size: 7.2}, 'right');
      if (i % 2 === 0) vline(colX[i], top + h1, h2, COLORS.headerLine);
    }
    vline(colX[7], top, h1 + h2, COLORS.headerLine);
    write('PROPOSED', colX[7] + proposedWidth / 2, top + 6, { ...headText }, 'center');
    write('BUDGET', colX[7] + proposedWidth / 2, top + 16, { ...headText }, 'center');
    y = top + h1 + h2;
  };

  const startPage = () => {
    if (page > 0) {
      drawFooter();
      recipe.endPage();
    }
    recipe.createPage(pageWidth, pageHeight);
    page += 1;
    onPageCreated();

    y = MARGIN - 6;
    if (page === 1) {
      if (logoPath) {
        try { recipe.image(logoPath, MARGIN, y, { width: 46, height: 46 }); } catch (_) { /* logo is optional */ }
      }
      const cx = pageWidth / 2;
      write('NATIONAL IRRIGATION ADMINISTRATION', cx, y, { size: 13, bold: true, color: COLORS.text}, 'center');
      write(`TIER BUDGET PROPOSAL REPORT  ·  FY ${fiscalYear || 'ALL'}`, cx, y + 17, { size: 11, bold: true, color: COLORS.headerFill}, 'center');
      write(
        `Region: ${regionDisplay}     Department: ${departmentDisplay}     Division: ${divisionDisplay}`,
        cx, y + 33, { size: 8.5, color: COLORS.text }, 'center'
      );
      const generated = generatedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
      write(`Version: ${versionDisplay}     Generated: ${generated}     Amounts in Philippine Pesos`, cx, y + 45, {
        size: 7.5, color: COLORS.muted,
      }, 'center');
      y += 62;
    } else {
      write(`TIER BUDGET PROPOSAL REPORT  ·  FY ${fiscalYear || 'ALL'}  ·  ${regionDisplay} (continued)`, MARGIN, y, {
        size: 8.5, bold: true, color: COLORS.headerFill,
      });
      y += 14;
    }
    drawTableHeader();
  };

  const wrap = (text, maxWidth, size) => {
    const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.5)));
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const drawRow = (row) => {
    const isSection = row.kind === 'section';
    const isGrand = row.kind === 'grand';
    const isSubtotal = row.kind === 'subtotal';
    const bold = isSection || isGrand || isSubtotal || row.kind === 'heading' || row.bold;
    const size = isSection ? 8.6 : FONT;
    const indent = 6 + (row.indent || 0) * 10;
    const lines = wrap(row.label, particularsWidth - indent - 6, size);
    const height = Math.max(lines.length * LINE + 5, isSection || isGrand ? 17 : 14);

    if (y + height > pageHeight - FOOTER_SPACE) startPage();
    const top = y;

    if (isSection) recipe.rectangle(MARGIN, top, tableWidth, height, { fill: COLORS.sectionFill });
    if (isSubtotal) recipe.rectangle(MARGIN, top, tableWidth, height, { fill: COLORS.subtotalFill });
    if (isGrand) recipe.rectangle(MARGIN, top, tableWidth, height, { fill: COLORS.grandFill });

    const color = isGrand ? COLORS.headerText : COLORS.text;
    const textTop = top + (height - lines.length * LINE) / 2 + 1;
    lines.forEach((line, i) => {
      write(line, MARGIN + indent, textTop + i * LINE, { size, bold, italic: !!row.italic, color });
    });

    if (Array.isArray(row.values)) {
      row.values.forEach((value, i) => {
        const text = formatAmount(value);
        if (!text) return;
        const right = colX[i + 1] + colWidths[i + 1] - 6;
        write(text, right, top + (height - LINE) / 2 + 1, {
          size: FONT, bold: bold || i === 6, color,
        }, 'right');
      });
    }

    // Grid: full-width section rows only get outer borders.
    vline(MARGIN, top, height);
    vline(tableRight - 0.5, top, height);
    if (!isSection) {
      colX.slice(1).forEach((x, i) => vline(x, top, height, i % 2 === 0 ? COLORS.strongBorder : COLORS.border, i % 2 === 0 ? 0.6 : 0.4));
    }
    if (isSubtotal || isGrand) hline(top, COLORS.strongBorder, 0.8);
    hline(top + height, isGrand ? COLORS.strongBorder : COLORS.border, isGrand ? 0.8 : 0.5);
    y = top + height;
  };

  startPage();
  buildTierScopeRows(reportSummary).forEach(drawRow);
  drawFooter();
};

module.exports = {
  buildTierScopeRows,
  renderTierScopePdf,
  formatAmount,
};
