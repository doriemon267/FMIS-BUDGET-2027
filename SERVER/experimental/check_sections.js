const XLSX = require('xlsx');
function checkAllSections() {
  const workbook = XLSX.readFile('../../HIERAR.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);
  // Find all rows with sections
  const sectionRows = excelData.filter(row => row.SECTION);
  // Find MARIIS-related section rows
  const mariisSectionRows = sectionRows.filter(row =>
    row.REGION === 'MARIIS' ||
    (!row.REGION && (row.DEPARTMENT === 'HEAD OFFICE' ||
                     row.DEPARTMENT === 'DIVISION I' ||
                     row.DEPARTMENT === 'DIVISION II' ||
                     row.DEPARTMENT === 'DIVISION III' ||
                     row.DEPARTMENT === 'DIVISION IV' ||
                     row.DEPARTMENT === 'DAM & RESERVOIR DIVISION'))
  );
  mariisSectionRows.forEach((row, i) => {
    });
}
checkAllSections();