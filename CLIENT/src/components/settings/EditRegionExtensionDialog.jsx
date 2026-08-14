import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Box,
  Typography,
  CircularProgress,
  useTheme
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { toast } from "react-hot-toast";
import { MdExtension } from "react-icons/md";
import api from "../../config/api";

/**
 * Dialog to edit an existing region due date extension.
 */
const EditRegionExtensionDialog = ({ open, onClose, settingsRow, extensionToEdit, onSuccess }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [selectedRegions, setSelectedRegions] = useState([]);

  // Regions in OTHER extensions (exclude current one being edited) - for duplicate check
  const regionsInOtherExtensions = React.useMemo(() => {
    const exts = settingsRow?.regionDueDateExtensions || [];
    const currentIds = (extensionToEdit?.regions || []).map((r) => String(r));
    return new Set(
      exts
        .filter((e) => String(e._id) !== String(extensionToEdit?._id))
        .flatMap((e) => (e.regions || []).map((r) => String(r)))
    );
  }, [settingsRow?.regionDueDateExtensions, extensionToEdit]);

  const { data: regionsData = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const response = await api.get("/api/regions");
      const regions = Array.isArray(response.data)
        ? response.data
        : response.data?.regions || [];
      return regions.map((region) => ({
        id: region._id || region.id || region.regionId || region.Region || region.regionName || region.name,
        name: region.regionName || region.Region || region.name
      }));
    },
    enabled: open
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      dueDate: "",
      label: ""
    }
  });

  useEffect(() => {
    if (open && extensionToEdit) {
      setSelectedRegions((extensionToEdit.regions || []).map((r) => String(r)));
      const d = extensionToEdit.dueDate ? new Date(extensionToEdit.dueDate).toISOString().split("T")[0] : "";
      reset({ dueDate: d, label: extensionToEdit.label || "" });
    }
  }, [open, extensionToEdit, reset]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        regions: selectedRegions,
        dueDate: data.dueDate,
        label: data.label || undefined
      };
      await api.put(
        `/settings/${settingsRow._id}/region-extension/${extensionToEdit._id}`,
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Region due date extension updated.");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "Failed to update region extension.";
      toast.error(msg);
    }
  });

  const handleClose = () => {
    onClose();
  };

  const handleRegionChange = (event) => {
    const value = event.target.value;
    setSelectedRegions(typeof value === "string" ? value.split(",") : value);
  };

  if (!extensionToEdit) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "white",
          py: 2
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MdExtension />
          <Typography variant="h6" fontWeight="bold">
            Edit Region Due Date Extension
          </Typography>
        </Box>
        {settingsRow && (
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            FY {settingsRow.fiscalYear} · {settingsRow.budgetType}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Update the extended due date or region(s) for this extension.
        </Typography>

        <Box component="form" onSubmit={handleSubmit((data) => mutation.mutate(data))} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth error={selectedRegions.length === 0 && mutation.isError}>
            <InputLabel>Regions</InputLabel>
            <Select
              multiple
              value={selectedRegions}
              onChange={handleRegionChange}
              renderValue={(v) => v.map((id) => regionsData.find((r) => r.id === id)?.name || id).join(", ")}
              label="Regions"
            >
              {regionsData.filter((r) => r.id !== "All").map((region) => {
                const inOtherExtension = regionsInOtherExtensions.has(String(region.id));
                return (
                  <MenuItem key={region.id} value={region.id} disabled={inOtherExtension}>
                    <Checkbox checked={selectedRegions.indexOf(region.id) > -1} disabled={inOtherExtension} />
                    <ListItemText primary={region.name} secondary={inOtherExtension ? "Already in another extension" : null} />
                  </MenuItem>
                );
              })}
            </Select>
            {selectedRegions.length === 0 && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                Select at least one region
              </Typography>
            )}
          </FormControl>
          <Controller
            name="dueDate"
            control={control}
            rules={{ required: "Due date is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Extended due date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                error={!!errors.dueDate}
                helperText={errors.dueDate?.message}
              />
            )}
          />
          <Controller
            name="label"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Label (optional)" fullWidth placeholder="e.g. Extension for Region X" />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleSubmit((data) => {
            if (selectedRegions.length === 0) {
              toast.error("Select at least one region.");
              return;
            }
            mutation.mutate(data);
          })}
          disabled={mutation.isPending || selectedRegions.length === 0}
          startIcon={mutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {mutation.isPending ? "Saving..." : "Update extension"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditRegionExtensionDialog;
