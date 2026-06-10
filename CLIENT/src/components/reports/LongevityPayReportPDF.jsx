import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

// Styles matching the uploaded image format
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  titleLine: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 5,
    textDecoration: 'underline',
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tableHeaderCell: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeaderCellLast: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCell: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    justifyContent: 'center',
  },
  tableCellLast: {
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    justifyContent: 'center',
  },
  headerTextLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  cellText: {
    fontSize: 8,
  },
  cellTextRight: {
    fontSize: 8,
    textAlign: 'right',
  },
  cellTextCenter: {
    fontSize: 8,
    textAlign: 'center',
  },
  grandTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#000',
  },
  grandTotalLabelCell: {
    flex: 3,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grandTotalAmountCell: {
    flex: 1,
    padding: 5,
    justifyContent: 'center',
  },
  grandTotalText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalAmountText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
});

const formatCurrency = (amount) => {
  const n = Number(amount);
  if (!isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const LongevityPayReportPDF = ({ reportData, fiscalYear, regionName }) => {
  // Extract data from props
  const records = reportData || [];
  
  // Calculate Grand Total
  const grandTotal = records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);

  // Column width proportions
  const colWidths = ['40%', '35%', '10%', '15%'];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header Section */}
        <View style={styles.headerContainer}>
          {/* We would use actual logo images if available. 
              For now, we leave empty views or placeholder text if needed, 
              but since we don't have the explicit paths, we just center the text.
          */}
          <View style={{ width: 60 }}></View> 
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerText}>Republic of the Philippines</Text>
            <Text style={styles.headerText}>OFFICE OF THE PRESIDENT</Text>
            <Text style={styles.headerText}>NATIONAL IRRIGATION ADMINISTRATION</Text>
            <Text style={styles.headerText}>{regionName ? regionName.toUpperCase() : 'REGION/PROJECT'}</Text>
          </View>
          
          <View style={{ width: 60 }}></View>
        </View>

        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleLine}>CORPORATE OPERATING BUDGET</Text>
          <Text style={styles.titleLine}>FISCAL YEAR {fiscalYear || new Date().getFullYear()}</Text>
          <Text style={styles.reportTitle}>LONGEVITY PAY (LOYALTY AWARD)</Text>
        </View>

        {/* Table Section */}
        <View style={styles.table}>
          
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.tableHeaderCell, { width: colWidths[0] }]}>
              <Text style={styles.headerTextLabel}>NAME OF RETIREES</Text>
              <Text style={styles.headerTextLabel}>(FAMILY NAME, NAME, M. I.)</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: colWidths[1] }]}>
              <Text style={styles.headerTextLabel}>DESIGNATION</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: colWidths[2] }]}>
              <Text style={styles.headerTextLabel}>YEARS IN</Text>
              <Text style={styles.headerTextLabel}>SERVICE</Text>
            </View>
            <View style={[styles.tableHeaderCellLast, { width: colWidths[3] }]}>
              <Text style={styles.headerTextLabel}>AMOUNT</Text>
            </View>
          </View>

          {/* Table Body (Records) */}
          {records.map((record, index) => (
            <View key={record._id || index} style={styles.tableRow} wrap={false}>
              <View style={[styles.tableCell, { width: colWidths[0] }]}>
                <Text style={styles.cellText}>{record.employeeFullName || ''}</Text>
              </View>
              <View style={[styles.tableCell, { width: colWidths[1] }]}>
                <Text style={styles.cellText}>{record.positionTitle || ''}</Text>
              </View>
              <View style={[styles.tableCell, { width: colWidths[2] }]}>
                <Text style={styles.cellTextCenter}>{record.yearsInService || ''}</Text>
              </View>
              <View style={[styles.tableCellLast, { width: colWidths[3] }]}>
                <Text style={styles.cellTextRight}>{formatCurrency(record.amount)}</Text>
              </View>
            </View>
          ))}
          
          {/* Fill empty rows if we want it to look exactly like a printed sheet, but dynamic is better */}

          {/* Grand Total */}
          <View style={styles.grandTotalRow} wrap={false}>
            <View style={styles.grandTotalLabelCell}>
              <Text style={styles.grandTotalText}>GRAND TOTAL</Text>
            </View>
            <View style={styles.grandTotalAmountCell}>
              <Text style={styles.grandTotalAmountText}>{formatCurrency(grandTotal)}</Text>
            </View>
          </View>
          
        </View>

      </Page>
    </Document>
  );
};

export default LongevityPayReportPDF;
