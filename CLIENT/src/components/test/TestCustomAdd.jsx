import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
} from "@mui/material";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";
import { toast } from "react-hot-toast";

const importModules = [
  { key: "categories", label: "Categories", endpoint: "/uploadcategories" },
  { key: "coa", label: "Chart of Accounts", endpoint: "/uploadcoa" },
  { key: "departments", label: "Departments", endpoint: "/uploaddepartments" },
  { key: "positionTitles", label: "Position Titles", endpoint: "/uploadpositiontitles" },
  { key: "ratas", label: "RATAs", endpoint: "/uploadratas" },
  { key: "regions", label: "Regions", endpoint: "/uploadregions" },
  { key: "salaryGrades", label: "Salary Grades", endpoint: "/uploadgrades" },
  { key: "statuses", label: "Statuses", endpoint: "/uploadstatus" },
];

const AddTestDialog = ({ parentClose }) => {
  const [loading, setLoading] = useState(false);
  const [openModule, setOpenModule] = useState(null); // key of module being imported
  const [selectedFile, setSelectedFile] = useState(null);

  const handleOpen = (moduleKey) => {
    setSelectedFile(null);
    setOpenModule(moduleKey);
  };
  const handleClose = () => setOpenModule(null);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    setLoading(true);
    const { endpoint, label } = importModules.find(m => m.key === openModule);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${label}: ${res.data.message}`);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error || `${label} upload failed`);
    } finally {
      setLoading(false);
    }
  };

  const current = importModules.find(m => m.key === openModule);

  return (
    <div>
      <Box display="flex" flexWrap="wrap" gap={2}>
        {importModules.map((m) => (
          <Button
            key={m.key}
            variant="contained"
            color="secondary"
            size="large"
            onClick={() => handleOpen(m.key)}
          >
            {m.label}
          </Button>
        ))}
      </Box>

      <Dialog open={!!openModule} onClose={handleClose}>
        <DialogTitle>
          Import {current?.label}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            Upload an Excel file to import {current?.label.toLowerCase()}.
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
        </DialogContent>
        <DialogActions>
          <CustomButton
            loading={loading}
            plain
            color="error"
            onClick={handleClose}
          >
            Cancel
          </CustomButton>
          <CustomButton
            loading={loading}
            onClick={handleUpload}
          >
            Upload
          </CustomButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AddTestDialog;
