// Assuming you have a MealAllowanceList component that displays the table
// Update the column definition for the amount to show annual amount

const columns = [
  // ... other columns
  {
    field: "amount",
    headerName: "Meal Allowance Amount",
    flex: 1,
    renderCell: (params) => {
      // Safely convert monthly amount to annual amount
      const monthlyAmount = parseFloat(params.value) || 0;
      const annualAmount = monthlyAmount * 12;
      
      return (
        <Typography>
          {annualAmount.toLocaleString("en-PH", {
            style: "currency",
            currency: "PHP",
          })}
        </Typography>
      );
    },
  },
  // ... other columns
];
