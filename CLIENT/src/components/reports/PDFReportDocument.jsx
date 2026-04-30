import React from 'react';
import { shouldHideGenericOtherUacs, getIndentLevelFromSubline } from '../../utils/uacsDisplayHelper';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E4E4E4',
    padding: 5,
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableHeaderCell: {
    padding: 2,
  },
  row: {
    flexDirection: 'row',
    padding: 3,
    fontSize: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    padding: 5,
    fontWeight: 'bold',
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 5,
  },
  grandTotalRow: {
    flexDirection: 'row',
    padding: 5,
    fontWeight: 'bold',
    borderTopWidth: 2,
    borderTopColor: '#000',
    marginTop: 10,
    fontSize: 11,
  },
});

// Main PDF document component
const PDFReportDocument = ({ fiscalYear, psSummary = {}, mooe = [], co = [], preparedByName, notedByName, approvedByName }) => {
  function formatCurrency(amount, noSign = false) {
    const amountNumber = parseFloat(amount) || 0;
    const formatted = amountNumber.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return noSign ? formatted : "₱ " + formatted;
  }

  // Calculate totals
  const mooeRegularTotal = mooe.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
  
  // Check if iasOMCost exists in the data
  const iasOMCostTotal = (psSummary.iasOMCost ? 
    (parseFloat(psSummary.iasOMCost.nis) || 0) + 
    (parseFloat(psSummary.iasOMCost.cis) || 0) + 
    (parseFloat(psSummary.iasOMCost.nisSubsidy) || 0) + 
    (parseFloat(psSummary.iasOMCost.cisSubsidy) || 0) : 0);
  
  // Total MOOE is regular MOOE plus IAs O&M Cost
  const mooeTotal = mooeRegularTotal + iasOMCostTotal;
  
  const coTotal = co.reduce((total, item) => total + (parseFloat(item.cost) || 0), 0);
  // Use backend-computed totalPersonnelServices (sum of PersonnelServices.Total)
  const psTotal = parseFloat(psSummary.totalPersonnelServices || 0) || 0;
  
  const grandTotal = psTotal + mooeTotal + coTotal;

  // Group CO items by category for better organization
  const groupedCO = co.reduce((acc, item) => {
    // Use the category directly since it's now properly formatted from the server
    const key = item.category || 'Uncategorized';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  const renderSignatories = () => (
    <View style={{ flexDirection: 'row', marginTop: 40, justifyContent: 'space-between', paddingHorizontal: 20 }}>
      <View style={{ width: '30%', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 10, marginBottom: 25 }}>Prepared by:</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', width: '100%', marginBottom: 5 }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>{preparedByName || '________________________'}</Text>
        <Text style={{ fontSize: 9, textAlign: 'center', width: '100%' }}>Budget Preparer</Text>
      </View>
      <View style={{ width: '30%', alignItems: 'center' }}>
        <Text style={{ fontSize: 10, marginBottom: 25, width: '100%', textAlign: 'left' }}>Noted by:</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', width: '100%', marginBottom: 5 }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>{notedByName || '________________________'}</Text>
        <Text style={{ fontSize: 9, textAlign: 'center', width: '100%' }}>Budget Reviewer</Text>
      </View>
      <View style={{ width: '30%', alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, marginBottom: 25, width: '100%', textAlign: 'left' }}>Approved by:</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', width: '100%', marginBottom: 5 }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>{approvedByName || '________________________'}</Text>
        <Text style={{ fontSize: 9, textAlign: 'center', width: '100%' }}>Budget Approver</Text>
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>NATIONAL IRRIGATION ADMINISTRATION</Text>
        <Text style={styles.subtitle}>Budget Proposal for Fiscal Year {fiscalYear}</Text>
        
        {/* Personnel Services Section */}
        <Text style={styles.sectionTitle}>B.1.1 PERSONNEL SERVICES</Text>
        
        {/* PS Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: "70%" }]}>Item</Text>
          <Text style={[styles.tableHeaderCell, { width: "30%", textAlign: "right" }]}>Amount</Text>
        </View>
        
        {/* PS Items */}
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Annual Salary - Permanent</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.annualSalaryPermanent || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Annual Salary - Casual</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.annualSalaryCasual || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>PERA</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.PERA || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>RATA</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.RATA || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Uniform Allowance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.uniformALLOWANCE || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Productivity Incentive</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.productivityIncentive || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Medical Allowance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.medical || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Additional Medical Allowance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.additionalMedical || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Children Allowance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.childrenAllowance || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Meal Allowance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.meal || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Cash Gift</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.cashGift || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Subsistence Allowance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.subsistenceAllowance || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Subsistence Allowance MDS</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.subsistenceAllowanceMDS || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Subsistence Allowance ST</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.subsistenceAllowanceST || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Midyear Bonus</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.midyearBonus || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Year End Bonus</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.yearEndBonus || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Hazard Pay</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.hazardPay || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Honoraria</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.honoraria || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Overtime Pay</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.overtimePay || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Loyalty Award</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.loyaltyAward || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Earned Leaves</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.earnedLeaves || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Retirement Benefits</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.retirementBenefits || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Terminal Leave</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.terminalLeave || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Court Appearance</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.courtAppearance || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>GSIS Premium</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.gsisPremium || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>PhilHealth Premium</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.philhealthPremium || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Pag-IBIG Premium</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.pagibigPremium || 0, true)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ width: "70%" }}>Employee Compensation</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psSummary.employeeCompensation || 0, true)}</Text>
        </View>
        
        {/* PS Total */}
        <View style={styles.totalRow}>
          <Text style={{ width: "70%" }}>Total Personnel Services</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(psTotal, true)}</Text>
        </View>
        
        {/* MOOE Section */}
        <Text style={styles.sectionTitle}>B.1.2 MAINTENANCE AND OTHER OPERATING EXPENSES</Text>
        
        {/* MOOE Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: "15%" }]}>UACS Code</Text>
          <Text style={[styles.tableHeaderCell, { width: "55%" }]}>Accounting Title</Text>
          <Text style={[styles.tableHeaderCell, { width: "30%", textAlign: "right" }]}>Amount</Text>
        </View>
        
        {/* MOOE Items */}
        {mooe.map((item, idx) => {
          const hideGenericUACS = shouldHideGenericOtherUacs(item.uacsCode, item.sublineItem);
          const indentLevel = getIndentLevelFromSubline(item.sublineItem || item.accountingTitle || '', item.uacsCode);
          return (
            <View key={idx} style={styles.row}>
              <Text style={{ width: "15%" }}>{hideGenericUACS ? '' : item.uacsCode}</Text>
              <Text style={{ width: "55%", marginLeft: indentLevel ? 10 : 0 }}>{item.accountingTitle || item.lineItem}</Text>
              <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(item.amount, true)}</Text>
            </View>
          );
        })}
        
        {/* Regular MOOE Total */}
        <View style={styles.row}>
          <Text style={{ width: "70%", fontWeight: "bold" }}>Subtotal Regular MOOE</Text>
          <Text style={{ width: "30%", textAlign: "right", fontWeight: "bold" }}>{formatCurrency(mooeRegularTotal, true)}</Text>
        </View>
        
        {/* IAs O&M Cost Section - only show if data exists */}
        {psSummary.iasOMCost && (
          <>
            <View style={[styles.row, { marginTop: 5 }]}>
              <Text style={{ width: "70%", fontWeight: "bold" }}>IRRIGATORS' ASSOCIATIONS (IAs) OPERATION & MAINTENANCE COST</Text>
              <Text style={{ width: "30%" }}></Text>
            </View>
            
            {/* NIS Row */}
            {(parseFloat(psSummary.iasOMCost.nis) > 0 || parseFloat(psSummary.iasOMCost.nisSubsidy) > 0) && (
              <View style={styles.row}>
                <Text style={{ width: "15%" }}></Text>
                <Text style={{ width: "55%" }}>NIS (National Irrigation System)</Text>
                <Text style={{ width: "30%", textAlign: "right" }}>
                  {formatCurrency(
                    (parseFloat(psSummary.iasOMCost.nis) || 0) + 
                    (parseFloat(psSummary.iasOMCost.nisSubsidy) || 0), 
                    true
                  )}
                </Text>
              </View>
            )}
            
            {/* CIS Row */}
            {(parseFloat(psSummary.iasOMCost.cis) > 0 || parseFloat(psSummary.iasOMCost.cisSubsidy) > 0) && (
              <View style={styles.row}>
                <Text style={{ width: "15%" }}></Text>
                <Text style={{ width: "55%" }}>CIS (Communal Irrigation System)</Text>
                <Text style={{ width: "30%", textAlign: "right" }}>
                  {formatCurrency(
                    (parseFloat(psSummary.iasOMCost.cis) || 0) + 
                    (parseFloat(psSummary.iasOMCost.cisSubsidy) || 0), 
                    true
                  )}
                </Text>
              </View>
            )}
            
            {/* IAs O&M Cost Subtotal */}
            <View style={styles.row}>
              <Text style={{ width: "70%", fontWeight: "bold" }}>Subtotal IAs O&M Cost</Text>
              <Text style={{ width: "30%", textAlign: "right", fontWeight: "bold" }}>{formatCurrency(iasOMCostTotal, true)}</Text>
            </View>
          </>
        )}
        
        {/* MOOE Total */}
        <View style={styles.totalRow}>
          <Text style={{ width: "70%" }}>Total MOOE (Regular + IAs O&M Cost)</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(mooeTotal, true)}</Text>
        </View>
        
        {/* Capital Outlay Section */}
        <Text style={styles.sectionTitle}>B.1.3 CAPITAL OUTLAY</Text>
        
        {/* CO Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: "50%" }]}>Category / Subline Item / Accounting Title</Text>
          <Text style={[styles.tableHeaderCell, { width: "50%", textAlign: "right" }]}>Amount</Text>
        </View>
        
        {/* CO Items - Grouped by category */}
        {Object.entries(groupedCO).map(([category, items], groupIdx) => (
          <View key={groupIdx}>
            <Text style={[styles.boldText, { marginTop: 6 }]}>{category}</Text>
            
            {items.map((item, idx) => (
              <View key={idx}>
                {item.subLineItem && (
                  <Text style={{ width: "100%", marginLeft: 10, fontWeight: "bold", fontSize: 8 }}>
                    {item.subLineItem}
                  </Text>
                )}
                <View style={styles.row}>
                  <Text style={{ width: "50%", marginLeft: item.subLineItem ? 20 : 10 }}>
                    {item.accountingTitle || item.particulars || ""}
                  </Text>
                  <Text style={{ width: "50%", textAlign: "right" }}>
                    {formatCurrency(item.cost, true)}
                  </Text>
                </View>
              </View>
            ))}
            
            {/* Subtotal for this category */}
            <View style={[styles.row, { borderTopWidth: 0.5, borderColor: "#aaa", paddingTop: 2 }]}>
              <Text style={{ width: "50%", fontWeight: "bold", marginLeft: 10 }}>
                Subtotal
              </Text>
              <Text style={{ width: "50%", textAlign: "right", fontWeight: "bold" }}>
                {formatCurrency(
                  items.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0),
                  true
                )}
              </Text>
            </View>
          </View>
        ))}
        
        {/* CO Total */}
        <View style={styles.totalRow}>
          <Text style={{ width: "70%" }}>Total Capital Outlay</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(coTotal, true)}</Text>
        </View>
        
        {/* Grand Total */}
        <View style={styles.grandTotalRow}>
          <Text style={{ width: "70%" }}>GRAND TOTAL</Text>
          <Text style={{ width: "30%", textAlign: "right" }}>{formatCurrency(grandTotal, true)}</Text>
        </View>

        {/* Signatories Area */}
        {renderSignatories()}
      </Page>
    </Document>
  );
};

// Export the component as default
export default PDFReportDocument;
