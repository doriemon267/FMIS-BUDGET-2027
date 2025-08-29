import { yupResolver } from "@hookform/resolvers/yup";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Typography,
  TextField,
  Autocomplete,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "react-hot-toast";
import { FaEdit } from "react-icons/fa";
import * as yup from "yup";
import api from "../../config/api";
import CustomButton from "../../global/components/CustomButton";
import CustomTextField from "../../global/components/CustomTextField";
import { formatLabel } from "../../utils/formatLabel";

const IncomeCategoriesCustomCreateUpdateDialog = ({
  schema = {},
  row,
  endpoint,
  parentClose,
  dataListName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isEditMode = Boolean(row);
  const queryClient = useQueryClient();

  // ✅ Guard against empty schema
  if (!schema || Object.keys(schema).length === 0) return null;

  // ✅ Generate Yup validation schema from schema config
  const validationSchema = yup.object(
    Object.keys(schema).reduce((acc, key) => {
      const field = schema[key];

      if (field.type === "text" && field.required) {
        acc[key] = yup.string().required(`${field.label} is required`);
      } else if (field.type === "number") {
        acc[key] = yup
          .number()
          .min(0, `${field.label} must be a positive number`);
      } else if (field.type === "boolean") {
        acc[key] = yup.boolean().default(field.default ?? false);
      } else if (field.type === "multi-select") {
        acc[key] = yup.array().of(yup.string());
      } else if (field.type === "array") {
        acc[key] = yup.array().of(yup.string());
      } else {
        acc[key] = yup.string().optional();
      }

      return acc;
    }, {})
  );

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: isEditMode
      ? {
          ...row,
          // Ensure arrays are properly handled for editing
          ...Object.keys(schema).reduce((acc, key) => {
            if (schema[key].type === "array" || schema[key].type === "multi-select") {
              // Handle both field names for backward compatibility
              if (key === "incomeSubcategories") {
                acc[key] = row.incomeSubcategories || row.incomeSubcategoryName || [];
              } else {
                acc[key] = Array.isArray(row[key]) ? row[key] : [];
              }
            }
            return acc;
          }, {})
        }
      : Object.keys(schema).reduce((acc, key) => {
          acc[key] =
            schema[key].default ??
            (schema[key].type === "multi-select" || schema[key].type === "array" ? [] : "");
          return acc;
        }, {}),
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      return isEditMode
        ? await api.put(`${endpoint}/${row._id}`, data)
        : await api.post(endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([dataListName]);
      toast.success(isEditMode ? "Updated successfully" : "Created successfully");
      handleClose();
      if (parentClose) parentClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Error occurred");
    },
  });

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    if (parentClose) parentClose();
  };

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  const label = formatLabel(dataListName);

 // ✅ This stays outside — always render buttons
return (
    <div>
      {!row ? (
        <CustomButton onClick={handleOpen}>Add Title</CustomButton>
      ) : (
        <MenuItem
          onClick={handleOpen}
          disableRipple
          sx={{ display: "flex", gap: 1 }}
        >
          <FaEdit />
          Edit
        </MenuItem>
      )}
  
      {/* ✅ Only guard inside the dialog */}
      <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        {(!schema || Object.keys(schema).length === 0) ? (
          <DialogContent>
            <Typography>Loading form fields...</Typography>
          </DialogContent>
        ) : (
          <>
            <DialogTitle>
              {isEditMode ? "Edit Entry" : "Add New Entry"}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" gutterBottom mb={2}>
                {isEditMode
                  ? "Update the details below."
                  : "Provide details below."}
              </Typography>
  
              {Object.keys(schema).map((key) => {
                const field = schema[key];
  
                if (
                  field.type === "action" ||
                  key === "createdAt" ||
                  key === "updatedAt"
                ) return null;
  
                if (field.type === "multi-select") {
                  return (
                    <Controller
                      key={key}
                      name={key}
                      control={control}
                      render={({ field: controllerField }) => (
                        <Autocomplete
                          multiple
                          disableCloseOnSelect
                          options={field.options || []}
                          getOptionLabel={(option) =>
                            typeof option === "string" ? option : option.label
                          }
                          value={(controllerField.value || []).map((val) =>
                            typeof val === "string"
                              ? { label: val, value: val }
                              : val
                          )}
                          onChange={(e, newValue) => {
                            controllerField.onChange(
                              newValue.map((val) => val.value)
                            );
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={field.label}
                              placeholder="Select items"
                              sx={{ mb: 2 }}
                            />
                          )}
                        />
                      )}
                    />
                  );
                }

                if (field.type === "array") {
                  return (
                    <Controller
                      key={key}
                      name={key}
                      control={control}
                      render={({ field: controllerField }) => (
                        <Autocomplete
                          multiple
                          freeSolo
                          options={[]} // Allow free text input
                          value={controllerField.value || []}
                          onChange={(event, newValue) => {
                            controllerField.onChange(newValue);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={field.label}
                              placeholder="Type and press Enter to add items"
                              helperText={field.helperText || "Enter items and press Enter to add them"}
                              sx={{ mb: 2 }}
                            />
                          )}
                        />
                      )}
                    />
                  );
                }
  
                return (
                  <CustomTextField
                    key={key}
                    control={control}
                    fieldName={key}
                    label={field.label}
                    type={field.type}
                    required={!!field.required}
                    row={3}
                    multiline={field.type === "textarea"}
                    sx={{ mb: 2 }}
                  />
                );
              })}
            </DialogContent>
            <DialogActions>
              <CustomButton plain color="error" onClick={handleClose}>
                Cancel
              </CustomButton>
              <CustomButton
                loading={mutation.isLoading}
                allow={isEditMode && !isDirty}
                onClick={handleSubmit(onSubmit)}
              >
                {isEditMode ? "Update" : "Add"}
              </CustomButton>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
  
};

export default IncomeCategoriesCustomCreateUpdateDialog;
