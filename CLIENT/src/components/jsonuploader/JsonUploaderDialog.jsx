import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { toast } from "react-toastify";
import CustomButton from "../../global/components/CustomButton";
import api from "../../config/api";

const JsonUploaderDialog = ({ open, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [targetCollection, setTargetCollection] = useState("");
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Fetch available collections from the server
  useEffect(() => {
    const fetchCollections = async () => {
      if (open) {
        setLoadingCollections(true);
        try {
          const response = await api.get("/available-models");
          setCollections(response.data.map(model => ({
            value: model,
            label: model
          })));
        } catch (error) {
          toast.error("Failed to load available collections");
          console.error("Error fetching collections:", error);
        } finally {
          setLoadingCollections(false);
        }
      }
    };

    fetchCollections();
  }, [open]);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    
    if (!targetCollection) {
      toast.error("Please select a target collection");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await api.post(`/uploadjson?collection=${targetCollection}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${res.data.message} Inserted: ${res.data.stats.inserted}, Updated: ${res.data.stats.updated}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "JSON upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import JSON Data</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          Upload a JSON file to import data into the selected collection.
        </Typography>
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Target Collection</InputLabel>
          {loadingCollections ? (
            <CircularProgress size={24} sx={{ mt: 2, ml: 2 }} />
          ) : (
            <Select
              value={targetCollection}
              onChange={(e) => setTargetCollection(e.target.value)}
              label="Target Collection"
            >
              {collections.map((collection) => (
                <MenuItem key={collection.value} value={collection.value}>
                  {collection.label}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
        
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ marginTop: 16 }}
        />
      </DialogContent>
      <DialogActions>
        <CustomButton
          loading={loading}
          plain
          color="error"
          onClick={onClose}
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
  );
};

export default JsonUploaderDialog;
