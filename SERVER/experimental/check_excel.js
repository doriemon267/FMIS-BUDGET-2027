const XLSX = require('xlsx');
function checkExcelStructure() {
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
  mariisRows.slice(0, 30).forEach((row, i) => {
    });
}
checkExcelStructure();