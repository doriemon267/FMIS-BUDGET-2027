const XLSX = require('xlsx');

function checkAllSections() {
  const workbook = XLSX.readFile('../../HIERAR.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);

  console.log('Total rows in Excel:', excelData.length);

  // Find all rows with sections
  const sectionRows = excelData.filter(row => row.SECTION);
  console.log('Total section rows:', sectionRows.length);

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

  console.log('\n=== MARIIS SECTION ROWS ===');
  mariisSectionRows.forEach((row, i) => {
    console.log(`${i+1}: REGION='${row.REGION || ''}' DEPT='${row.DEPARTMENT || ''}' DIV='${row.DIVISION || ''}' SEC='${row.SECTION}'`);
  });
}

checkAllSections();
