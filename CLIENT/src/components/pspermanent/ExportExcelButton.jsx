import React from "react";
import { Button } from "@mui/material";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import GetAppIcon from '@mui/icons-material/GetApp';

const ExportExcelButton = ({ columns, data, filename = "Permanent_Personnel" }) => {
  const exportToExcel = async () => {
    try {
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Permanent Personnel");

      // Define header styles with the template color (#375e38) and white text
      const headerFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF375E38" }
      };
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true };

      // Filter out action columns and get visible columns
      const exportColumns = columns.filter(col => col.field !== 'action' && col.label);

      // Add header row with styles
      const headerRow = worksheet.addRow(exportColumns.map((col) => col.label));
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add data rows
      data.forEach((item, index) => {
        const rowData = exportColumns.map((col) => {
          const value = item[col.field];
          
          // Format different data types
          if (col.type === 'number') {
            return typeof value === 'number' ? value : 0;
          } else if (col.type === 'date') {
            return value ? new Date(value) : '';
          } else {
            return value || '';
          }
        });
        
        const dataRow = worksheet.addRow(rowData);
        
        // Add borders to data cells
        dataRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Format number cells
          const column = exportColumns[colNumber - 1];
          if (column && column.type === 'number') {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          } else if (column && column.type === 'date') {
            cell.numFmt = 'mm/dd/yyyy';
            cell.alignment = { horizontal: 'center' };
          }
        });

        // Alternate row colors
        if (index % 2 === 1) {
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F5F5' }
            };
          });
        }
      });

      // Auto-fit column widths
      worksheet.columns.forEach((column, index) => {
        const exportColumn = exportColumns[index];
        if (exportColumn) {
          // Set minimum width based on header length
          const headerLength = exportColumn.label.length;
          column.width = Math.max(headerLength + 2, 15);
          
          // Adjust width for number columns
          if (exportColumn.type === 'number') {
            column.width = Math.max(column.width, 18);
          }
        }
      });

      // Add summary row if there are number columns
      const numberColumns = exportColumns.filter(col => col.type === 'number');
      if (numberColumns.length > 0) {
        // Add empty row
        worksheet.addRow([]);
        
        // Add totals row
        const totalsRowData = exportColumns.map((col) => {
          if (col.type === 'number') {
            const total = data.reduce((sum, item) => sum + (item[col.field] || 0), 0);
            return total;
          } else if (col.field === exportColumns[0].field) {
            return 'TOTAL:';
          }
          return '';
        });
        
        const totalsRow = worksheet.addRow(totalsRowData);
        totalsRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
          cell.border = {
            top: { style: 'thick' },
            left: { style: 'thin' },
            bottom: { style: 'thick' },
            right: { style: 'thin' }
          };
          
          const column = exportColumns[colNumber - 1];
          if (column && column.type === 'number') {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });
      }

      // Add metadata
      worksheet.getCell('A1').note = {
        texts: [{
          text: `Generated on: ${new Date().toLocaleString()}\nTotal Records: ${data.length}`
        }]
      };

      // Generate a buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      saveAs(new Blob([buffer]), `${filename}_${timestamp}.xlsx`);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel. Please try again.');
    }
  };

  return (
    <Button 
      variant="contained" 
      onClick={exportToExcel}
      startIcon={<GetAppIcon />}
      sx={{
        backgroundColor: '#1976d2',
        '&:hover': {
          backgroundColor: '#1565c0',
        }
      }}
    >
      Export to Excel
    </Button>
  );
};

export default ExportExcelButton;
