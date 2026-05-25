import React, { useState } from "react";
import AddSettingsDialog from "../components/settings/AddSettingsDialog";
import DatabaseBackupSettingsDialog from "../components/settings/DatabaseBackupSettingsDialog";
import ProposalActionsButton from "../global/components/ProposalActionsButton";
import CustomPage from "../global/components/CustomPage";
import { Button, Box, Typography, Card, CardContent, Grid } from "@mui/material";
import { Storage, Settings, Add, Security } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);

  const handleOpenAddDialog = () => setIsAddDialogOpen(true);
  const handleCloseAddDialog = () => setIsAddDialogOpen(false);
  const handleOpenBackupDialog = () => setIsBackupDialogOpen(true);
  const handleCloseBackupDialog = () => setIsBackupDialogOpen(false);

  const settingsSchema = {
    action: {
      type: "action",
      label: "Actions",
      customRender: (row) => <ProposalActionsButton row={row} />,
    },
    fiscalYear: {
      type: "Text",
      label: "Fiscal Year",
      required: true,
      unique: true,
      searchable: true,
      show: true,
    },
    hazardPay: { type: "number", label: "Hazard Pay", default: 0, show: true },
    subsistenceAllowance: {
      type: "number",
      label: "Subsistence Allowance",
      default: 0,
      show: true,
    },
    honoraria: { type: "number", label: "Honoraria", default: 0, show: true },
    // RATA: {
    //   type: "array",
    //   label: "RATA",
    //   default: [],
    //   show: true,
    //   customRender: (row) => (
    //     <ul>
    //       {row.RATA.map((rata, index) => (
    //         <li key={index}>
    //           SG: {rata.grade}, RATA: {rata.amount}
    //         </li>
    //       ))}
    //     </ul>
    //   ),
    // },
    PERA: { type: "number", label: "PERA", default: 0, show: true },
    uniformAllowance: {
      type: "number",
      label: "Uniform Allowance",
      default: 0,
      show: true,
    },
    productivityIncentive: {
      type: "number",
      label: "Productivity Incentive",
      default: 0,
      show: true,
    },
    medicalAllowance: {
      type: "number",
      label: "Medical Allowance",
      default: 0,
      show: true,
    },
    childrenAllowance: {
      type: "number",
      label: "Children Allowance",
      default: 0,
      show: true,
    },
    meal: { type: "number", label: "Meal", default: 0, show: true },
    cashGift: { type: "number", label: "Cash Gift", default: 0, show: true },
    gsisPremium: {
      type: "number",
      label: "GSIS Premium",
      default: 0,
      show: true,
    },
    philhealthPremium: {
      type: "number",
      label: "PhilHealth Premium",
      default: 0,
      show: true,
    },
    pagibigPremium: {
      type: "number",
      label: "Pag-IBIG Premium",
      default: 0,
      show: true,
    },
    employeeCompensation: {
      type: "number",
      label: "Employee Compensation",
      default: 0,
      show: true,
    },
    earnedLeaves: {
      type: "number",
      label: "Earned Leaves",
      default: 0,
      show: true,
    },
    retirementBenefits: {
      type: "number",
      label: "Retirement Benefits",
      default: 0,
      show: true,
    },
    terminalLeave: {
      type: "number",
      label: "Terminal Leave",
      default: 0,
      show: true,
    },
    courtAppearance: {
      type: "number",
      label: "Court Appearance",
      default: 0,
      show: true,
    },
    isActive: {
      type: "boolean",
      label: "Active Fiscal Year",
      default: false,
      show: true,
    },
    createdAt: { type: "date", label: "Created At", show: true },
  };

  return (
    <>
      {/* Quick Settings Actions */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={2}>
          <Settings color="primary" />
          System Settings
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Add color="primary" />
                  <Typography variant="h6">Fiscal Year Settings</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Manage fiscal year settings and allowances
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleOpenAddDialog}
                  fullWidth
                >
                  Add New Settings
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Storage color="primary" />
                  <Typography variant="h6">Database Backup</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Manage database backups and schedules
                </Typography>
                <Button
                  variant="outlined"
                  onClick={handleOpenBackupDialog}
                  fullWidth
                >
                  Backup Settings
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Security color="primary" />
                  <Typography variant="h6">Route Permissions</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Manage dynamic access control for system routes
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/route-permissions")}
                  fullWidth
                >
                  Manage Permissions
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <CustomPage
        dataListName="settings"
        schema={settingsSchema}
        hasEdit={false}
        customAddElement={
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenAddDialog}
            startIcon={<Add />}
          >
            Add Settings
          </Button>
        }
      />
      
      {isAddDialogOpen && (
        <AddSettingsDialog
          open={isAddDialogOpen}
          onCloseDialog={handleCloseAddDialog}
        />
      )}
      
      {isBackupDialogOpen && (
        <DatabaseBackupSettingsDialog
          open={isBackupDialogOpen}
          onClose={handleCloseBackupDialog}
        />
      )}
    </>
  );
};

export default SettingsPage;
