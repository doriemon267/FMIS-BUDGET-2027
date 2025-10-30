import React, { useState } from "react";
import { Box, Button, Stack, Tabs, Tab } from "@mui/material";
import DashboardHeader from "../global/components/DashboardHeader";
import GroupedIncomeCategoriesTable from "../components/incomecategories/GroupedIncomeCategoriesTable";
import CreateCategoryGroupDialog from "../components/incomecategories/CreateCategoryGroupDialog";
import EnhancedIncomeCategoriesDialog from "../components/incomecategories/EnhancedIncomeCategoriesDialog";
import PropTypes from "prop-types";
import AddIcon from "@mui/icons-material/Add";

const GroupedIncomeCategoryPage = ({
  dataListName = "income-categories",
  schema = {
    incomeCategoryName: {
      label: "Category Name",
      type: "text",
      show: true,
      searchable: true,
    },
    description: {
      label: "Description",
      type: "text",
      show: true,
    },
  },
  title = "INCOME CATEGORIES",
  description = "",
  ROWS_PER_PAGE = 20,
}) => {
  const [openGroupDialog, setOpenGroupDialog] = useState(false);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleGroupDialogClose = () => {
    setOpenGroupDialog(false);
  };

  const handleCategoryDialogClose = () => {
    setOpenCategoryDialog(false);
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <DashboardHeader
        title={title}
        description={description || "Manage grouped income categories and fiscal year links"}
        searchable={false}
      />

      {/* Tabs for View Mode */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, pt: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="view modes">
          <Tab label="Grouped View" />
          <Tab label="Manage Groups" />
        </Tabs>
      </Box>

      {/* Grouped View Tab */}
      {tabValue === 0 && (
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpenGroupDialog(true)}
            >
              New Group
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<AddIcon />}
              onClick={() => setOpenCategoryDialog(true)}
            >
              Add Category
            </Button>
          </Stack>

          {/* Grouped Categories Table */}
          <GroupedIncomeCategoriesTable
            key={refreshTrigger}
            dataListName={dataListName}
            schema={schema}
            onRefresh={handleRefresh}
            ROWS_PER_PAGE={ROWS_PER_PAGE}
          />
        </Box>
      )}

      {/* Dialogs */}
      <CreateCategoryGroupDialog
        open={openGroupDialog}
        onClose={handleGroupDialogClose}
        onSuccess={handleRefresh}
      />

      <EnhancedIncomeCategoriesDialog
        open={openCategoryDialog}
        onClose={handleCategoryDialogClose}
        onSuccess={handleRefresh}
      />
    </>
  );
};

GroupedIncomeCategoryPage.propTypes = {
  dataListName: PropTypes.string,
  schema: PropTypes.object,
  title: PropTypes.string,
  description: PropTypes.string,
  ROWS_PER_PAGE: PropTypes.number,
};

export default GroupedIncomeCategoryPage;