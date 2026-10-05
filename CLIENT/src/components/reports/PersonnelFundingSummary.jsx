import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

const money = value => Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

export default function PersonnelFundingSummary({ funding }) {
  if (!funding) return null;
  const rows = [
    { label: 'Annual salaries', income: funding.salaryIncome, subsidy: funding.salarySubsidy, total: funding.salaryTotal },
    { label: 'Other PS costs', income: funding.income - funding.salaryIncome, subsidy: funding.subsidy - funding.salarySubsidy, total: funding.total - funding.salaryTotal },
    { label: 'Total Personnel Services', income: funding.income, subsidy: funding.subsidy, total: funding.total },
  ];
  return <Paper sx={{ p: 2, mb: 2 }}>
    <Typography variant="subtitle1">Annual Personnel Services Funding</Typography>
    <Typography variant="body2" color="text.secondary">
      CPCS salary increases are charged to Income; CPCS 1 base salaries are charged to Subsidy.
      These amounts are already included in the report totals.
    </Typography>
    <TableContainer><Table size="small" aria-label="Annual Personnel Services funding">
      <TableHead><TableRow><TableCell>Particulars</TableCell><TableCell align="right">Income</TableCell><TableCell align="right">Subsidy</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.label}>
        <TableCell>{row.label}</TableCell><TableCell align="right">{money(row.income)}</TableCell><TableCell align="right">{money(row.subsidy)}</TableCell><TableCell align="right">{money(row.total)}</TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer>
  </Paper>;
}
