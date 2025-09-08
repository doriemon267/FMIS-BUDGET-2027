const XLSX = require('xlsx');

function checkExcelStructure() {
  console.log('=== MARIIS ROWS FROM EXCEL ===');

  const workbook = XLSX.readFile('../../HIERAR.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);

  const mariisRows = excelData.filter(row =>
    row.REGION === 'MARIIS' ||
    row.DEPARTMENT === 'HEAD OFFICE' ||
    row.DEPARTMENT === 'DIVISION I' ||
    row.DEPARTMENT === 'DIVISION II' ||
    row.DEPARTMENT === 'DIVISION III' ||
    row.DEPARTMENT === 'DIVISION IV' ||
    row.DEPARTMENT === 'DAM & RESERVOIR DIVISION'
  );

  console.log(`Found ${mariisRows.length} MARIIS-related rows`);

  mariisRows.slice(0, 30).forEach((row, i) => {
    console.log(`${i+1}: REGION='${row.REGION || ''}' DEPARTMENT='${row.DEPARTMENT || ''}' DIVISION='${row.DIVISION || ''}' SECTION='${row.SECTION || ''}'`);
  });
}

checkExcelStructure();
