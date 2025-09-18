
import React, { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  Paper, 
  Chip, 
  Divider, 
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Tabs,
  Tab
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import api from "../../config/api";

const ProposalDetails = ({ proposal }) => {
  const [loading, setLoading] = useState(false);
  const [detailedData, setDetailedData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);

  // Create a safe version of the proposal with default values
  let safeProposal = {
    fiscalYear: proposal?.fiscalYear || "Unknown",
    budgetType: proposal?.budgetType || "Unknown",
    processBy: proposal?.processBy || "Unknown",
    region: proposal?.region || "Unknown",
    status: proposal?.status || "Unknown",
    cobExpenditures: proposal?.cobExpenditures || "Unknown",
    submittedDate: proposal?.submittedDate || null,
    approvedDate: proposal?.approvedDate || null,
    rejectedDate: proposal?.rejectedDate || null,
    rejectionReason: proposal?.rejectionReason || "",
    totalExpenses: proposal?.totalExpenses || 0,
    totalIncome: proposal?.totalIncome || 0,
    ...(proposal || {}) // Keep any other properties
  };

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Approved": return "success";
      case "Submitted": return "info";
      case "Returned": return "error";
      case "Draft": return "default";
      default: return "default";
    }
  };

  // Fetch detailed data
  useEffect(() => {
    const fetchDetailedData = async () => {
      if (!safeProposal) return;
      
      setLoading(true);
      try {
        // If cobExpenditures is missing, try to fetch the complete proposal first
        if (!safeProposal.cobExpenditures) {
          try {
            const proposalResponse = await api.get(`/proposals/details`, {
              params: {
                fiscalYear: safeProposal.fiscalYear,
                budgetType: safeProposal.budgetType,
                processBy: safeProposal.processBy,
                region: safeProposal.region
              }
            });
            
            // Update our local reference to the proposal
            const updatedProposal = proposalResponse.data;
            if (!updatedProposal.cobExpenditures) {
              setError("Incomplete proposal data: missing expenditure type");
              setLoading(false);
              return;
            }
            
            // Continue with the updated proposal data
            safeProposal = updatedProposal;
          } catch (err) {
            console.error("Error fetching complete proposal:", err);
            setError("Failed to load complete proposal data");
            setLoading(false);
            return;
          }
        }
        
        const params = {
          fiscalYear: safeProposal.fiscalYear,
          budgetType: safeProposal.budgetType,
          processBy: safeProposal.processBy,
          region: safeProposal.region,
          status: safeProposal.status
        };
        
        // Determine which endpoint to call based on expenditure type
        if (safeProposal.cobExpenditures && safeProposal.cobExpenditures.includes("Personnel")) {
          // Try each endpoint in sequence until one works
          const endpoints = [
            "/getpersonnels/byParams",
            "/api/personnel/getByParams"
          ];
          
          let success = false;
          let lastError = null;
          
          for (const endpoint of endpoints) {
            try {
              const response = await api.get(endpoint, { params });
              setDetailedData(response.data);
              success = true;
              break;
            } catch (error) {
              console.error(`Error with endpoint ${endpoint}:`, error);
              lastError = error;
            }
          }
          
          if (!success) {
            throw lastError || new Error("All personnel endpoints failed");
          }
        } else if (safeProposal.cobExpenditures === "MOOE") {
          const response = await api.get("/mooe/getByParams", { params });
          setDetailedData(response.data);
        } else if (safeProposal.cobExpenditures === "Capital Outlay") {
          const response = await api.get("/capital-outlay/getByParams", { params });
          setDetailedData(response.data);
        } else if (safeProposal.cobExpenditures === "Income") {
          const response = await api.get("/income/getByParams", { params });
          setDetailedData(response.data);
        } else {
          setError(`Unknown expenditure type: ${safeProposal.cobExpenditures}`);
        }
      } catch (err) {
        console.error("Error fetching detailed data:", err);
        setError("Failed to load detailed information");
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetailedData();
  }, [safeProposal]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Render Personnel Details
  const renderPersonnelDetails = () => {
    if (!detailedData || !Array.isArray(detailedData)) return null;
    
    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Employee Name</strong></TableCell>
              <TableCell><strong>Position</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Monthly Salary</strong></TableCell>
              <TableCell><strong>Annual Salary</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detailedData.map((item, index) => (
              <React.Fragment key={item._id || item.employeeNumber || index}>
                <TableRow>
                  <TableCell>{item.employeeFullName}</TableCell>
                  <TableCell>{item.positionTitle}</TableCell>
                  <TableCell>{item.statusOfAppointment}</TableCell>
                  <TableCell>{formatCurrency(item.monthlySalary)}</TableCell>
                  <TableCell>{formatCurrency(item.annualSalary)}</TableCell>
                  <TableCell>
                    <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
                      <AccordionSummary 
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel-content"
                        sx={{ p: 0, minHeight: 'auto' }}
                      >
                        <Typography variant="caption">View Details</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 1 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                          <Typography variant="caption"><strong>RATA:</strong> {formatCurrency(item.RATA)}</Typography>
                          <Typography variant="caption"><strong>PERA:</strong> {formatCurrency(item.PERA)}</Typography>
                          <Typography variant="caption"><strong>Uniform:</strong> {formatCurrency(item.uniformALLOWANCE)}</Typography>
                          <Typography variant="caption"><strong>Productivity:</strong> {formatCurrency(item.productivityIncentive)}</Typography>
                          <Typography variant="caption"><strong>Medical:</strong> {formatCurrency(item.medical)}</Typography>
                          <Typography variant="caption"><strong>Children:</strong> {formatCurrency(item.childrenAllowance)}</Typography>
                          <Typography variant="caption"><strong>Meal:</strong> {formatCurrency(item.meal)}</Typography>
                          <Typography variant="caption"><strong>Cash Gift:</strong> {formatCurrency(item.cashGift)}</Typography>
                          <Typography variant="caption"><strong>Subsistence MDS:</strong> {formatCurrency(item.subsistenceAllowanceMDS)}</Typography>
                          <Typography variant="caption"><strong>Subsistence ST:</strong> {formatCurrency(item.subsistenceAllowanceST)}</Typography>
                          <Typography variant="caption"><strong>Midyear Bonus:</strong> {formatCurrency(item.midyearBonus)}</Typography>
                          <Typography variant="caption"><strong>Year End Bonus:</strong> {formatCurrency(item.yearEndBonus)}</Typography>
                          <Typography variant="caption"><strong>GSIS Premium:</strong> {formatCurrency(item.gsisPremium)}</Typography>
                          <Typography variant="caption"><strong>PhilHealth:</strong> {formatCurrency(item.philhealthPremium)}</Typography>
                          <Typography variant="caption"><strong>Pag-IBIG:</strong> {formatCurrency(item.pagibigPremium)}</Typography>
                          <Typography variant="caption"><strong>Emp. Compensation:</strong> {formatCurrency(item.employeeCompensation)}</Typography>
                          <Typography variant="caption"><strong>Loyalty Award:</strong> {formatCurrency(item.loyaltyAward)}</Typography>
                          <Typography variant="caption"><strong>Overtime Pay:</strong> {formatCurrency(item.overtimePay)}</Typography>
                          <Typography variant="caption"><strong>Earned Leaves:</strong> {formatCurrency(item.earnedLeaves)}</Typography>
                          <Typography variant="caption"><strong>Retirement:</strong> {formatCurrency(item.retirementBenefits)}</Typography>
                          <Typography variant="caption"><strong>Terminal Leave:</strong> {formatCurrency(item.terminalLeave)}</Typography>
                          <Typography variant="caption"><strong>Court Appearance:</strong> {formatCurrency(item.courtAppearance)}</Typography>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2"><strong>Total:</strong> {formatCurrency(item.Total)}</Typography>
                      </AccordionDetails>
                    </Accordion>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render MOOE Details
  const renderMooeDetails = () => {
    if (!detailedData || !Array.isArray(detailedData)) return null;
    
    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>UACS Code</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Amount</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detailedData.map((item, index) => (
              <TableRow key={item._id || item.uacsCode || index}>
                <TableCell>{item.uacsCode}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{formatCurrency(item.amount)}</TableCell>
                <TableCell>{item.department}</TableCell>
                <TableCell>{item.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render Capital Outlay Details
  const renderCapitalOutlayDetails = () => {
    if (!detailedData || !Array.isArray(detailedData)) return null;
    
    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Particulars</strong></TableCell>
              <TableCell><strong>Quantity</strong></TableCell>
              <TableCell><strong>Unit Cost</strong></TableCell>
              <TableCell><strong>Total Cost</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detailedData.map((item, index) => (
              <TableRow key={item._id || item.particulars || index}>
                <TableCell>{item.particulars}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{formatCurrency(item.unitCost)}</TableCell>
                <TableCell>{formatCurrency(item.cost)}</TableCell>
                <TableCell>{item.department}</TableCell>
                <TableCell>{item.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render Income Details
  const renderIncomeDetails = () => {
    if (!detailedData || !Array.isArray(detailedData)) return null;
    
    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Source</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Amount</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detailedData.map((item, index) => (
              <TableRow key={item._id || item.source || index}>
                <TableCell>{item.source}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{formatCurrency(item.amount)}</TableCell>
                <TableCell>{item.department}</TableCell>
                <TableCell>{item.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Proposal Details
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="body1">
            <strong>Process By:</strong> {safeProposal.processBy}
          </Typography>
          <Typography variant="body1">
            <strong>Region:</strong> {safeProposal.region}
          </Typography>
          <Typography variant="body1">
            <strong>Fiscal Year:</strong> {safeProposal.fiscalYear}
          </Typography>
          <Typography variant="body1">
            <strong>Budget Type:</strong> {safeProposal.budgetType}
          </Typography>
          <Typography variant="body1">
            <strong>Expenditure Type:</strong> {safeProposal.cobExpenditures}
          </Typography>
        </Box>
        <Box>
          <Chip 
            label={safeProposal.status} 
            color={getStatusColor(safeProposal.status)} 
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      {/* Display rejection reason if any proposal is returned */}
      {safeProposal.status === "Returned" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Returned Reason:
          </Typography>
          <Typography variant="body1">
            {safeProposal.rejectionReason || "No reason provided"}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Returned Date:</strong> {formatDate(safeProposal.rejectedDate)}
          </Typography>
          <Typography variant="body2">
            <strong>Returned Expenditure:</strong> {safeProposal.returnedExpenditureType || "All expenditures"}
          </Typography>
        </Alert>
      )}
      
      {/* Display approval details if approved */}
      {safeProposal.status === "Approved" && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Approved
          </Typography>
          <Typography variant="body2">
            <strong>Approved Date:</strong> {formatDate(safeProposal.approvedDate)}
          </Typography>
        </Alert>
      )}
      
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Detailed Information
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={30} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          {safeProposal.cobExpenditures && typeof safeProposal.cobExpenditures === 'string' && safeProposal.cobExpenditures.includes("Personnel") && renderPersonnelDetails()}
          {safeProposal.cobExpenditures && safeProposal.cobExpenditures === "MOOE" && renderMooeDetails()}
          {safeProposal.cobExpenditures && safeProposal.cobExpenditures === "Capital Outlay" && renderCapitalOutlayDetails()}
          {safeProposal.cobExpenditures && safeProposal.cobExpenditures === "Income" && renderIncomeDetails()}
          
          {(!safeProposal.cobExpenditures || !detailedData) && (
            <Alert severity="info">
              No detailed information available for this proposal.
            </Alert>
          )}
        </>
      )}
    </Paper>
  );
};

export default ProposalDetails;
