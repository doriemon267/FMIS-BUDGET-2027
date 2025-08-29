import React from "react";
import { Button } from "@mui/material";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const ExportExcelButton = ({ columns, data }) => {
  const exportToExcel = async () => {
    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("COS Personnel");

    // Define header styles with the template color (#375e38) and white text
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF375E38" }
    };
    const headerFont = { color: { argb: "FFFFFFFF" }, bold: true };

    // Add header row with styles
    const headerRow = worksheet.addRow(columns.map((col) => col.label));
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });

    // Add data rows
    data.forEach((item) => {
      const rowData = columns.map((col) => item[col.field]);
      worksheet.addRow(rowData);
    });

    // Adjust column widths if necessary
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    // Generate a buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "COS_Personnel.xlsx");
  };

  return (
    <Button variant="contained" onClick={exportToExcel}>
      Export to Excel
    </Button>
  );
};

export default ExportExcelButton;
