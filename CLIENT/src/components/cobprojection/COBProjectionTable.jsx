import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Typography,
  Box,
  InputAdornment
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { NumericFormat } from 'react-number-format';

// Custom component for numeric input formatting
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, ...other } = props;
  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      onValueChange={(values) => {
        onChange({
          target: {
            name: props.name,
            value: values.value,
          },
        });
      }}
    />
  );
});

// Styled components for better appearance
const StyledTableCell = styled(TableCell)(({ theme, isheader, issubtotal, isgrandtotal }) => ({
  padding: '8px 16px',
  fontSize: isheader === 'true' ? '0.875rem' : '0.8125rem',
  fontWeight: isheader === 'true' || issubtotal === 'true' || isgrandtotal === 'true' ? 'bold' : 'normal',
  backgroundColor: isgrandtotal === 'true' 
    ? '#375e38' 
    : issubtotal === 'true' 
      ? '#e8f5e9' 
      : isheader === 'true' 
        ? '#f5f5f5' 
        : 'inherit',
  color: isgrandtotal === 'true' ? 'white' : 'inherit',
  border: '1px solid #ddd',
}));

const StyledTableRow = styled(TableRow)(({ theme, isheader, issubtotal, isgrandtotal }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: isheader === 'true' || issubtotal === 'true' || isgrandtotal === 'true' 
      ? 'inherit' 
      : theme.palette.action.hover,
  },
}));

const StyledTextField = styled(TextField)({
  '& .MuiInputBase-input': {
    padding: '8px',
    textAlign: 'right',
  },
  width: '100%',
});

const COBProjectionTable = ({ personnelData }) => {
  // State for editable fields
  const [projections, setProjections] = useState({
    permanent: { corporate: 0, subsidy: 0 },
    casual: { corporate: 0, subsidy: 0 },
    pera: { corporate: 0, subsidy: 0 },
    representation: { corporate: 0, subsidy: 0 },
    transportation: { corporate: 0, subsidy: 0 },
    hazard: { corporate: 0, subsidy: 0 },
    uniform: { corporate: 0, subsidy: 0 },
    children: { corporate: 0, subsidy: 0 },
    medical: { corporate: 0, subsidy: 0 },
    meal: { corporate: 0, subsidy: 0 },
    perdiem: { corporate: 0, subsidy: 0 },
    subsistence: { corporate: 0, subsidy: 0 },
    laundry: { corporate: 0, subsidy: 0 },
    overtime: { corporate: 0, subsidy: 0 },
    specialCounsel: { corporate: 0, subsidy: 0 },
    productivity: { corporate: 0, subsidy: 0 },
    cashGift: { corporate: 0, subsidy: 0 },
    bonus: { corporate: 0, subsidy: 0 },
    performance: { corporate: 0, subsidy: 0 },
    retirement: { corporate: 0, subsidy: 0 },
    terminal: { corporate: 0, subsidy: 0 },
    gsis: { corporate: 0, subsidy: 0 },
    pagibig: { corporate: 0, subsidy: 0 },
    philhealth: { corporate: 0, subsidy: 0 },
    compensation: { corporate: 0, subsidy: 0 },
    leave: { corporate: 0, subsidy: 0 },
  });

  // Calculate proposed budgets from personnel data
  const proposedBudgets = useMemo(() => {
    // Filter personnel by status and calculate totals
    const permanentTotal = personnelData
      .filter(p => p.statusOfAppointment === 'PERMANENT')
      .reduce((sum, p) => sum + (Number(p.annualSalary) || 0), 0);
    
    const casualTotal = personnelData
      .filter(p => p.statusOfAppointment === 'CASUAL')
      .reduce((sum, p) => sum + (Number(p.annualSalary) || 0), 0);
    
    // Calculate allowance totals across all personnel
    const peraTotal = personnelData.reduce((sum, p) => sum + (Number(p.PERA) || 0), 0);
    const rataTotal = personnelData.reduce((sum, p) => sum + (Number(p.RATA) || 0), 0);
    const uniformTotal = personnelData.reduce((sum, p) => sum + (Number(p.uniformALLOWANCE) || 0), 0);
    const childrenTotal = personnelData.reduce((sum, p) => sum + (Number(p.childrenAllowance) || 0), 0);
    const medicalTotal = personnelData.reduce((sum, p) => sum + (Number(p.medical) || 0), 0);
    const mealTotal = personnelData.reduce((sum, p) => sum + (Number(p.meal) || 0), 0);
    const cashGiftTotal = personnelData.reduce((sum, p) => sum + (Number(p.cashGift) || 0), 0);
    const bonusTotal = personnelData.reduce((sum, p) => 
      sum + (Number(p.midyearBonus) || 0) + (Number(p.yearEndBonus) || 0), 0);
    const productivityTotal = personnelData.reduce((sum, p) => sum + (Number(p.productivityIncentive) || 0), 0);
    const gsisTotal = personnelData.reduce((sum, p) => sum + (Number(p.gsisPremium) || 0), 0);
    const pagibigTotal = personnelData.reduce((sum, p) => sum + (Number(p.pagibigPremium) || 0), 0);
    const philhealthTotal = personnelData.reduce((sum, p) => sum + (Number(p.philhealthPremium) || 0), 0);
    const ecTotal = personnelData.reduce((sum, p) => sum + (Number(p.employeeCompensation) || 0), 0);
    
    // Calculate grand total
    const grandTotal = permanentTotal + casualTotal + peraTotal + rataTotal + uniformTotal + 
      childrenTotal + medicalTotal + mealTotal + cashGiftTotal + bonusTotal + 
      productivityTotal + gsisTotal + pagibigTotal + philhealthTotal + ecTotal;
    
    return {
      permanent: permanentTotal,
      casual: casualTotal,
      pera: peraTotal,
      representation: rataTotal,
      uniform: uniformTotal,
      children: childrenTotal,
      medical: medicalTotal,
      meal: mealTotal,
      cashGift: cashGiftTotal,
      bonus: bonusTotal,
      productivity: productivityTotal,
      gsis: gsisTotal,
      pagibig: pagibigTotal,
      philhealth: philhealthTotal,
      compensation: ecTotal,
      grandTotal
    };
  }, [personnelData]);

  // Initialize projections based on proposed budgets
  useEffect(() => {
    const initialProjections = { ...projections };
    
    // For each budget item, initialize with 50/50 split between corporate and subsidy
    Object.keys(proposedBudgets).forEach(key => {
      if (key !== 'grandTotal' && initialProjections[key]) {
        const total = proposedBudgets[key];
        initialProjections[key] = {
          corporate: total / 2,
          subsidy: total / 2
        };
      }
    });
    
    setProjections(initialProjections);
  }, [proposedBudgets]);

  // Handle changes to corporate income projection
  const handleCorporateChange = (key, value) => {
    const numValue = Number(value) || 0;
    const total = proposedBudgets[key] || 0;
    const subsidy = Math.max(0, total - numValue);
    
    setProjections(prev => ({
      ...prev,
      [key]: {
        corporate: numValue,
        subsidy
      }
    }));
  };

  // Handle changes to subsidy projection
  const handleSubsidyChange = (key, value) => {
    const numValue = Number(value) || 0;
    const total = proposedBudgets[key] || 0;
    const corporate = Math.max(0, total - numValue);
    
    setProjections(prev => ({
      ...prev,
      [key]: {
        corporate,
        subsidy: numValue
      }
    }));
  };

  // Calculate totals
  const corporateTotal = Object.values(projections).reduce(
    (sum, item) => sum + (item.corporate || 0), 0
  );
  
  const subsidyTotal = Object.values(projections).reduce(
    (sum, item) => sum + (item.subsidy || 0), 0
  );

  // Format number as currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  return (
    <TableContainer component={Paper} sx={{ mb: 4, mt: 2 }}>
      <Table size="small">
        <TableHead>
          <StyledTableRow>
            <StyledTableCell colSpan={4} align="center" isheader="true">
              <Typography variant="h6">PERSONNEL SERVICES PROJECTION</Typography>
            </StyledTableCell>
          </StyledTableRow>
          <StyledTableRow>
            <StyledTableCell isheader="true" rowSpan={2}>PERSONNEL SERVICES</StyledTableCell>
            <StyledTableCell isheader="true" align="center">PROJECTED CORPORATE INCOME</StyledTableCell>
            <StyledTableCell isheader="true" align="center">PROJECTED SUBSIDY</StyledTableCell>
            <StyledTableCell isheader="true" align="center">PROPOSED BUDGET</StyledTableCell>
          </StyledTableRow>
        </TableHead>
        <TableBody>
          {/* Salaries and Wages */}
          <StyledTableRow>
            <StyledTableCell colSpan={4} issubtotal="true">1. Salaries and Wages</StyledTableCell>
          </StyledTableRow>
          
          {/* Permanent */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>a. Permanent</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.permanent.corporate}
                onChange={(e) => handleCorporateChange('permanent', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.permanent.subsidy}
                onChange={(e) => handleSubsidyChange('permanent', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.permanent)}</StyledTableCell>
          </StyledTableRow>
          
          {/* Casual */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>b. Casual</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.casual.corporate}
                onChange={(e) => handleCorporateChange('casual', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.casual.subsidy}
                onChange={(e) => handleSubsidyChange('casual', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.casual)}</StyledTableCell>
          </StyledTableRow>
          
          {/* Other Compensation */}
          <StyledTableRow>
            <StyledTableCell colSpan={4} issubtotal="true">2. Other Compensation</StyledTableCell>
          </StyledTableRow>
          
          {/* PERA */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>a. PERA</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.pera.corporate}
                onChange={(e) => handleCorporateChange('pera', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.pera.subsidy}
                onChange={(e) => handleSubsidyChange('pera', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.pera)}</StyledTableCell>
          </StyledTableRow>

          {/* Representation Allowance */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>b. Representation Allowance</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.representation.corporate}
                onChange={(e) => handleCorporateChange('representation', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.representation.subsidy}
                onChange={(e) => handleSubsidyChange('representation', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.representation)}</StyledTableCell>
          </StyledTableRow>

          {/* Uniform Allowance */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>c. Uniform/Clothing Allowance</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.uniform.corporate}
                onChange={(e) => handleCorporateChange('uniform', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.uniform.subsidy}
                onChange={(e) => handleSubsidyChange('uniform', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.uniform)}</StyledTableCell>
          </StyledTableRow>

          {/* Children Allowance */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>d. Children Allowance</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.children.corporate}
                onChange={(e) => handleCorporateChange('children', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.children.subsidy}
                onChange={(e) => handleSubsidyChange('children', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.children)}</StyledTableCell>
          </StyledTableRow>

          {/* Medical Allowance */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>e. Medical Allowance</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.medical.corporate}
                onChange={(e) => handleCorporateChange('medical', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.medical.subsidy}
                onChange={(e) => handleSubsidyChange('medical', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.medical)}</StyledTableCell>
          </StyledTableRow>

          {/* Meal Allowance */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>f. Meal Allowance</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.meal.corporate}
                onChange={(e) => handleCorporateChange('meal', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.meal.subsidy}
                onChange={(e) => handleSubsidyChange('meal', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.meal)}</StyledTableCell>
          </StyledTableRow>

          {/* Productivity Incentive */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>g. Productivity Enhancement Incentive</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.productivity.corporate}
                onChange={(e) => handleCorporateChange('productivity', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.productivity.subsidy}
                onChange={(e) => handleSubsidyChange('productivity', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.productivity)}</StyledTableCell>
          </StyledTableRow>

          {/* Cash Gift */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>h. Cash Gift</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.cashGift.corporate}
                onChange={(e) => handleCorporateChange('cashGift', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.cashGift.subsidy}
                onChange={(e) => handleSubsidyChange('cashGift', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.cashGift)}</StyledTableCell>
          </StyledTableRow>

          {/* Mid-Year and Year-End Bonus */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>i. Mid-Year and Year-End Bonus</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.bonus.corporate}
                onChange={(e) => handleCorporateChange('bonus', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.bonus.subsidy}
                onChange={(e) => handleSubsidyChange('bonus', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.bonus)}</StyledTableCell>
          </StyledTableRow>

          {/* Fixed Personnel Expenditures */}
          <StyledTableRow>
            <StyledTableCell colSpan={4} issubtotal="true">3. Fixed Personnel Expenditures</StyledTableCell>
          </StyledTableRow>

          {/* GSIS */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>a. GSIS Premium</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.gsis.corporate}
                onChange={(e) => handleCorporateChange('gsis', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.gsis.subsidy}
                onChange={(e) => handleSubsidyChange('gsis', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.gsis)}</StyledTableCell>
          </StyledTableRow>

          {/* PAG-IBIG */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>b. PAG-IBIG Contributions</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.pagibig.corporate}
                onChange={(e) => handleCorporateChange('pagibig', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.pagibig.subsidy}
                onChange={(e) => handleSubsidyChange('pagibig', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.pagibig)}</StyledTableCell>
          </StyledTableRow>

          {/* PHILHEALTH */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>c. PHILHEALTH Contributions</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.philhealth.corporate}
                onChange={(e) => handleCorporateChange('philhealth', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.philhealth.subsidy}
                onChange={(e) => handleSubsidyChange('philhealth', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.philhealth)}</StyledTableCell>
          </StyledTableRow>

          {/* Employee Compensation */}
          <StyledTableRow>
            <StyledTableCell sx={{ pl: 4 }}>d. Employee Compensation Insurance Premium</StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.compensation.corporate}
                onChange={(e) => handleCorporateChange('compensation', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">
              <StyledTextField
                variant="outlined"
                size="small"
                value={projections.compensation.subsidy}
                onChange={(e) => handleSubsidyChange('compensation', e.target.value)}
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
              />
            </StyledTableCell>
            <StyledTableCell align="right">₱{formatCurrency(proposedBudgets.compensation)}</StyledTableCell>
          </StyledTableRow>

          {/* Grand Total */}
          <StyledTableRow>
            <StyledTableCell isgrandtotal="true">Personnel Services</StyledTableCell>
            <StyledTableCell align="right" isgrandtotal="true">₱{formatCurrency(corporateTotal)}</StyledTableCell>
            <StyledTableCell align="right" isgrandtotal="true">₱{formatCurrency(subsidyTotal)}</StyledTableCell>
            <StyledTableCell align="right" isgrandtotal="true">₱{formatCurrency(proposedBudgets.grandTotal)}</StyledTableCell>
          </StyledTableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default COBProjectionTable;

