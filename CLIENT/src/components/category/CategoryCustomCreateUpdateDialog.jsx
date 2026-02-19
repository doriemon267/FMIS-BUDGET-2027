import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Typography,
  TextField,
  Autocomplete,
  useTheme,
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

const CategoryCustomCreateUpdateDialog = ({
  schema = {},
  row,
  endpoint,
  parentClose,
  dataListName,
  trigger,
}) => {
  const theme = useTheme();
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
      ? row
      : Object.keys(schema).reduce((acc, key) => {
          acc[key] =
            schema[key].default ??
            (schema[key].type === "multi-select" ? [] : "");
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

  const addTrigger = !row && trigger ? (
    <Box component="span" onClick={handleOpen} sx={{ display: "inline-flex", cursor: "pointer" }}>
      {trigger}
    </Box>
  ) : null;

  return (
    <div>
      {!row ? (trigger ? addTrigger : <CustomButton onClick={handleOpen}>ADD</CustomButton>) : (
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
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px" } }}
      >
        {(!schema || Object.keys(schema).length === 0) ? (
          <DialogContent>
            <Typography>Loading form fields...</Typography>
          </DialogContent>
        ) : (
          <>
            <DialogTitle
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                color: "white",
                py: 2.5,
              }}
            >
              {isEditMode ? "Edit Category" : "Add New Category"}
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

export default CategoryCustomCreateUpdateDialog;
