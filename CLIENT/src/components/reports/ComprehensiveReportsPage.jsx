import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  alpha,
  Stack,
  Avatar,
  Tooltip,
} from "@mui/material";
import {
  AccountBalance,
  Group,
  Business,
  Construction,
  Category,
  AttachMoney,
  Assessment,
  FileDownload,
  Summarize,
} from "@mui/icons-material";
import api from "../../config/api";
import {
  PDFDownloadLink,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';

// ====================================================================================
// START: PDF REPORTING SECTION (This part is correct and remains the same)
// ====================================================================================

const pdfTheme = {
  colors: {
    primary: '#1976d2',
    secondary: '#5e35b1',
    textPrimary: '#212121',
    textSecondary: '#757575',
    background: '#ffffff',
    tableHeaderBg: '#1976d2',
    tableHeaderText: '#ffffff',
    rowOdd: '#f8f9fa',
    success: '#28a745',
  },
  fontSizes: { xs: 8, s: 10, m: 12, l: 16, xl: 20 },
  spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 20 },
};

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Roboto-Italic.ttf', fontStyle: 'italic' },
  ],
});

const pdfStyles = StyleSheet.create({
  page: { 
    padding: pdfTheme.spacing.xl, 
    fontFamily: 'Roboto', 
    fontSize: pdfTheme.fontSizes.s, 
    backgroundColor: pdfTheme.colors.background, 
    color: pdfTheme.colors.textPrimary 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: pdfTheme.spacing.l, 
    paddingBottom: pdfTheme.spacing.s, 
    borderBottom: `2px solid ${pdfTheme.colors.primary}` 
  },
  logo: { width: 45, height: 45 },
  headerText: { textAlign: 'right' },
  reportTitle: { 
    fontSize: pdfTheme.fontSizes.l, 
    fontWeight: 'bold', 
    color: pdfTheme.colors.primary 
  },
  footer: { 
    position: 'absolute', 
    bottom: pdfTheme.spacing.m, 
    left: pdfTheme.spacing.xl, 
    right: pdfTheme.spacing.xl, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    fontSize: pdfTheme.fontSizes.xs, 
    color: pdfTheme.colors.textSecondary, 
    borderTop: `1px solid ${pdfTheme.colors.textSecondary}`, 
    paddingTop: pdfTheme.spacing.xs 
  },
  summaryBox: { 
    backgroundColor: '#f5f5f5', 
    border: `2px solid ${pdfTheme.colors.primary}`, 
    borderRadius: 5, 
    padding: pdfTheme.spacing.m, 
    marginVertical: pdfTheme.spacing.l 
  },
  summaryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: pdfTheme.spacing.xs,
    paddingVertical: 2
  },
  summaryLabel: { 
    color: pdfTheme.colors.textSecondary,
    fontSize: pdfTheme.fontSizes.s
  },
  summaryValue: { 
    fontWeight: 'bold',
    fontSize: pdfTheme.fontSizes.s
  },
  grandTotal: { 
    fontSize: pdfTheme.fontSizes.l, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: pdfTheme.colors.success, 
    marginTop: pdfTheme.spacing.s,
    padding: pdfTheme.spacing.xs,
    backgroundColor: '#e8f5e8',
    borderRadius: 3
  },
  table: { 
    width: '100%', 
    border: `2px solid #e0e0e0`, 
    borderRadius: 5, 
    overflow: 'hidden', 
    marginBottom: pdfTheme.spacing.l 
  },
  tableHeader: { 
    flexDirection: 'row', 
    backgroundColor: pdfTheme.colors.tableHeaderBg, 
    color: pdfTheme.colors.tableHeaderText, 
    padding: pdfTheme.spacing.s, 
    fontWeight: 'bold',
    fontSize: pdfTheme.fontSizes.s,
    minHeight: 25
  },
  tableRow: { 
    flexDirection: 'row', 
    borderBottom: `1px solid #e0e0e0`, 
    padding: pdfTheme.spacing.s,
    minHeight: 20
  },
  tableRowOdd: { backgroundColor: pdfTheme.colors.rowOdd },
  tableCell: { 
    padding: pdfTheme.spacing.xs, 
    fontSize: pdfTheme.fontSizes.s,
    flexWrap: 'wrap',
    wordWrap: 'break-word'
  },
  subItemCell: { 
    paddingLeft: pdfTheme.spacing.l, 
    fontStyle: 'italic', 
    color: pdfTheme.colors.textSecondary, 
    fontSize: pdfTheme.fontSizes.xs,
    flexWrap: 'wrap'
  },
  sectionTitle: { 
    fontSize: pdfTheme.fontSizes.l, 
    fontWeight: 'bold', 
    color: pdfTheme.colors.secondary, 
    marginBottom: pdfTheme.spacing.s, 
    marginTop: pdfTheme.spacing.l,
    paddingBottom: pdfTheme.spacing.xs,
    borderBottom: `1px solid ${pdfTheme.colors.secondary}`
  },
  sectionSubText: { 
    fontSize: pdfTheme.fontSizes.s, 
    fontStyle: 'italic', 
    color: pdfTheme.colors.textSecondary, 
    marginBottom: pdfTheme.spacing.m 
  },
  sectionTotal: {
    fontSize: pdfTheme.fontSizes.m,
    fontWeight: 'bold',
    color: pdfTheme.colors.primary,
    textAlign: 'right',
    marginTop: pdfTheme.spacing.xs,
    marginBottom: pdfTheme.spacing.m,
    padding: pdfTheme.spacing.xs,
    backgroundColor: '#f0f8ff',
    borderRadius: 3
  },
  totalRow: {
    backgroundColor: '#f8f9fa',
    border: `1px solid ${pdfTheme.colors.primary}`,
    fontWeight: 'bold',
    fontSize: pdfTheme.fontSizes.s
  },
  categoryTotalRow: {
    backgroundColor: '#e3f2fd',
    fontWeight: 'bold',
    fontSize: pdfTheme.fontSizes.xs
  }
});

const formatPDFCurrency = (amount) => {
  const num = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);
};

// Helper function to calculate section totals
const calculateSectionTotal = (section) => {
  if (!section.categories) return 0;
  return Object.values(section.categories).reduce((total, category) => {
    return total + (parseFloat(category.total) || 0);
  }, 0);
};

// Helper function to truncate long text for better PDF layout
const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

const ReportHeader = ({ title, reportData }) => (
  <View style={pdfStyles.header}>
    <Image style={pdfStyles.logo} src="/images/logo_placeholder.png" />
    <View style={pdfStyles.headerText}>
      <Text style={pdfStyles.reportTitle}>{title}</Text>
      <Text>Fiscal Year: {reportData.summary.fiscalYear || 'N/A'}</Text>
      <Text>Budget Type: {reportData.summary.budgetType || 'N/A'}</Text>
    </View>
  </View>
);

const ReportFooter = ({ pageNumber, totalPages, filters }) => (
  <View style={pdfStyles.footer}>
    <Text>Generated: {new Date().toLocaleString('en-PH')} | Region: {filters.region}</Text>
    <Text>Page {pageNumber} of {totalPages} | For Official Use Only</Text>
  </View>
);

const DynamicTable = ({ headers, rows, widths, sectionTotal, showSectionTotal = true }) => {
    const defaultWidth = `${100 / headers.length}%`;
    
    return (
      <View style={pdfStyles.table} wrap={false}>
        {/* Table Header */}
        <View style={pdfStyles.tableHeader}>
          {headers.map((header, i) => (
            <Text key={i} style={{ 
              width: widths ? `${widths[i]}%` : defaultWidth, 
              textAlign: 'center',
              padding: pdfTheme.spacing.xs
            }}>
              {header}
            </Text>
          ))}
        </View>
        
        {/* Table Rows */}
        {rows.map((row, rowIndex) => {
          const isTotal = row.isTotal;
          const isCategoryTotal = row.isCategoryTotal;
          
          return (
            <View key={rowIndex} style={[
              pdfStyles.tableRow, 
              rowIndex % 2 !== 0 && !isTotal && !isCategoryTotal && pdfStyles.tableRowOdd,
              isTotal && pdfStyles.totalRow,
              isCategoryTotal && pdfStyles.categoryTotalRow
            ]}>
              {row.map ? row.map((cell, cellIndex) => {
                const isSubItem = typeof cell === 'object' && cell.isSubItem;
                const content = isSubItem ? cell.content : cell;
                const isNumeric = typeof content === 'string' && content.startsWith('₱');
                
                return (
                  <Text key={cellIndex} style={[
                    pdfStyles.tableCell, 
                    { 
                      width: widths ? `${widths[cellIndex]}%` : defaultWidth,
                      padding: pdfTheme.spacing.xs
                    }, 
                    isSubItem && pdfStyles.subItemCell, 
                    isNumeric && { textAlign: 'right' },
                    (isTotal || isCategoryTotal) && { fontWeight: 'bold' }
                  ]}>
                    {content}
                  </Text>
                );
              }) : null}
            </View>
          );
        })}
        
        {/* Section Total Row */}
        {showSectionTotal && sectionTotal !== null && sectionTotal !== undefined && (
          <View style={[pdfStyles.tableRow, pdfStyles.totalRow]}>
            {headers.length === 5 ? (
              // For 5-column tables (with Income, Subsidy, Amount)
              <>
                <Text style={[pdfStyles.tableCell, { width: `${widths[0] + widths[1]}%`, fontWeight: 'bold', textAlign: 'right', padding: pdfTheme.spacing.xs }]}>
                  SECTION TOTAL:
                </Text>
                <Text style={[pdfStyles.tableCell, { width: `${widths[2]}%`, textAlign: 'right', fontWeight: 'bold', color: pdfTheme.colors.success, padding: pdfTheme.spacing.xs }]}>
                  {formatPDFCurrency(sectionTotal.income || 0)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: `${widths[3]}%`, textAlign: 'right', fontWeight: 'bold', color: pdfTheme.colors.success, padding: pdfTheme.spacing.xs }]}>
                  {formatPDFCurrency(sectionTotal.subsidy || 0)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: `${widths[4]}%`, textAlign: 'right', fontWeight: 'bold', color: pdfTheme.colors.success, padding: pdfTheme.spacing.xs }]}>
                  {formatPDFCurrency((sectionTotal.income || 0) + (sectionTotal.subsidy || 0))}
                </Text>
              </>
            ) : (
              // For 3-column tables (Category, Description, Amount)
              <>
                <Text style={[
                  pdfStyles.tableCell, 
                  { 
                    width: widths && widths.length > 2 ? 
                      `${widths.slice(0, -1).reduce((a, b) => a + b, 0)}%` : 
                      `${100 - (widths ? widths[widths.length - 1] : 100 / headers.length)}%`,
                    fontWeight: 'bold',
                    textAlign: 'right',
                    padding: pdfTheme.spacing.xs
                  }
                ]}>
                  SECTION TOTAL:
                </Text>
                <Text style={[
                  pdfStyles.tableCell, 
                  { 
                    width: widths ? `${widths[widths.length - 1]}%` : `${100 / headers.length}%`,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: pdfTheme.colors.success,
                    padding: pdfTheme.spacing.xs
                  }
                ]}>
                  {formatPDFCurrency(typeof sectionTotal === 'number' ? sectionTotal : sectionTotal.total || 0)}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    );
};

const PDFReport = ({ reportData, filters }) => {
  if (!reportData || !reportData.summary) return null;
  
  // Debug: Check if A.2 exists in PDF
  if (reportData.sections?.find(s => s.sectionCode === "A.2")) {
  }
  
  const sectionsPerPage = 1; // Reduced to 1 section per page for better layout
  const sectionPages = [];
  if (reportData.sections?.length) {
    for (let i = 0; i < reportData.sections.length; i += sectionsPerPage) {
      sectionPages.push(reportData.sections.slice(i, i + sectionsPerPage));
    }
  }
  const totalPages = 1 + sectionPages.length;
  
  // Calculate overall totals by column type
  const overallTotals = reportData.sections?.reduce((acc, section) => {
    const sectionTotal = calculateSectionTotal(section);
    let sectionIncome = 0;
    let sectionSubsidy = 0;
    
    // Calculate income and subsidy totals for each section
    if (section.sectionCode === "A.2") {
      // BUDGETARY SUPPORT - only subsidy, no income
      sectionSubsidy = sectionTotal;
    } else {
      // Other sections - check for both income and subsidy
      Object.values(section.categories || {}).forEach(category => {
        sectionIncome += parseFloat(category.totalIncome || 0);
        sectionSubsidy += parseFloat(category.totalSubsidy || 0);
      });
    }
    
    acc.totalIncome += sectionIncome;
    acc.totalSubsidy += sectionSubsidy;
    acc.totalAmount += (sectionIncome + sectionSubsidy);
    
    acc.sections.push({
      code: section.sectionCode,
      name: section.sectionName,
      income: sectionIncome,
      subsidy: sectionSubsidy,
      total: sectionIncome + sectionSubsidy
    });
    return acc;
  }, { totalIncome: 0, totalSubsidy: 0, totalAmount: 0, sections: [] }) || { totalIncome: 0, totalSubsidy: 0, totalAmount: 0, sections: [] };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <ReportHeader title="Comprehensive Budget Report" reportData={reportData} />
        <Text style={pdfStyles.sectionTitle}>Overall Summary</Text>
        <View style={pdfStyles.summaryBox}>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Total Regions:</Text>
            <Text style={pdfStyles.summaryValue}>{reportData.summary.totalRegions || 0}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Total Employees:</Text>
            <Text style={pdfStyles.summaryValue}>{reportData.summary.totalEmployees?.toLocaleString() || 'N/A'}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Total Budget Sections:</Text>
            <Text style={pdfStyles.summaryValue}>{reportData.sections?.length || 0}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Fiscal Year:</Text>
            <Text style={pdfStyles.summaryValue}>{filters.fiscalYear}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Budget Type:</Text>
            <Text style={pdfStyles.summaryValue}>{filters.budgetType}</Text>
          </View>
          
          {/* Column-wise Totals */}
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Total Income:</Text>
            <Text style={pdfStyles.summaryValue}>{formatPDFCurrency(overallTotals.totalIncome)}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryLabel}>Total Subsidy:</Text>
            <Text style={pdfStyles.summaryValue}>{formatPDFCurrency(overallTotals.totalSubsidy)}</Text>
          </View>
          <Text style={pdfStyles.grandTotal}>
            TOTAL AMOUNT: {formatPDFCurrency(overallTotals.totalAmount)}
          </Text>
        </View>
        
        {/* Section Breakdown */}
        {overallTotals.sections.length > 0 && (
          <View>
            <Text style={pdfStyles.sectionTitle}>Section Breakdown</Text>
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={{ width: '15%', padding: pdfTheme.spacing.xs }}>Code</Text>
                <Text style={{ width: '45%', padding: pdfTheme.spacing.xs }}>Section Name</Text>
                <Text style={{ width: '15%', padding: pdfTheme.spacing.xs, textAlign: 'right' }}>Income</Text>
                <Text style={{ width: '15%', padding: pdfTheme.spacing.xs, textAlign: 'right' }}>Subsidy</Text>
                <Text style={{ width: '10%', padding: pdfTheme.spacing.xs, textAlign: 'right' }}>Total</Text>
              </View>
              {overallTotals.sections.map((section, idx) => (
                <View key={idx} style={[pdfStyles.tableRow, idx % 2 !== 0 && pdfStyles.tableRowOdd]}>
                  <Text style={[pdfStyles.tableCell, { width: '15%' }]}>{section.code}</Text>
                  <Text style={[pdfStyles.tableCell, { width: '45%' }]}>{truncateText(section.name, 35)}</Text>
                  <Text style={[pdfStyles.tableCell, { width: '15%', textAlign: 'right' }]}>{formatPDFCurrency(section.income)}</Text>
                  <Text style={[pdfStyles.tableCell, { width: '15%', textAlign: 'right' }]}>{formatPDFCurrency(section.subsidy)}</Text>
                  <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'right' }]}>{formatPDFCurrency(section.total)}</Text>
                </View>
              ))}
              <View style={[pdfStyles.tableRow, pdfStyles.totalRow]}>
                <Text style={[pdfStyles.tableCell, { width: '60%', textAlign: 'right', fontWeight: 'bold' }]}>TOTAL:</Text>
                <Text style={[pdfStyles.tableCell, { width: '15%', textAlign: 'right', fontWeight: 'bold', color: pdfTheme.colors.success }]}>
                  {formatPDFCurrency(overallTotals.totalIncome)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: '15%', textAlign: 'right', fontWeight: 'bold', color: pdfTheme.colors.success }]}>
                  {formatPDFCurrency(overallTotals.totalSubsidy)}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'right', fontWeight: 'bold', color: pdfTheme.colors.success }]}>
                  {formatPDFCurrency(overallTotals.totalAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}
        <ReportFooter pageNumber={1} totalPages={totalPages} filters={filters} />
      </Page>
      {sectionPages.map((pageSections, pageIndex) => (
        <Page key={pageIndex + 1} size="A4" style={pdfStyles.page}>
          <ReportHeader title="Report Details" reportData={reportData} />
          {pageSections.map((section) => {
            let headers, widths, rows;
            const isIncomeSection = section.sectionCode === "A.1";
            const isBudgetarySupport = section.sectionCode === "A.2";
            const isDetailedExpense = section.sectionCode === "B.1.2" || section.sectionCode === "B.2";
            const isMooE = section.sectionCode === "B.1.2";

            // Calculate proper section totals based on section type
            let sectionTotal;
            if (isBudgetarySupport) {
              // For BUDGETARY SUPPORT - only subsidy amounts
              sectionTotal = calculateSectionTotal(section);
            } else if (isDetailedExpense) {
              // For sections with Income/Subsidy columns
              let totalIncome = 0;
              let totalSubsidy = 0;
              Object.values(section.categories || {}).forEach(category => {
                totalIncome += parseFloat(category.totalIncome || 0);
                totalSubsidy += parseFloat(category.totalSubsidy || 0);
              });
              sectionTotal = {
                income: totalIncome,
                subsidy: totalSubsidy,
                total: totalIncome + totalSubsidy
              };
            } else {
              // For simple sections with just Amount column
              sectionTotal = calculateSectionTotal(section);
            }
            
            if (isIncomeSection) {
              headers = ["Income Category", "Description", "Amount"];
              widths = [40, 35, 25];
              rows = Object.values(section.categories || {}).map(catData => [
                truncateText(catData.name || 'N/A', 30), 
                truncateText(catData.description || '-', 40), 
                formatPDFCurrency(catData.total)
              ]);
            } else if (isBudgetarySupport) {
              headers = ["Category", "Description", "Amount"];
              widths = [40, 35, 25];
              rows = [];
              
              Object.values(section.categories || {}).forEach(catData => {
                // Main category row for budgetary support (only subsidy, no income)
                const mainRow = [
                  truncateText(catData.name || 'N/A', 30), 
                  truncateText(catData.description || '-', 40), 
                  formatPDFCurrency(catData.totalSubsidy || catData.total || 0)
                ];
                rows.push(mainRow);
                
                // Sub-items for budgetary support
                let itemsArray = Array.isArray(catData.items) ? catData.items : (catData.items ? Object.values(catData.items) : []);
                
                itemsArray.forEach(item => {
                  const subRow = [
                    { content: `  • ${truncateText(item?.name || 'Sub-item', 25)}`, isSubItem: true }, 
                    truncateText(item?.description || '-', 35), 
                    formatPDFCurrency(item?.subsidy || item?.amount || 0)
                  ];
                  rows.push(subRow);
                });
                
                // Add spacing row between categories
                if (itemsArray.length > 0) {
                  const spacingRow = ['', '', ''];
                  spacingRow.isCategoryTotal = true;
                  rows.push(spacingRow);
                }
              });
            } else if (isDetailedExpense) {
              headers = ["Category", "Description", "Income", "Subsidy", "Amount"];
              widths = [30, 25, 15, 15, 15];
              rows = [];
              
              Object.values(section.categories || {}).forEach(catData => {
                // Main category row with better formatting
                const mainRow = [
                  truncateText(catData.name || 'N/A', 25), 
                  truncateText(catData.description || '-', 30), 
                  formatPDFCurrency(catData.totalIncome || 0), 
                  formatPDFCurrency(catData.totalSubsidy || 0), 
                  formatPDFCurrency(catData.total || 0)
                ];
                rows.push(mainRow);
                
                // Sub-items with proper formatting
                let itemsArray = Array.isArray(catData.items) ? catData.items : (catData.items ? Object.values(catData.items) : []);
                if (isMooE) { itemsArray = itemsArray.filter(item => item && item.amount > 0); }
                
                itemsArray.forEach(item => {
                  const subRow = [
                    { content: `  • ${truncateText(item?.name || 'Sub-item', 20)}`, isSubItem: true }, 
                    truncateText(item?.description || '-', 25), 
                    formatPDFCurrency(item?.income || 0), 
                    formatPDFCurrency(item?.subsidy || 0), 
                    formatPDFCurrency(item?.amount || 0)
                  ];
                  rows.push(subRow);
                });
                
                // Add spacing row between categories
                if (itemsArray.length > 0) {
                  const spacingRow = ['', '', '', '', ''];
                  spacingRow.isCategoryTotal = true;
                  rows.push(spacingRow);
                }
              });
            } else {
              headers = ["Category", "Description", "Amount"];
              widths = [40, 35, 25];
              rows = [];
              
              Object.values(section.categories || {}).forEach(catData => {
                // Main category row
                const mainRow = [
                  truncateText(catData.name || 'N/A', 30), 
                  truncateText(catData.description || '-', 40), 
                  formatPDFCurrency(catData.total || 0)
                ];
                rows.push(mainRow);
                
                // Sub-items
                const itemsArray = Array.isArray(catData.items) ? catData.items : (catData.items ? Object.values(catData.items) : []);
                itemsArray.forEach(item => {
                  const subRow = [
                    { content: `  • ${truncateText(item?.name || 'Sub-item', 25)}`, isSubItem: true }, 
                    truncateText(item?.description || '-', 35), 
                    formatPDFCurrency(item?.amount || 0)
                  ];
                  rows.push(subRow);
                });
                
                // Add spacing row between categories if there are sub-items
                if (itemsArray.length > 0) {
                  const spacingRow = ['', '', ''];
                  spacingRow.isCategoryTotal = true;
                  rows.push(spacingRow);
                }
              });
            }
            
            return (
              <View key={section.sectionCode} break={section.sectionCode !== pageSections[0].sectionCode}>
                <Text style={pdfStyles.sectionTitle}>
                  {`${section.sectionCode} - ${section.sectionName}`}
                </Text>
                {section.sectionDescription && (
                  <Text style={pdfStyles.sectionSubText}>
                    {section.sectionDescription}
                  </Text>
                )}
                <DynamicTable 
                  headers={headers} 
                  rows={rows} 
                  widths={widths} 
                  sectionTotal={sectionTotal}
                  showSectionTotal={true}
                />
              </View>
            );
          })}
          <ReportFooter pageNumber={pageIndex + 2} totalPages={totalPages} filters={filters} />
        </Page>
      ))}
    </Document>
  );
};
// ====================================================================================
// END: PDF REPORTING SECTION
// ====================================================================================

const ComprehensiveReportsPage = () => {
  const theme = useTheme();
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [availableBudgetTypes, setAvailableBudgetTypes] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedBudgetType, setSelectedBudgetType] = useState("");

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [regionsResponse, fiscalYearsResponse, budgetTypesResponse, activeSettingsResponse] = await Promise.all([
          api.get("/api/comprehensive-reports/available-regions-comprehensive"),
          api.get("/api/comprehensive-reports/available-fiscal-years"),
          api.get("/api/comprehensive-reports/available-budget-types"),
          api.get("/api/comprehensive-reports/active-settings"),
        ]);
        setAvailableRegions(regionsResponse.data.regions || []);
        setAvailableFiscalYears(fiscalYearsResponse.data.fiscalYears || []);
        setAvailableBudgetTypes(budgetTypesResponse.data.budgetTypes || []);
        if (activeSettingsResponse.data.settings) {
          const { fiscalYear, budgetType } = activeSettingsResponse.data.settings;
          setSelectedFiscalYear(fiscalYear || "");
          setSelectedBudgetType(budgetType || "");
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError(err.response?.data?.message || "Failed to load initial data.");
      } finally {
        setLoadingInitialData(false);
      }
    };
    fetchInitialData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fiscalYear: selectedFiscalYear, budgetType: selectedBudgetType });
      if (selectedRegion && selectedRegion !== "all") params.append("regions", selectedRegion);
      const response = await api.get(`/api/comprehensive-reports/comprehensive-data?${params}`);
      const data = response.data.data;
      
      // Debug: Check if A.2 was added and log data structure
      if (data.sections?.find(s => s.sectionCode === "A.2")) {
      }
      
      // Debug: Log sample of data structure to understand subsidy fields
      if (data.sections && data.sections.length > 0) {
        // Check first section
        const sampleSection = data.sections[0];
        if (sampleSection.categories) {
          const sampleCategory = Object.values(sampleSection.categories)[0];
        }
        
        // Specifically check Capital Outlay (B.2) structure if it exists
        const capitalOutlaySection = data.sections.find(s => s.sectionCode === "B.2");
        if (capitalOutlaySection && capitalOutlaySection.categories) {
          const capitalCategory = Object.values(capitalOutlaySection.categories)[0];
          
          // Check a sample item from Capital Outlay
          if (capitalCategory.items) {
            const itemsArray = Array.isArray(capitalCategory.items) ? capitalCategory.items : Object.values(capitalCategory.items);
            if (itemsArray.length > 0) {
            }
          }
        }
      }
      
      // Calculate and add A.2 - BUDGETARY SUPPORT section if it doesn't exist
      if (data.sections && !data.sections.find(s => s.sectionCode === "A.2")) {
        // Calculate total subsidies from all existing sections
        let totalSubsidyFromAllSections = 0;
        let subsidyBreakdown = [];
        
        data.sections.forEach(section => {
          
          // Personnel Services (B.1.1) - ENTIRE AMOUNT IS GOVERNMENT SUBSIDY
          if (section.sectionCode === "B.1.1") {
            const personnelTotal = parseFloat(section.sectionTotal || 0);
            if (personnelTotal > 0) {
              totalSubsidyFromAllSections += personnelTotal;
              subsidyBreakdown.push({
                name: `${section.sectionCode} - Personnel Services`,
                description: `Government funding for all personnel services`,
                income: 0,
                subsidy: personnelTotal,
                amount: personnelTotal
              });
            }
          }
          
          // Capital Outlay (B.2) - ENTIRE AMOUNT IS TYPICALLY GOVERNMENT FUNDED
          else if (section.sectionCode === "B.2") {
            const capitalTotal = parseFloat(section.sectionTotal || 0);
            if (capitalTotal > 0) {
              totalSubsidyFromAllSections += capitalTotal;
              subsidyBreakdown.push({
                name: `${section.sectionCode} - Capital Outlay`,
                description: `Government funding for capital expenditures`,
                income: 0,
                subsidy: capitalTotal,
                amount: capitalTotal
              });
            }
          }
          
          // For other sections, check for specific subsidy fields
          else if (section.categories) {
            Object.values(section.categories).forEach(category => {
              // Check multiple possible subsidy fields
              const subsidyAmount = parseFloat(
                category.totalSubsidy || 
                category.subsidy || 
                category.governmentSubsidy || 
                category.nationalSubsidy ||
                category.capitalSubsidy ||
                category.budgetarySupport ||
                0
              );

              if (subsidyAmount > 0) {
                totalSubsidyFromAllSections += subsidyAmount;
                subsidyBreakdown.push({
                  name: `${section.sectionCode} - ${category.name}`,
                  description: `Subsidy from ${category.description || section.sectionName}`,
                  income: 0,
                  subsidy: subsidyAmount,
                  amount: subsidyAmount
                });
              }
              
              // Also check items within categories for subsidies
              if (category.items) {
                const itemsArray = Array.isArray(category.items) ? category.items : Object.values(category.items);
                itemsArray.forEach(item => {
                  const itemSubsidy = parseFloat(
                    item.subsidy || 
                    item.governmentSubsidy || 
                    item.nationalSubsidy ||
                    item.capitalSubsidy ||
                    item.budgetarySupport ||
                    0
                  );
                  
                  if (itemSubsidy > 0) {
                    totalSubsidyFromAllSections += itemSubsidy;
                    subsidyBreakdown.push({
                      name: `${section.sectionCode} - ${item.name}`,
                      description: `Item subsidy: ${item.description || item.name}`,
                      income: 0,
                      subsidy: itemSubsidy,
                      amount: itemSubsidy
                    });
                  }
                });
              }
            });
          }
        });
        
        // If no subsidies found in existing sections, check alternative sources
        if (totalSubsidyFromAllSections === 0) {
          
          // Check if the API response has direct subsidy information
          if (data.summary && data.summary.totalSubsidy && data.summary.totalSubsidy > 0) {
            totalSubsidyFromAllSections = data.summary.totalSubsidy;
            subsidyBreakdown = [
              {
                name: "Consolidated Regional Subsidies",
                description: "Total government subsidies across all regions",
                income: 0,
                subsidy: totalSubsidyFromAllSections,
                amount: totalSubsidyFromAllSections
              }
            ];
          }
          // Check if we can extract from other summary fields
          else if (data.summary && (data.summary.budgetarySupport || data.summary.governmentSubsidy)) {
            const summarySubsidy = data.summary.budgetarySupport || data.summary.governmentSubsidy;
            totalSubsidyFromAllSections = parseFloat(summarySubsidy);
            subsidyBreakdown = [
              {
                name: "Government Budgetary Support",
                description: "Total budgetary support from government sources",
                income: 0,
                subsidy: totalSubsidyFromAllSections,
                amount: totalSubsidyFromAllSections
              }
            ];
          }
          // If still no subsidies, log the sections we have for debugging
          else {
          }
        }
        
        // Only add A.2 section if there are actual subsidies
        if (totalSubsidyFromAllSections > 0) {
          const budgetarySupportSection = {
            sectionCode: "A.2",
            sectionName: "BUDGETARY SUPPORT",
            sectionDescription: "Government subsidies and budgetary support allocations from all regions",
            sectionTotal: totalSubsidyFromAllSections,
            consolidatedData: true,
                categories: {
                  "government_subsidies": {
                    name: "Government Subsidies & Support",
                    description: "Total government funding across all budget categories",
                    totalSubsidy: totalSubsidyFromAllSections,
                    total: totalSubsidyFromAllSections
                  }
                }
          };
          
          // Insert A.2 after A.1
          const a1Index = data.sections.findIndex(s => s.sectionCode === "A.1");
          if (a1Index >= 0) {
            data.sections.splice(a1Index + 1, 0, budgetarySupportSection);
          } else {
            data.sections.unshift(budgetarySupportSection);
          }
          
        } else {
          // Debug: Log what sections we checked
        }
      }
      
      setReportData(data);
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError(err.response?.data?.message || "Failed to fetch report data.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount || 0);
  };

  const getSectionIcon = (sectionCode) => {
    switch (sectionCode) {
      case "A.1": return <AccountBalance />;
      case "A.2": return <AttachMoney />;
      case "B.1.1": return <Group />;
      case "B.1.2": return <Business />;
      case "B.2": return <Construction />;
      default: return <Category />;
    }
  };

  const getReportFilters = () => ({
    region: selectedRegion === 'all' ? 'All' : selectedRegion,
    fiscalYear: selectedFiscalYear,
    budgetType: selectedBudgetType,
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* --- UI CONTROLS (Header, Filters, Buttons) --- */}
      <Paper elevation={3} sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`, color: "white", borderRadius: "16px" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={2}><Avatar sx={{ bgcolor: alpha("#fff", 0.2), color: "white", width: 56, height: 56 }}><Assessment fontSize="large" /></Avatar><Box><Typography variant="h4" fontWeight="bold">Comprehensive Budget Report</Typography><Typography variant="h6" sx={{ opacity: 0.9 }}>Detailed budget analysis</Typography></Box></Stack>
        </Stack>
      </Paper>
      <Card elevation={4} sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 3 }}>
          {loadingInitialData && <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><CircularProgress /></Box>}
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}><FormControl fullWidth><InputLabel>Region</InputLabel><Select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} label="Region"><MenuItem value="all">All Regions</MenuItem>{availableRegions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Fiscal Year</InputLabel><Select value={selectedFiscalYear} onChange={(e) => setSelectedFiscalYear(e.target.value)} label="Fiscal Year">{availableFiscalYears.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth><InputLabel>Budget Type</InputLabel><Select value={selectedBudgetType} onChange={(e) => setSelectedBudgetType(e.target.value)} label="Budget Type">{availableBudgetTypes.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12} sm={6} md={2}><Button variant="contained" fullWidth onClick={fetchReportData} disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <Summarize />} sx={{ py: 1.5 }}>{loading ? "Generating..." : "Generate"}</Button></Grid>
            {reportData && (<Grid item xs={12} sm={12} md={3}><PDFDownloadLink document={<PDFReport reportData={reportData} filters={getReportFilters()} />} fileName={`Comprehensive_Report_${selectedFiscalYear}_${selectedBudgetType}.pdf`} style={{ textDecoration: 'none' }}>{({ loading: pdfLoading }) => (<Button variant="contained" color="secondary" fullWidth disabled={pdfLoading} startIcon={pdfLoading ? <CircularProgress size={20} /> : <FileDownload />} sx={{ py: 1.5 }}>{pdfLoading ? "Creating PDF..." : "Export to PDF"}</Button>)}</PDFDownloadLink></Grid>)}
          </Grid>
        </CardContent>
      </Card>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {reportData && (
        <Box>
          {/* ================================================================= */}
          {/* START OF UI FIX: Pinag-isang Table para sa MOOE at Capital Outlays */}
          {/* ================================================================= */}
          {reportData.sections.map((section) => {
            const isIncomeSection = section.sectionCode === "A.1";
            const isBudgetarySupport = section.sectionCode === "A.2";
            const isDetailedExpense = section.sectionCode === "B.1.2" || section.sectionCode === "B.2";
            const isMooE = section.sectionCode === "B.1.2";

            return (
              <Paper key={section.sectionCode} elevation={2} sx={{ mb: 3, p: { xs: 2, md: 3 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderBottom: 1, borderColor: 'divider', pb: 2, mb: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    {getSectionIcon(section.sectionCode)}
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        {section.sectionCode} - {section.sectionName}
                        {section.sectionCode === "A.2" && <Chip size="small" label="NEW" color="success" sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{section.sectionDescription}</Typography>
                    </Box>
                  </Stack>
                  <Chip label={formatCurrency(section.sectionTotal)} color="primary" />
                </Stack>
                
                {section.consolidatedData && (() => {
                  if (isIncomeSection) {
                    return (
                      <List>
                        {Object.values(section.categories || {}).map((catData, idx) => (
                          <ListItem key={idx} divider>
                            <ListItemText primary={catData.name} secondary={catData.description} />
                            <Typography variant="body1" fontWeight="bold">{formatCurrency(catData.total)}</Typography>
                          </ListItem>
                        ))}
                      </List>
                    );
                  } 
                  
                  // Handle BUDGETARY SUPPORT section (A.2)
                  else if (isBudgetarySupport) {
                    // Show only a single total row for Budgetary Support (A.2)
                    const mainCategory = Object.values(section.categories || {})[0] || {};
                    return (
                      <Stack>
                        <Stack direction="row" sx={{ borderBottom: 2, borderColor: 'primary.main', pb: 1, mb: 1, fontWeight: 'bold' }}>
                          <Typography sx={{ width: '40%' }}>Category</Typography>
                          <Typography sx={{ width: '35%' }}>Description</Typography>
                          <Typography sx={{ width: '25%', textAlign: 'right' }}>Amount</Typography>
                        </Stack>
                        <Stack direction="row" sx={{ py: 1, fontWeight: 'bold', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                          <Typography sx={{ width: '40%' }}>{mainCategory.name || 'Budgetary Support'}</Typography>
                          <Typography sx={{ width: '35%' }}>{mainCategory.description || 'Total government funding across all budget categories'}</Typography>
                          <Typography sx={{ width: '25%', textAlign: 'right' }}>{formatCurrency(mainCategory.totalSubsidy || mainCategory.total || section.sectionTotal || 0)}</Typography>
                        </Stack>
                      </Stack>
                    );
                  }
                  
                  // FIX: Pinag-isang table para sa MOOE at Capital Outlays
                  else if (isDetailedExpense) {
                    // Step 1: I-proseso at i-flat ang data para maging isang listahan ng rows.
                    const allRows = [];
                    Object.values(section.categories || {}).forEach(catData => {
                      // Add category row
                      allRows.push({ type: 'category', ...catData });
                      let itemsArray = Array.isArray(catData.items) ? catData.items : (catData.items ? Object.values(catData.items) : []);
                      if (isMooE) { itemsArray = itemsArray.filter(item => item && item.amount > 0); }
                      // Add item rows
                      itemsArray.forEach(item => allRows.push({ type: 'item', ...item }));
                    });

                    return (
                      <Stack>
                        {/* Step 2: I-render ang iisang table header. */}
                        <Stack direction="row" sx={{ borderBottom: 2, borderColor: 'primary.main', pb: 1, mb: 1, fontWeight: 'bold' }}>
                          <Typography sx={{ width: '25%' }}>Category</Typography>
                          <Typography sx={{ width: '25%' }}>Description</Typography>
                          <Typography sx={{ width: '17%', textAlign: 'right' }}>Income</Typography>
                          <Typography sx={{ width: '17%', textAlign: 'right' }}>Subsidy</Typography>
                          <Typography sx={{ width: '16%', textAlign: 'right' }}>Amount</Typography>
                        </Stack>
                        
                        {/* Step 3: I-map ang mga na-prosesong rows */}
                        {allRows.map((row, idx) => {
                          if (row.type === 'category') {
                            return (
                              <Stack key={idx} direction="row" sx={{ py: 1, fontWeight: 'bold', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                <Typography sx={{ width: '50%' }}>{row.name}</Typography>
                                <Typography sx={{ width: '17%', textAlign: 'right' }}>{formatCurrency(row.totalIncome)}</Typography>
                                <Typography sx={{ width: '17%', textAlign: 'right' }}>{formatCurrency(row.totalSubsidy)}</Typography>
                                <Typography sx={{ width: '16%', textAlign: 'right' }}>{formatCurrency(row.total)}</Typography>
                              </Stack>
                            );
                          } else { // row.type === 'item'
                            return (
                              <Stack key={idx} direction="row" sx={{ py: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                                <Typography sx={{ width: '25%', pl: 2, fontStyle: 'italic', color: 'text.secondary' }}></Typography>
                                <Typography variant="body2" sx={{ width: '25%' }}>{row.name}</Typography>
                                <Typography variant="body2" sx={{ width: '17%', textAlign: 'right' }}>{formatCurrency(row.income)}</Typography>
                                <Typography variant="body2" sx={{ width: '17%', textAlign: 'right' }}>{formatCurrency(row.subsidy)}</Typography>
                                <Typography variant="body2" sx={{ width: '16%', textAlign: 'right', fontWeight: 'medium' }}>{formatCurrency(row.amount)}</Typography>
                              </Stack>
                            );
                          }
                        })}
                      </Stack>
                    );
                  } 
                  
                  else {
                    // Default na itsura para sa ibang sections
                    return Object.values(section.categories || {}).map((catData, idx) => (
                      <Box key={idx} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">{catData.name}</Typography>
                        <List dense>
                          {(Array.isArray(catData.items) ? catData.items : Object.values(catData.items || {})).map((item, itemIdx) => (
                            <ListItem key={itemIdx} divider secondaryAction={<Typography variant="body2" fontWeight="bold">{formatCurrency(item.amount)}</Typography>}>
                              <ListItemText primary={item.name} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    ));
                  }
                })()}
              </Paper>
            );
          })}
          {/* ================================================================= */}
          {/* END OF UI FIX                                                   */}
          {/* ================================================================= */}
        </Box>
      )}

      {!reportData && !loading && (
        <Card elevation={0} sx={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'action.hover', color: 'text.secondary', mx: "auto", mb: 3 }}><Assessment sx={{ fontSize: 40 }} /></Avatar>
            <Typography variant="h5" color="text.secondary" fontWeight="bold">Ready to Generate Report</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>Select your criteria and click "Generate" to view the report.</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ComprehensiveReportsPage;