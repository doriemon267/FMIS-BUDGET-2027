import React, { useState } from "react";
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
  useTheme,
  alpha
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { toast } from "react-hot-toast";
import { MdDateRange, MdExtension } from "react-icons/md";
import api from "../../config/api";

/**
 * Dialog to add a region-specific due date extension for an existing cutoff (same FY + budget type).
 * Used when you want to extend the due date for specific region(s) only.
 */
const AddRegionExtensionDialog = ({ open, onClose, settingsRow, onSuccess }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [selectedRegions, setSelectedRegions] = useState([]);

  // Regions already assigned to extensions (for display and to avoid duplicates)
  const regionsInExtensions = React.useMemo(() => {
    const exts = settingsRow?.regionDueDateExtensions || [];
    return new Set(exts.flatMap((e) => (e.regions || []).map((r) => String(r))));
  }, [settingsRow?.regionDueDateExtensions]);

  const { data: regionsData = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const response = await api.get("/api/regions");
      return [
        ...(response.data || []).map((region) => ({
          id: region._id || region.Region,
          name: region.Region
        }))
      ];
    },
    enabled: open
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      dueDate: "",
      label: ""
    }
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        regions: selectedRegions,
        dueDate: data.dueDate,
        label: data.label || undefined
      };
      const response = await api.post(`/settings/${settingsRow._id}/region-extension`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["settings"]);
      toast.success("Region due date extension added.");
      reset();
      setSelectedRegions([]);
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "Failed to add region extension.";
      toast.error(msg);
    }
  });

  const handleClose = () => {
    reset();
    setSelectedRegions([]);
    onClose();
  };

  const handleRegionChange = (event) => {
    const value = event.target.value;
    setSelectedRegions(typeof value === "string" ? value.split(",") : value);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          color: "white",
          py: 2
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MdExtension />
          <Typography variant="h6" fontWeight="bold">
            Add Region Due Date Extension
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
          Set an extended due date for specific region(s). Submissions from these regions will use this date instead of the main cutoff.
        </Typography>

        {regionsInExtensions.size > 0 && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              Regions already in extensions
            </Typography>
            <Typography variant="body2">
              {regionsData
                .filter((r) => regionsInExtensions.has(String(r.id)))
                .map((r) => r.name)
                .join(", ") || Array.from(regionsInExtensions).join(", ")}
            </Typography>
          </Box>
        )}

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
                const alreadyInExtension = regionsInExtensions.has(String(region.id));
                return (
                  <MenuItem key={region.id} value={region.id} disabled={alreadyInExtension}>
                    <Checkbox checked={selectedRegions.indexOf(region.id) > -1} disabled={alreadyInExtension} />
                    <ListItemText primary={region.name} secondary={alreadyInExtension ? "Already in extension" : null} />
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
          {mutation.isPending ? "Saving..." : "Add extension"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRegionExtensionDialog;
