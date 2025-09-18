
import React, { useState } from "react";
import {
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import api from "../../config/api";
import toast from "react-hot-toast";

const ViewProposalDialog = ({ row, parentClose }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const handleView = async () => {
    setLoading(true);
    try {
      // Log the parameters we're sending
      
      // Check if all required parameters are present
      if (!row.fiscalYear || !row.budgetType || !row.processBy || !row.region) {
        console.error("Missing required parameters for proposal details:", row);
        throw new Error("Missing required parameters for proposal details");
      }
      
      // Fetch detailed proposal data
      const response = await api.get(`/proposals/details`, {
        params: {
          fiscalYear: row.fiscalYear,
          budgetType: row.budgetType,
          processBy: row.processBy,
          region: row.region,
        },
      });
      
      setReportData(response.data);
      setOpen(true);
    } catch (err) {
      console.error("Error fetching proposal details:", err);
      console.error("Error details:", err.response?.data);
      toast.error("Failed to load proposal details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MenuItem onClick={handleView} disabled={loading}>
        <ListItemIcon>
          {loading ? <CircularProgress size={20} /> : <VisibilityIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText>View Details</ListItemText>
      </MenuItem>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Proposal Details</DialogTitle>
        <DialogContent>
          {loading ? (
            <CircularProgress />
          ) : reportData ? (
            <>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Process By</TableCell>
                      <TableCell>Region</TableCell>
                      <TableCell>Fiscal Year</TableCell>
                      <TableCell>Budget Type</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>{row.processBy}</TableCell>
                      <TableCell>{row.region}</TableCell>
                      <TableCell>{row.fiscalYear}</TableCell>
                      <TableCell>{row.budgetType}</TableCell>
                      <TableCell>{row.status}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom>
                Budget Breakdown
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.breakdown?.map((item, index) => (
                      <TableRow key={item.category || index}>
                        <TableCell>{item.category}</TableCell>
                        <TableCell align="right">
                          {Number(item.amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell><strong>Total Expenses</strong></TableCell>
                      <TableCell align="right"><strong>
                        {Number(row.totalExpenses).toLocaleString()}
                      </strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Total Income</strong></TableCell>
                      <TableCell align="right"><strong>
                        {Number(row.totalIncome).toLocaleString()}
                      </strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Typography>No data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ViewProposalDialog;

