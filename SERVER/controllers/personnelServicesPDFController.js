const path = require('path');
const fs = require('fs');
const os = require('os');
const PersonnelServices = require('../models/PersonnelServices');
const COSPersonnel = require('../models/COSPersonnel');
const { Recipe: MuhammaraRecipe } = require('muhammara');

/**
 * Generate PDF Report for Permanent Personnel Services
 * @route POST /api/personnel-services/export-permanent-pdf
 */
const exportPermanentPersonnelPDF = async (req, res) => {
  let tmpFilePath = null;

  try {
    const { fiscalYear, region, office, responsibilityCenter } = req.body;

    // Build query filters
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (region) query.region = region;
    if (office) query.office = office;
    if (responsibilityCenter) query.responsibilityCenter = responsibilityCenter;
    // Filter for PERMANENT personnel only
    query.statusOfAppointment = { $regex: '^PERMANENT$', $options: 'i' };

    // Fetch data from database
    const personnelData = await PersonnelServices.find(query)
      .sort({ employeeFullName: 1 })
      .lean();

    if (!personnelData || personnelData.length === 0) {
      return res.status(404).json({ message: 'No personnel data found for the specified criteria' });
    }

    // Generate temporary file path
    tmpFilePath = path.join(os.tmpdir(), `personnel_permanent_${Date.now()}.pdf`);

    // Initialize Muhammara PDF
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.7,
      author: 'FMIS Budget System',
      title: 'Permanent Personnel Services Report',
      subject: `FY ${fiscalYear || 'N/A'} Personnel Services`,
    });

    const pageWidth = 842; // A4 Landscape width
    const pageHeight = 595; // A4 Landscape height
    const margin = 40;
    const contentWidth = pageWidth - (2 * margin);

    // Logo paths
    const sealPath = path.join(__dirname, '..', 'assets', 'Seal.png');
    const niaLogoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    const bagongPilipinasPath = path.join(__dirname, '..', 'assets', 'Bagong_Pilipinas.png');

    let currentY = margin;
    let pageNumber = 1;

    /**
     * Draw header on each page
     */
    const drawHeader = (page, isContinuation = false) => {
      let y = margin;

      // Draw logos if files exist
      if (fs.existsSync(sealPath)) {
        page.image(sealPath, margin, y, { width: 50, height: 50 });
      }
      if (fs.existsSync(niaLogoPath)) {
        page.image(niaLogoPath, pageWidth / 2 - 25, y, { width: 50, height: 50 });
      }
      if (fs.existsSync(bagongPilipinasPath)) {
        page.image(bagongPilipinasPath, pageWidth - margin - 50, y, { width: 50, height: 50 });
      }

      y += 60;

      // Header text
      page.text('Republic of the Philippines', pageWidth / 2, y, {
        color: '#000000',
        fontSize: 11,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 15;

      page.text('NATIONAL IRRIGATION ADMINISTRATION', pageWidth / 2, y, {
        color: '#000000',
        fontSize: 12,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 15;

      if (region) {
        page.text(region.toUpperCase(), pageWidth / 2, y, {
          color: '#000000',
          fontSize: 11,
          font: 'Helvetica-Bold',
          align: 'center',
        });
        y += 15;
      }

      if (office) {
        page.text(office, pageWidth / 2, y, {
          color: '#000000',
          fontSize: 10,
          font: 'Helvetica',
          align: 'center',
        });
        y += 12;
      }

      y += 10;
      page.text(`ANNEX A - PERMANENT PERSONNEL SERVICES ${isContinuation ? '(Continued)' : ''}`, pageWidth / 2, y, {
        color: '#000000',
        fontSize: 12,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 12;

      page.text(`Fiscal Year ${fiscalYear || 'N/A'}`, pageWidth / 2, y, {
        color: '#000000',
        fontSize: 10,
        font: 'Helvetica',
        align: 'center',
      });
      y += 20;

      return y;
    };

    /**
     * Draw table with comprehensive columns
     */
    const drawPersonnelTable = (page, data, startY) => {
      let y = startY;

      // Define columns for comprehensive layout
      const columns = [
        { field: 'employeeFullName', label: 'Employee Name', width: 100, align: 'left' },
        { field: 'positionTitle', label: 'Position', width: 80, align: 'left' },
        { field: 'gradelevel_SG', label: 'SG', width: 30, align: 'center' },
        { field: 'step', label: 'Step', width: 30, align: 'center' },
        { field: 'monthlySalary', label: 'Monthly Salary', width: 70, align: 'right' },
        { field: 'annualSalary', label: 'Annual Salary', width: 70, align: 'right' },
        { field: 'PERA', label: 'PERA', width: 50, align: 'right' },
        { field: 'RATA', label: 'RATA', width: 50, align: 'right' },
        { field: 'uniformALLOWANCE', label: 'Uniform', width: 50, align: 'right' },
        { field: 'medical', label: 'Medical', width: 50, align: 'right' },
        { field: 'childrenAllowance', label: 'Children', width: 50, align: 'right' },
        { field: 'midyearBonus', label: 'Midyear', width: 50, align: 'right' },
        { field: 'yearEndBonus', label: 'YE Bonus', width: 50, align: 'right' },
        { field: 'Total', label: 'Total', width: 70, align: 'right' },
      ];

      const rowHeight = 18;
      const headerHeight = 20;

      // Calculate total width
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const tableX = (pageWidth - totalWidth) / 2;

      // Draw table header
      let x = tableX;
      page.rectangle(tableX, y, totalWidth, headerHeight, {
        fill: '#4a6741',
        stroke: '#000000',
        lineWidth: 0.5,
      });

      columns.forEach((col) => {
        page.text(col.label, x + col.width / 2, y + 6, {
          color: '#ffffff',
          fontSize: 8,
          font: 'Helvetica-Bold',
          align: 'center',
        });
        x += col.width;
      });

      y += headerHeight;

      // Calculate column totals
      const totals = {};
      const numericFields = ['monthlySalary', 'annualSalary', 'PERA', 'RATA', 'uniformALLOWANCE', 
                             'medical', 'childrenAllowance', 'midyearBonus', 'yearEndBonus', 'Total'];
      
      numericFields.forEach(field => {
        totals[field] = data.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);
      });

      // Draw data rows
      let rowIndex = 0;
      for (const row of data) {
        // Check if we need a new page
        if (y + rowHeight > pageHeight - margin - 30) {
          // Draw totals before new page
          drawTotalsRow(page, columns, totals, tableX, y);
          
          // End current page and start new one
          pdfDoc.endPage();
          pageNumber++;
          const newPage = pdfDoc.createPage(pageWidth, pageHeight);
          y = drawHeader(newPage, true);
          
          // Redraw header on new page
          x = tableX;
          newPage.rectangle(tableX, y, totalWidth, headerHeight, {
            fill: '#4a6741',
            stroke: '#000000',
            lineWidth: 0.5,
          });

          columns.forEach((col) => {
            newPage.text(col.label, x + col.width / 2, y + 6, {
              color: '#ffffff',
              fontSize: 8,
              font: 'Helvetica-Bold',
              align: 'center',
            });
            x += col.width;
          });

          y += headerHeight;
          page = newPage;
        }

        // Draw row background (alternating colors)
        const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f5f5f5';
        page.rectangle(tableX, y, totalWidth, rowHeight, {
          fill: bgColor,
          stroke: '#cccccc',
          lineWidth: 0.3,
        });

        // Draw cell values
        x = tableX;
        columns.forEach((col) => {
          let value = row[col.field] || '';
          
          // Format numeric values
          if (numericFields.includes(col.field) && value !== '') {
            value = parseFloat(value).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            });
          }

          // Truncate long text
          const displayValue = String(value).length > 15 && col.align === 'left' 
            ? String(value).substring(0, 13) + '...' 
            : String(value);

          let textX = x + 3; // Left padding
          if (col.align === 'center') textX = x + col.width / 2;
          if (col.align === 'right') textX = x + col.width - 3;

          page.text(displayValue, textX, y + 5, {
            color: '#000000',
            fontSize: 7,
            font: 'Helvetica',
            align: col.align,
          });

          x += col.width;
        });

        y += rowHeight;
        rowIndex++;
      }

      return { y, page, totals };
    };

    /**
     * Draw totals row
     */
    const drawTotalsRow = (page, columns, totals, tableX, y) => {
      const rowHeight = 20;
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

      page.rectangle(tableX, y, totalWidth, rowHeight, {
        fill: '#e8f5e9',
        stroke: '#000000',
        lineWidth: 0.8,
      });

      let x = tableX;
      columns.forEach((col) => {
        let value = '';
        if (col.field === 'employeeFullName') {
          value = 'TOTAL';
        } else if (totals[col.field] !== undefined) {
          value = totals[col.field].toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }

        let textX = x + 3;
        if (col.align === 'center') textX = x + col.width / 2;
        if (col.align === 'right') textX = x + col.width - 3;

        page.text(value, textX, y + 6, {
          color: '#000000',
          fontSize: 8,
          font: 'Helvetica-Bold',
          align: col.align,
        });

        x += col.width;
      });
    };

    // Start first page
    let currentPage = pdfDoc.createPage(pageWidth, pageHeight);
    currentY = drawHeader(currentPage);

    // Draw personnel table
    const result = drawPersonnelTable(currentPage, personnelData, currentY);
    currentPage = result.page;
    currentY = result.y;

    // Draw final totals
    const columns = [
      { field: 'employeeFullName', label: 'Employee Name', width: 100, align: 'left' },
      { field: 'positionTitle', label: 'Position', width: 80, align: 'left' },
      { field: 'gradelevel_SG', label: 'SG', width: 30, align: 'center' },
      { field: 'step', label: 'Step', width: 30, align: 'center' },
      { field: 'monthlySalary', label: 'Monthly Salary', width: 70, align: 'right' },
      { field: 'annualSalary', label: 'Annual Salary', width: 70, align: 'right' },
      { field: 'PERA', label: 'PERA', width: 50, align: 'right' },
      { field: 'RATA', label: 'RATA', width: 50, align: 'right' },
      { field: 'uniformALLOWANCE', label: 'Uniform', width: 50, align: 'right' },
      { field: 'medical', label: 'Medical', width: 50, align: 'right' },
      { field: 'childrenAllowance', label: 'Children', width: 50, align: 'right' },
      { field: 'midyearBonus', label: 'Midyear', width: 50, align: 'right' },
      { field: 'yearEndBonus', label: 'YE Bonus', width: 50, align: 'right' },
      { field: 'Total', label: 'Total', width: 70, align: 'right' },
    ];
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const tableX = (pageWidth - totalWidth) / 2;
    
    drawTotalsRow(currentPage, columns, result.totals, tableX, currentY);

    // Add footer with page number
    currentY = pageHeight - margin + 10;
    currentPage.text(`Page ${pageNumber}`, pageWidth / 2, currentY, {
      color: '#666666',
      fontSize: 8,
      font: 'Helvetica',
      align: 'center',
    });

    // Finalize PDF
    pdfDoc.endPage().endPDF();

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Personnel_Permanent_FY${fiscalYear || 'N_A'}.pdf"`);

    const fileStream = fs.createReadStream(tmpFilePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up temp file
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    });

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming PDF file' });
      }
    });

  } catch (error) {
    console.error('Error generating permanent personnel PDF:', error);
    
    // Clean up temp file on error
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try {
        fs.unlinkSync(tmpFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating PDF report',
        error: error.message 
      });
    }
  }
};

/**
 * Generate PDF Report for Casual Personnel Services
 * @route POST /api/personnel-services/export-casual-pdf
 */
const exportCasualPersonnelPDF = async (req, res) => {
  let tmpFilePath = null;

  try {
    const { fiscalYear, region, office, division } = req.body;

    // Build query filters
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (region) query.region = region;
    if (office) query.office = office;
    if (division) query.division = division;
    // Filter for CASUAL personnel only
    query.statusOfAppointment = { $regex: '^CASUAL$', $options: 'i' };

    // Fetch data from database (CASUAL personnel from PersonnelServices)
    const casualData = await PersonnelServices.find(query)
      .sort({ employeeFullName: 1 })
      .lean();

    if (!casualData || casualData.length === 0) {
      return res.status(404).json({ message: 'No casual personnel data found for the specified criteria' });
    }

    // Generate temporary file path
    tmpFilePath = path.join(os.tmpdir(), `personnel_casual_${Date.now()}.pdf`);

    // Initialize Muhammara PDF
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.7,
      author: 'FMIS Budget System',
      title: 'Casual Personnel Services Report',
      subject: `FY ${fiscalYear || 'N/A'} Casual Personnel Services`,
    });

    const pageWidth = 842; // A4 Landscape width
    const pageHeight = 595; // A4 Landscape height
    const margin = 40;
    const contentWidth = pageWidth - (2 * margin);

    // Logo paths
    const sealPath = path.join(__dirname, '..', 'assets', 'Seal.png');
    const niaLogoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    const bagongPilipinasPath = path.join(__dirname, '..', 'assets', 'Bagong_Pilipinas.png');

    let currentY = margin;
    let pageNumber = 1;

    /**
     * Draw header on each page
     */
    const drawHeader = (page, isContinuation = false) => {
      let y = margin;

      // Draw logos if files exist
      if (fs.existsSync(sealPath)) {
        page.image(sealPath, margin, y, { width: 50, height: 50 });
      }
      if (fs.existsSync(niaLogoPath)) {
        page.image(niaLogoPath, pageWidth / 2 - 25, y, { width: 50, height: 50 });
      }
      if (fs.existsSync(bagongPilipinasPath)) {
        page.image(bagongPilipinasPath, pageWidth - margin - 50, y, { width: 50, height: 50 });
      }

      y += 60;

      // Header text
      page.text('Republic of the Philippines', pageWidth / 2, y, {
        color: '#000000',
        fontSize: 11,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 15;

      page.text('NATIONAL IRRIGATION ADMINISTRATION', pageWidth / 2, y, {
        color: '#000000',
        fontSize: 12,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 15;

      if (region) {
        page.text(region.toUpperCase(), pageWidth / 2, y, {
          color: '#000000',
          fontSize: 11,
          font: 'Helvetica-Bold',
          align: 'center',
        });
        y += 15;
      }

      if (office) {
        page.text(office, pageWidth / 2, y, {
          color: '#000000',
          fontSize: 10,
          font: 'Helvetica',
          align: 'center',
        });
        y += 12;
      }

      y += 10;
      page.text(`ANNEX A - CASUAL (COS) PERSONNEL SERVICES ${isContinuation ? '(Continued)' : ''}`, pageWidth / 2, y, {
        color: '#000000',
        fontSize: 12,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 12;

      page.text(`Fiscal Year ${fiscalYear || 'N/A'}`, pageWidth / 2, y, {
        color: '#000000',
        fontSize: 10,
        font: 'Helvetica',
        align: 'center',
      });
      y += 20;

      return y;
    };

    /**
     * Draw COS personnel table
     */
    const drawCOSTable = (page, data, startY) => {
      let y = startY;

      // Define columns for COS layout
      const columns = [
        { field: 'employeeFullName', label: 'Employee Name', width: 120, align: 'left' },
        { field: 'positionTitle', label: 'Position', width: 100, align: 'left' },
        { field: 'gradelevel_JG', label: 'JG', width: 35, align: 'center' },
        { field: 'step', label: 'Step', width: 35, align: 'center' },
        { field: 'monthlySalary', label: 'Monthly Salary', width: 80, align: 'right' },
        { field: 'annualSalary', label: 'Annual Salary', width: 80, align: 'right' },
        { field: 'PERA', label: 'PERA', width: 60, align: 'right' },
        { field: 'RATA', label: 'RATA', width: 60, align: 'right' },
        { field: 'medical', label: 'Medical', width: 60, align: 'right' },
        { field: 'midyearBonus', label: 'Midyear', width: 60, align: 'right' },
        { field: 'Total', label: 'Total', width: 80, align: 'right' },
      ];

      const rowHeight = 18;
      const headerHeight = 20;

      // Calculate total width
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const tableX = (pageWidth - totalWidth) / 2;

      // Draw table header
      let x = tableX;
      page.rectangle(tableX, y, totalWidth, headerHeight, {
        fill: '#4a6741',
        stroke: '#000000',
        lineWidth: 0.5,
      });

      columns.forEach((col) => {
        page.text(col.label, x + col.width / 2, y + 6, {
          color: '#ffffff',
          fontSize: 8,
          font: 'Helvetica-Bold',
          align: 'center',
        });
        x += col.width;
      });

      y += headerHeight;

      // Calculate column totals
      const totals = {};
      const numericFields = ['monthlySalary', 'annualSalary', 'PERA', 'RATA', 'medical', 'midyearBonus', 'Total'];
      
      numericFields.forEach(field => {
        totals[field] = data.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);
      });

      // Draw data rows
      let rowIndex = 0;
      for (const row of data) {
        // Check if we need a new page
        if (y + rowHeight > pageHeight - margin - 30) {
          // Draw totals before new page
          drawTotalsRow(page, columns, totals, tableX, y);
          
          // End current page and start new one
          pdfDoc.endPage();
          pageNumber++;
          const newPage = pdfDoc.createPage(pageWidth, pageHeight);
          y = drawHeader(newPage, true);
          
          // Redraw header on new page
          x = tableX;
          newPage.rectangle(tableX, y, totalWidth, headerHeight, {
            fill: '#4a6741',
            stroke: '#000000',
            lineWidth: 0.5,
          });

          columns.forEach((col) => {
            newPage.text(col.label, x + col.width / 2, y + 6, {
              color: '#ffffff',
              fontSize: 8,
              font: 'Helvetica-Bold',
              align: 'center',
            });
            x += col.width;
          });

          y += headerHeight;
          page = newPage;
        }

        // Draw row background (alternating colors)
        const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f5f5f5';
        page.rectangle(tableX, y, totalWidth, rowHeight, {
          fill: bgColor,
          stroke: '#cccccc',
          lineWidth: 0.3,
        });

        // Draw cell values
        x = tableX;
        columns.forEach((col) => {
          let value = row[col.field] || '';
          
          // Format numeric values
          if (numericFields.includes(col.field) && value !== '') {
            value = parseFloat(value).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            });
          }

          // Truncate long text
          const displayValue = String(value).length > 18 && col.align === 'left' 
            ? String(value).substring(0, 16) + '...' 
            : String(value);

          let textX = x + 3; // Left padding
          if (col.align === 'center') textX = x + col.width / 2;
          if (col.align === 'right') textX = x + col.width - 3;

          page.text(displayValue, textX, y + 5, {
            color: '#000000',
            fontSize: 7,
            font: 'Helvetica',
            align: col.align,
          });

          x += col.width;
        });

        y += rowHeight;
        rowIndex++;
      }

      return { y, page, totals };
    };

    /**
     * Draw totals row
     */
    const drawTotalsRow = (page, columns, totals, tableX, y) => {
      const rowHeight = 20;
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

      page.rectangle(tableX, y, totalWidth, rowHeight, {
        fill: '#e8f5e9',
        stroke: '#000000',
        lineWidth: 0.8,
      });

      let x = tableX;
      columns.forEach((col) => {
        let value = '';
        if (col.field === 'employeeFullName') {
          value = 'TOTAL';
        } else if (totals[col.field] !== undefined) {
          value = totals[col.field].toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }

        let textX = x + 3;
        if (col.align === 'center') textX = x + col.width / 2;
        if (col.align === 'right') textX = x + col.width - 3;

        page.text(value, textX, y + 6, {
          color: '#000000',
          fontSize: 8,
          font: 'Helvetica-Bold',
          align: col.align,
        });

        x += col.width;
      });
    };

    // Start first page
    let currentPage = pdfDoc.createPage(pageWidth, pageHeight);
    currentY = drawHeader(currentPage);

    // Draw casual personnel table
    const result = drawCOSTable(currentPage, casualData, currentY);
    currentPage = result.page;
    currentY = result.y;

    // Draw final totals
    const columns = [
      { field: 'employeeFullName', label: 'Employee Name', width: 120, align: 'left' },
      { field: 'positionTitle', label: 'Position', width: 100, align: 'left' },
      { field: 'gradelevel_JG', label: 'JG', width: 35, align: 'center' },
      { field: 'step', label: 'Step', width: 35, align: 'center' },
      { field: 'monthlySalary', label: 'Monthly Salary', width: 80, align: 'right' },
      { field: 'annualSalary', label: 'Annual Salary', width: 80, align: 'right' },
      { field: 'PERA', label: 'PERA', width: 60, align: 'right' },
      { field: 'RATA', label: 'RATA', width: 60, align: 'right' },
      { field: 'medical', label: 'Medical', width: 60, align: 'right' },
      { field: 'midyearBonus', label: 'Midyear', width: 60, align: 'right' },
      { field: 'Total', label: 'Total', width: 80, align: 'right' },
    ];
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const tableX = (pageWidth - totalWidth) / 2;
    
    drawTotalsRow(currentPage, columns, result.totals, tableX, currentY);

    // Add footer with page number
    currentY = pageHeight - margin + 10;
    currentPage.text(`Page ${pageNumber}`, pageWidth / 2, currentY, {
      color: '#666666',
      fontSize: 8,
      font: 'Helvetica',
      align: 'center',
    });

    // Finalize PDF
    pdfDoc.endPage().endPDF();

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Personnel_Casual_FY${fiscalYear || 'N_A'}.pdf"`);

    const fileStream = fs.createReadStream(tmpFilePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up temp file
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    });

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming PDF file' });
      }
    });

  } catch (error) {
    console.error('Error generating casual personnel PDF:', error);
    
    // Clean up temp file on error
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try {
        fs.unlinkSync(tmpFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating PDF report',
        error: error.message 
      });
    }
  }
};

/**
 * Generate PDF Report for COS (Contract of Service) Personnel
 * @route POST /api/personnel-services/export-cos-pdf
 */
const exportCOSPersonnelPDF = async (req, res) => {
  let tmpFilePath = null;

  try {
    const { fiscalYear, region, office, division } = req.body;

    // Build query filters
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (region) query.region = region;
    if (office) query.office = office;
    if (division) query.division = division;

    // Fetch COS personnel from COSPersonnel collection
    const cosData = await COSPersonnel.find(query)
      .sort({ employeeFullName: 1 })
      .lean();

    if (!cosData || cosData.length === 0) {
      return res.status(404).json({ message: 'No COS personnel data found for the specified criteria' });
    }

    // Generate temporary file path
    tmpFilePath = path.join(os.tmpdir(), `personnel_cos_${Date.now()}.pdf`);

    // Initialize Muhammara PDF
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, {
      version: 1.7,
      author: 'FMIS Budget System',
      title: 'COS Personnel Services Report',
      subject: `FY ${fiscalYear || 'N/A'} COS Personnel Services`,
    });

    const pageWidth = 842; // A4 Landscape width
    const pageHeight = 595; // A4 Landscape height
    const margin = 40;
    const contentWidth = pageWidth - (2 * margin);

    // Logo paths
    const sealPath = path.join(__dirname, '..', 'assets', 'Seal.png');
    const niaLogoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    const bagongPilipinasPath = path.join(__dirname, '..', 'assets', 'Bagong_Pilipinas.png');

    let currentY = margin;
    let pageNumber = 1;

    /**
     * Draw header on each page
     */
    const drawHeader = (page, isContinuation = false) => {
      let y = margin;

      // Draw logos if files exist
      if (fs.existsSync(sealPath)) {
        page.image(sealPath, margin, y, { width: 50, height: 50 });
      }
      if (fs.existsSync(niaLogoPath)) {
        page.image(niaLogoPath, pageWidth / 2 - 25, y, { width: 50, height: 50 });
      }
      if (fs.existsSync(bagongPilipinasPath)) {
        page.image(bagongPilipinasPath, pageWidth - margin - 50, y, { width: 50, height: 50 });
      }

      y += 60;

      // Header text
      page.text('Republic of the Philippines', pageWidth / 2, y, {
        color: '#000000',
        fontSize: 11,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 15;

      page.text('NATIONAL IRRIGATION ADMINISTRATION', pageWidth / 2, y, {
        color: '#000000',
        fontSize: 12,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 15;

      if (region) {
        page.text(region.toUpperCase(), pageWidth / 2, y, {
          color: '#000000',
          fontSize: 11,
          font: 'Helvetica-Bold',
          align: 'center',
        });
        y += 15;
      }

      if (office) {
        page.text(office, pageWidth / 2, y, {
          color: '#000000',
          fontSize: 10,
          font: 'Helvetica',
          align: 'center',
        });
        y += 12;
      }

      y += 10;
      page.text(`ANNEX A - COS PERSONNEL SERVICES ${isContinuation ? '(Continued)' : ''}`, pageWidth / 2, y, {
        color: '#000000',
        fontSize: 12,
        font: 'Helvetica-Bold',
        align: 'center',
      });
      y += 12;

      page.text(`Fiscal Year ${fiscalYear || 'N/A'}`, pageWidth / 2, y, {
        color: '#000000',
        fontSize: 10,
        font: 'Helvetica',
        align: 'center',
      });
      y += 20;

      return y;
    };

    /**
     * Draw COS table
     */
    const drawCOSTable = (page, data, startY) => {
      let y = startY;

      // Define columns for COS - use wider layout for better readability
      const columns = [
        { field: 'employeeFullName', label: 'Employee Name', width: 180, align: 'left' },
        { field: 'positionTitle', label: 'Position', width: 150, align: 'left' },
        { field: 'gradelevel_JG', label: 'JG', width: 45, align: 'center' },
        { field: 'step', label: 'Step', width: 45, align: 'center' },
        { field: 'monthlySalary', label: 'Monthly Salary', width: 100, align: 'right' },
        { field: 'annualSalary', label: 'Annual Salary', width: 100, align: 'right' },
        { field: 'Total', label: 'Total', width: 100, align: 'right' },
      ];

      const rowHeight = 22;
      const headerHeight = 24;

      // Calculate total width - use most of the content width
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const tableX = margin + 10; // Start from left edge with small margin

      // Draw table header
      let x = tableX;
      page.rectangle(tableX, y, totalWidth, headerHeight, {
        fill: '#4a6741',
        stroke: '#000000',
        lineWidth: 0.5,
      });

      columns.forEach((col) => {
        page.text(col.label, x + col.width / 2, y + 8, {
          color: '#ffffff',
          fontSize: 9,
          font: 'Helvetica-Bold',
          align: 'center',
        });
        x += col.width;
      });

      y += headerHeight;

      // Calculate column totals
      const totals = {};
      const numericFields = ['monthlySalary', 'annualSalary', 'Total'];
      
      numericFields.forEach(field => {
        totals[field] = data.reduce((sum, row) => {
          if (field === 'Total') {
            return sum + (parseFloat(row.monthlySalary) || 0) + (parseFloat(row.annualSalary) || 0);
          }
          return sum + (parseFloat(row[field]) || 0);
        }, 0);
      });

      // Draw data rows
      let rowIndex = 0;
      for (const row of data) {
        // Check if we need a new page
        if (y + rowHeight > pageHeight - margin - 30) {
          // Draw totals before new page
          drawTotalsRow(page, columns, totals, tableX, y);
          
          // End current page and start new one
          pdfDoc.endPage();
          pageNumber++;
          const newPage = pdfDoc.createPage(pageWidth, pageHeight);
          y = drawHeader(newPage, true);
          
          // Redraw header on new page
          x = tableX;
          newPage.rectangle(tableX, y, totalWidth, headerHeight, {
            fill: '#4a6741',
            stroke: '#000000',
            lineWidth: 0.5,
          });

          columns.forEach((col) => {
            newPage.text(col.label, x + col.width / 2, y + 8, {
              color: '#ffffff',
              fontSize: 9,
              font: 'Helvetica-Bold',
              align: 'center',
            });
            x += col.width;
          });

          y += headerHeight;
          page = newPage;
        }

        // Draw row background (alternating colors)
        const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f5f5f5';
        page.rectangle(tableX, y, totalWidth, rowHeight, {
          fill: bgColor,
          stroke: '#cccccc',
          lineWidth: 0.3,
        });

        // Draw cell values
        x = tableX;
        columns.forEach((col) => {
          let value = row[col.field] || '';
          
          // Format numeric values
          if (numericFields.includes(col.field) && value !== '') {
            if (col.field === 'Total') {
              value = (parseFloat(row.monthlySalary) || 0) + (parseFloat(row.annualSalary) || 0);
            }
            value = parseFloat(value).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            });
          }

          // Truncate long text less aggressively with larger column widths
          const displayValue = String(value).length > 20 && col.align === 'left' 
            ? String(value).substring(0, 18) + '...' 
            : String(value);

          let textX = x + 5;
          if (col.align === 'center') textX = x + col.width / 2;
          if (col.align === 'right') textX = x + col.width - 5;

          page.text(displayValue, textX, y + 7, {
            color: '#000000',
            fontSize: 8,
            font: 'Helvetica',
            align: col.align,
          });

          x += col.width;
        });

        y += rowHeight;
        rowIndex++;
      }

      return { y, page, totals };
    };

    /**
     * Draw totals row
     */
    const drawTotalsRow = (page, columns, totals, tableX, y) => {
      const rowHeight = 22;
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

      page.rectangle(tableX, y, totalWidth, rowHeight, {
        fill: '#e8f5e9',
        stroke: '#000000',
        lineWidth: 0.8,
      });

      let x = tableX;
      columns.forEach((col) => {
        let value = '';
        if (col.field === 'employeeFullName') {
          value = 'TOTAL';
        } else if (totals[col.field] !== undefined) {
          value = totals[col.field].toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }

        let textX = x + 5;
        if (col.align === 'center') textX = x + col.width / 2;
        if (col.align === 'right') textX = x + col.width - 5;

        page.text(value, textX, y + 7, {
          color: '#000000',
          fontSize: 8,
          font: 'Helvetica-Bold',
          align: col.align,
        });

        x += col.width;
      });
    };

    // Start first page
    let currentPage = pdfDoc.createPage(pageWidth, pageHeight);
    currentY = drawHeader(currentPage);

    // Draw casual personnel table
    const result = drawCOSTable(currentPage, cosData, currentY);
    currentPage = result.page;
    currentY = result.y;

    // Draw final totals
    const columns = [
      { field: 'employeeFullName', label: 'Employee Name', width: 180, align: 'left' },
      { field: 'positionTitle', label: 'Position', width: 150, align: 'left' },
      { field: 'gradelevel_JG', label: 'JG', width: 45, align: 'center' },
      { field: 'step', label: 'Step', width: 45, align: 'center' },
      { field: 'monthlySalary', label: 'Monthly Salary', width: 100, align: 'right' },
      { field: 'annualSalary', label: 'Annual Salary', width: 100, align: 'right' },
      { field: 'Total', label: 'Total', width: 100, align: 'right' },
    ];
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const tableX = margin + 10; // Start from left edge with small margin
    
    drawTotalsRow(currentPage, columns, result.totals, tableX, currentY);

    // Add footer with page number
    currentY = pageHeight - margin + 10;
    currentPage.text(`Page ${pageNumber}`, pageWidth / 2, currentY, {
      color: '#666666',
      fontSize: 8,
      font: 'Helvetica',
      align: 'center',
    });

    // Finalize PDF
    pdfDoc.endPage().endPDF();

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Personnel_COS_FY${fiscalYear || 'N_A'}.pdf"`);

    const fileStream = fs.createReadStream(tmpFilePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up temp file
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    });

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming PDF file' });
      }
    });

  } catch (error) {
    console.error('Error generating COS personnel PDF:', error);
    
    // Clean up temp file on error
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try {
        fs.unlinkSync(tmpFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating PDF report',
        error: error.message 
      });
    }
  }
};

module.exports = {
  exportPermanentPersonnelPDF,
  exportCasualPersonnelPDF,
  exportCOSPersonnelPDF,
};
