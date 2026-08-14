import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet 
} from '@react-pdf/renderer';
import { shouldShowDraftWatermark } from '../utils/proposalPdfWatermark';

// Styles for the PDF - optimized for A4 landscape with 4 regions per table
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  watermark: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 70,
    fontWeight: 'bold',
    color: '#e4c8c8',
    transform: 'rotate(-30deg)',
  },
  header: {
    marginBottom: 5,
    textAlign: 'center',
    paddingBottom: 3,
    borderBottom: '1 solid #1976d2',
  },
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 1,
    color: '#1976d2',
  },
  subtitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 1,
    color: '#333',
  },
  metadata: {
    fontSize: 6,
    color: '#666',
    marginBottom: 0,
  },
  section: {
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1976d2',
    backgroundColor: '#f0f8ff',
    padding: 3,
  },
  table: {
    width: '100%',
    border: '1 solid #333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ccc',
  },
  tableHeader: {
    backgroundColor: '#1976d2',
    color: 'white',
    padding: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRight: '1 solid white',
    minHeight: 20,
  },
  tableHeaderName: {
    backgroundColor: '#1976d2',
    color: 'white',
    padding: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'left',
    borderRight: '1 solid white',
    width: '30%',
    minHeight: 20,
  },
  tableCellName: {
    padding: 4,
    fontSize: 8,
    textAlign: 'left',
    borderRight: '1 solid #ccc',
    width: '30%',
    minHeight: 18,
  },
  tableCellAmount: {
    padding: 4,
    fontSize: 8,
    textAlign: 'right',
    borderRight: '1 solid #ccc',
    minHeight: 18,
  },
  categoryRow: {
    backgroundColor: '#f5f5f5',
  },
  subcategoryRow: {
    backgroundColor: '#ffffff',
  },
  totalRow: {
    backgroundColor: '#e8f5e8',
    borderTop: '2 solid #4caf50',
  },
  categoryText: {
    fontWeight: 'bold',
    color: '#333',
  },
  subcategoryText: {
    color: '#666',
    paddingLeft: 10,
  },
  totalText: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  summary: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#f5f5f5',
    border: '1 solid #e0e0e0',
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#1976d2',
  },
  summaryText: {
    fontSize: 8,
    marginBottom: 1,
    color: '#333',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 7,
    bottom: 15,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#666',
  },
});

const formatCurrency = (amount) => {
  const n = Number(amount);
  if (!isFinite(n)) return '₱0.00';
  try {
    return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch (e) {
    return `₱${n.toFixed(2)}`;
  }
};

const ConsolidatedIncomeReportPDF = ({ reportData, activeTab, selectedRegions, showPercentages }) => {
  if (!reportData) return null;
  const showDraftWatermark = shouldShowDraftWatermark({ isFinalized: reportData.isFinalized === true });

  const filteredRegions = reportData.regions.filter(region => 
    selectedRegions === 'all' || selectedRegions === region
  );

  const renderCategoryBreakdown = () => {
    if (!reportData.hierarchicalData) return null;

    // Split regions into groups of 4 per table
    const regionsPerTable = 4;
    const regionGroups = [];
    for (let i = 0; i < filteredRegions.length; i += regionsPerTable) {
      regionGroups.push(filteredRegions.slice(i, i + regionsPerTable));
    }

    return regionGroups.map((regionGroup, groupIndex) => {
      const remainingWidth = 70; // 100% - 30% for name column
      const regionWidth = remainingWidth / (regionGroup.length + 1); // +1 for total column

      return (
        <View 
          key={`group-${groupIndex}`} 
          style={styles.section} 
          break={groupIndex > 0 ? true : undefined}
        >
          <Text style={styles.sectionTitle}>
            Income Category Breakdown {regionGroups.length > 1 ? `(Part ${groupIndex + 1} of ${regionGroups.length})` : ''}
          </Text>
          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.tableRow}>
              <View style={styles.tableHeaderName}>
                <Text>Income Category</Text>
              </View>
              {regionGroup.map((region) => (
                <View key={region} style={[styles.tableHeader, { width: `${regionWidth}%` }]}>
                  <Text>{region}</Text>
                </View>
              ))}
              <View style={[styles.tableHeader, { width: `${regionWidth}%` }]}>
                <Text>Total</Text>
              </View>
            </View>

            {/* Data Rows */}
            {reportData.hierarchicalData.slice(0, 35).map((category) => {
              const categoryTotal = reportData.categoryTotals[category.id] || 0;

              return (
                <View key={category.id} style={[styles.tableRow, styles.categoryRow]}>
                  <View style={styles.tableCellName}>
                    <Text style={styles.categoryText}>
                      {category.name.length > 40 ? category.name.substring(0, 40) + '...' : category.name}
                    </Text>
                  </View>
                  {regionGroup.map((region) => (
                    <View key={`${region}-${category.id}`} style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                      <Text>
                        {formatCurrency(reportData.regionData[region]?.categoryAmounts[category.id] || 0)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                    <Text style={styles.totalText}>
                      {formatCurrency(categoryTotal)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Total Row */}
            <View style={[styles.tableRow, styles.totalRow]}>
              <View style={styles.tableCellName}>
                <Text style={styles.totalText}>GRAND TOTAL</Text>
              </View>
              {regionGroup.map((region) => (
                <View key={`total-${region}`} style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                  <Text style={styles.totalText}>
                    {formatCurrency(reportData.regionData[region]?.total || 0)}
                  </Text>
                </View>
              ))}
              <View style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                <Text style={styles.totalText}>
                  {formatCurrency(reportData.grandTotal)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    });
  };

  const renderSubcategoryTreeView = () => {
    if (!reportData.hierarchicalData) return null;

    const categoriesWithSubcategories = reportData.hierarchicalData.filter(
      category => category.subcategories && category.subcategories.length > 0
    ).slice(0, 12);

    if (categoriesWithSubcategories.length === 0) return null;

    // Split regions into groups of 4 per table
    const regionsPerTable = 4;
    const regionGroups = [];
    for (let i = 0; i < filteredRegions.length; i += regionsPerTable) {
      regionGroups.push(filteredRegions.slice(i, i + regionsPerTable));
    }

    return regionGroups.map((regionGroup, groupIndex) => {
      const remainingWidth = 70;
      const regionWidth = remainingWidth / (regionGroup.length + 1);

      return (
        <View 
          key={`tree-group-${groupIndex}`} 
          style={styles.section} 
          break={groupIndex > 0 ? true : undefined}
        >
          <Text style={styles.sectionTitle}>
            Subcategory Details - Tree View {regionGroups.length > 1 ? `(Part ${groupIndex + 1} of ${regionGroups.length})` : ''}
          </Text>
          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.tableRow}>
              <View style={styles.tableHeaderName}>
                <Text>Category / Subcategory</Text>
              </View>
              {regionGroup.map((region) => (
                <View key={region} style={[styles.tableHeader, { width: `${regionWidth}%` }]}>
                  <Text>{region}</Text>
                </View>
              ))}
              <View style={[styles.tableHeader, { width: `${regionWidth}%` }]}>
                <Text>Total</Text>
              </View>
            </View>

            {/* Tree View Data */}
            {categoriesWithSubcategories
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((category) => {
                const categoryTotal = reportData.categoryTotals[category.id] || 0;

                return (
                  <View key={category.id}>
                    {/* Parent Category Row */}
                    <View style={[styles.tableRow, styles.categoryRow]}>
                      <View style={styles.tableCellName}>
                        <Text style={styles.categoryText}>
                          + {category.name.length > 35 ? category.name.substring(0, 35) + '...' : category.name}
                        </Text>
                      </View>
                      {regionGroup.map((region) => (
                        <View key={`${region}-${category.id}`} style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                          <Text>
                            {formatCurrency(reportData.regionData[region]?.categoryAmounts[category.id] || 0)}
                          </Text>
                        </View>
                      ))}
                      <View style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                        <Text style={styles.totalText}>
                          {formatCurrency(categoryTotal)}
                        </Text>
                      </View>
                    </View>

                    {/* Subcategory Rows */}
                    {category.subcategories
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .slice(0, 6)
                      .map((subcategory) => {
                        const subcategoryTotal = reportData.subcategoryTotals[subcategory.id] || 0;

                        return (
                          <View key={subcategory.id} style={[styles.tableRow, styles.subcategoryRow]}>
                            <View style={styles.tableCellName}>
                              <Text style={styles.subcategoryText}>
                                └─ {subcategory.name.length > 30 ? subcategory.name.substring(0, 30) + '...' : subcategory.name}
                              </Text>
                            </View>
                            {regionGroup.map((region) => (
                              <View key={`${region}-${subcategory.id}`} style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                                <Text>
                                  {formatCurrency(reportData.regionData[region]?.subcategoryAmounts[subcategory.id] || 0)}
                                </Text>
                              </View>
                            ))}
                            <View style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                              <Text>
                                {formatCurrency(subcategoryTotal)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                  </View>
                );
              })}

            {/* Grand Total Row */}
            <View style={[styles.tableRow, styles.totalRow]}>
              <View style={styles.tableCellName}>
                <Text style={styles.totalText}>GRAND TOTAL</Text>
              </View>
              {regionGroup.map((region) => (
                <View key={`total-${region}`} style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                  <Text style={styles.totalText}>
                    {formatCurrency(reportData.regionData[region]?.total || 0)}
                  </Text>
                </View>
              ))}
              <View style={[styles.tableCellAmount, { width: `${regionWidth}%` }]}>
                <Text style={styles.totalText}>
                  {formatCurrency(reportData.grandTotal)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    });
  };

  const renderSummary = () => (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>Report Summary</Text>
      <Text style={styles.summaryText}>
        Total Income Categories: {reportData.hierarchicalData?.length || 0}
      </Text>
      <Text style={styles.summaryText}>
        Total Subcategories: {reportData.hierarchicalData?.reduce((acc, cat) => acc + (cat.subcategories?.length || 0), 0) || 0}
      </Text>
      <Text style={styles.summaryText}>
        Regions Included: {filteredRegions.join(', ')}
      </Text>
      <Text style={styles.summaryText}>
        Grand Total: {formatCurrency(reportData.grandTotal)}
      </Text>
      <Text style={styles.summaryText}>
        Generated: {new Date().toLocaleString()}
      </Text>
    </View>
  );

  const renderSignatories = () => (
    <View style={{ flexDirection: 'row', marginTop: 40, justifyContent: 'space-between', paddingHorizontal: 20 }}>
      <View style={{ width: '30%', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 10, marginBottom: 25 }}>Prepared by:</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', width: '100%', marginBottom: 5 }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>{reportData.preparedByName || '________________________'}</Text>
        <Text style={{ fontSize: 9, textAlign: 'center', width: '100%' }}>Budget Preparer</Text>
      </View>
      <View style={{ width: '30%', alignItems: 'center' }}>
        <Text style={{ fontSize: 10, marginBottom: 25, width: '100%', textAlign: 'left' }}>Noted by:</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', width: '100%', marginBottom: 5 }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>{reportData.notedByName || '________________________'}</Text>
        <Text style={{ fontSize: 9, textAlign: 'center', width: '100%' }}>Budget Reviewer</Text>
      </View>
      <View style={{ width: '30%', alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, marginBottom: 25, width: '100%', textAlign: 'left' }}>Approved by:</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', width: '100%', marginBottom: 5 }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>{reportData.approvedByName || '________________________'}</Text>
        <Text style={{ fontSize: 9, textAlign: 'center', width: '100%' }}>Budget Approver</Text>
      </View>
    </View>
  );

  const getTabName = () => {
    switch (activeTab) {
      case 0: return 'Executive Summary';
      case 1: return 'Category Breakdown';
      case 2: return 'Subcategory Details';
      default: return 'Report';
    }
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {showDraftWatermark && <Text style={styles.watermark} fixed>DRAFT</Text>}
        {/* Header - Compact */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Consolidated Corporate Income Report
          </Text>
          <Text style={styles.subtitle}>
            Fiscal Year {reportData.fiscalYear} - {reportData.budgetType}
          </Text>
          <Text style={styles.metadata}>
            Region: {selectedRegions === 'all' ? 'All Regions' : selectedRegions} | Report Type: {getTabName()}
          </Text>
        </View>

        {/* Main Content Area - Ensure proper flow */}
        <View style={{ flex: 1 }}>
          {activeTab === 1 && renderCategoryBreakdown()}
          {activeTab === 2 && renderSubcategoryTreeView()}
          
          {/* Summary */}
          {renderSummary()}
          {/* Signatories Area */}
          {renderSignatories()}
        </View>

        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default ConsolidatedIncomeReportPDF;
