import React, { useEffect, useState } from "react";
import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from "@mui/material";
import RetireeCustomPage from "./RetireeCustomPage";
import RetireeDialog from "./RetireeDialog";
import { useQuery } from "@tanstack/react-query";
import api from "../../config/api";

const RetireeTable = () => {
  const [debugMode, setDebugMode] = useState(true);
  
  // Direct query to fetch retiree data
  const { data: retirees, error, isLoading } = useQuery({
    queryKey: ["retiree"],
    queryFn: async () => {
      const response = await api.get("/retiree");
      // console.log("Fetched retiree data:", response.data);
      return response.data;
    },
  });

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching retiree data:", error);
    }
  }, [error]);

  const schema = [
    { name: "employeeNumber", label: "Employee Number", type: "text" },
    { name: "employeeFullName", label: "Employee Name", type: "text" },
    { name: "positionTitle", label: "Position", type: "text" },
    { name: "department", label: "Department", type: "text" },
    { name: "division", label: "Division", type: "text" },
    { name: "region", label: "Region", type: "text" },
    { name: "retirementType", label: "Retirement Type", type: "text" },
    { name: "dateOfRetirement", label: "Date of Retirement", type: "date" },
    { name: "terminalLeave", label: "Terminal Leave", type: "currency" },
    { name: "retirementGratuity", label: "Retirement Gratuity", type: "currency" },
    { name: "total", label: "Total", type: "currency" },
    { name: "fiscalYear", label: "Fiscal Year", type: "text" },
    { name: "budgetType", label: "Budget Type", type: "text" },
    { name: "processBy", label: "Processed By", type: "text" },
    { name: "processDate", label: "Process Date", type: "date" },
  ];

  // Debug table to directly show the data
  const DebugTable = () => {
    if (isLoading) return <CircularProgress />;
    if (error) return <Typography color="error">Error loading data: {error.message}</Typography>;
    if (!retirees || retirees.length === 0) return <Typography>No retiree records found</Typography>;
    
    return (
      <TableContainer>
        <Typography variant="h6" gutterBottom>Debug: Direct Data View</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee Name</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Retirement Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Terminal Leave</TableCell>
              <TableCell>Gratuity</TableCell>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {retirees.map((row) => (
              <TableRow key={row._id}>
                <TableCell>{row.employeeFullName}</TableCell>
                <TableCell>{row.positionTitle}</TableCell>
                <TableCell>{row.retirementType}</TableCell>
                <TableCell>{new Date(row.dateOfRetirement).toLocaleDateString()}</TableCell>
                <TableCell>₱ {parseFloat(row.terminalLeave).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                <TableCell>₱ {parseFloat(row.retirementGratuity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                <TableCell>₱ {parseFloat(row.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      {debugMode && <DebugTable />}
      
      <RetireeCustomPage
        dataListName="retiree"
        schema={schema}
        title="Retiree Management"
        description="Manage retiree records and benefits"
        hasAdd={true}
        hasEdit={true}
        hasDelete={true}
        hasClose={false}
        customAddElement={
          <RetireeDialog
            schema={schema}
            endpoint="/retiree"
            dataListName="retiree"
          />
        }
        additionalMenuOptions={[
          ({ row, endpoint, dataListName }) => (
            <RetireeDialog
              row={row}
              schema={schema}
              endpoint={endpoint}
              dataListName={dataListName}
            />
          ),
        ]}
      />
    </Paper>
  );
};

export default RetireeTable;

