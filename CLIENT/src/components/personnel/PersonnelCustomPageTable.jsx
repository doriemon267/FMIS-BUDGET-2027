import React, { useState, useEffect } from "react";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "../personnel/PersonnelCustomTable";
import PropTypes from "prop-types";
import { Button, Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CircularProgress, MenuItem, Select, FormControl, InputLabel, Typography, Alert } from "@mui/material";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../../config/api";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import ActiveRegionDisplay from "../common/ActiveRegionDisplay";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDataList } from "../../utils/queryClientHelpers";

const CustomPageTable = ({
  dataListName,
  schema,
  title = "",
  description = "",
  searchable = true,
  hasEdit = true,
  hasDelete = true,
  hasAdd = true,
  customAddElement = null,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
}) => {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusLabel, setStatusLabel] = useState(localStorage.getItem("statusLabel") || "");
  const pageTitle = title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage ${dataListName}`;
  const apiPath = `/${dataListName}`;
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  // Get the active region
  const { activeRegion } = useRegion();
  const [regionFilter, setRegionFilter] = useState("");
  
  // Update region filter when active region changes
  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      setRegionFilter(regionName);
    } else {
      setRegionFilter("");
    }
  }, [activeRegion]);
  
  const fetchData = async () => {
    try {
      // Include region filter in the API request
      const params = {};
      if (regionFilter) {
        params.region = regionFilter;
      }
      
      const response = await api.get(apiPath, { params });
      if (response.data && Array.isArray(response.data.personnelServices)) {
        setRows(response.data.personnelServices);
        setFilteredRows(response.data.personnelServices);
      } else {
        console.error("Fetched data is not an array:", response.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [apiPath, regionFilter]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000); // Refresh data every 30 seconds
    return () => clearInterval(interval);
  }, [apiPath]);

  useEffect(() => {
    setFilteredRows(rows);
  }, [rows]);

  const handleAddAllPersonnel = async () => {
    setLoading(true);
    try {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      
      // Get active region from localStorage
      let region = null;
      try {
        const activeRegionStr = localStorage.getItem('activeRegion');
        if (activeRegionStr) {
          const activeRegion = JSON.parse(activeRegionStr);
          region = activeRegion.name || activeRegion.regionName;
        }
      } catch (error) {
        console.error('Error parsing active region:', error);
      }
      
      const response = await api.post(`/personnelServices/bulk-add`, {
        processBy, 
        statusOfAppointment: selectedStatus,
        region // Include the active region in the request
      });

      if (response.data.added && Array.isArray(response.data.added)) {
        const addedCount = response.data.added.length;
        const duplicateCount = response.data.duplicates ? response.data.duplicates.length : 0;
        
        if (addedCount > 0) {
          toast.success(`Successfully added ${addedCount} personnel${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''}!`);
        } else if (duplicateCount > 0) {
          toast.warning(`No new personnel added. ${duplicateCount} employees already exist in the system.`);
        } else {
          toast.info(response.data.message || "No personnel services to add.");
        }
        
    const newStatusLabel = `Personnel Services - ${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1).toLowerCase()}`;
        setStatusLabel(newStatusLabel);
        localStorage.setItem("statusLabel", newStatusLabel);

    await fetchData();
    await invalidateDataList(queryClient, dataListName);
      } else if (response.data.message) {
        toast.info(response.data.message);
        console.error("Bulk add response:", response.data);
      } else {
        toast.info("Bulk add completed");
        console.error("Bulk add response is not in expected format:", response.data);
      }
    } catch (error) {
      console.error("Error bulk adding personnel:", error);
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value);
  };

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center">
          <Button variant="contained" color="primary" onClick={handleOpenDialog} sx={{ mr: 2 }}>
            Add All Personnel
          </Button>
          {statusLabel && (
            <Typography variant="subtitle1" color="textSecondary" sx={{ ml: 2 }}>
              {statusLabel}
            </Typography>
          )}
        </Box>
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Confirm Bulk Add</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select the status of appointment for the personnel to be added:
          </DialogContentText>
          <FormControl variant="outlined" fullWidth>
            <InputLabel id="status-select-label">Status of Appointment</InputLabel>
            <Select
              labelId="status-select-label"
              value={selectedStatus}
              onChange={handleStatusChange}
              label="Status of Appointment"
            >
              <MenuItem value="PERMANENT">PERMANENT</MenuItem>
              <MenuItem value="CASUAL">CASUAL</MenuItem>
              <MenuItem value="COS">COS</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAddAllPersonnel} color="primary" autoFocus>
            {loading ? <CircularProgress size={24} /> : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>


      <CustomTable
        ROWS_PER_PAGE={ROWS_PER_PAGE}
        dataListName={dataListName}
        apiPath={apiPath}
        rows={filteredRows} // Pass filtered rows to the table
        columns={Object.keys(schema)
          .filter((key) => schema[key].show === true || key === "action")
          .map((key) => {
            const fieldSchema = schema[key];
            const column = {
              field: key,
              label: fieldSchema.label,
              type: fieldSchema.type,
              searchable: fieldSchema.searchable || false,
              textAlign: fieldSchema.alignRight ? "right" : "left", 
            };

            if (fieldSchema.type === "action") {
              column.render = (row) => (
                <CustomMenu
                  additionalMenuOptions={additionalMenuOptions}
                  customEditElement={customEditElement}
                  hasEdit={hasEdit}
                  hasDelete={hasDelete}
                  row={row}
                  schema={schema}
                  endpoint={apiPath}
                  dataListName={dataListName}
                />
              );
            }

            if (fieldSchema.customRender) {
              column.render = (row) => fieldSchema.customRender(row);
            }

            return column;
          })}
      />
    </>
  );
};

CustomPageTable.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      show: PropTypes.bool,
      searchable: PropTypes.bool,
      customRender: PropTypes.func,
      default: PropTypes.any,
      alignRight: PropTypes.bool, 
    })
  ).isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.array,
  ROWS_PER_PAGE: PropTypes.number,
};

export default CustomPageTable;