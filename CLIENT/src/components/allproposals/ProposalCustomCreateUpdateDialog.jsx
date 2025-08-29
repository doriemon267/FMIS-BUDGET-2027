import { yupResolver } from "@hookform/resolvers/yup";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { FaEdit } from "react-icons/fa";
import * as yup from "yup";
import api from "../../config/api";
import CustomButton from "../../global/components/CustomButton";
import CustomTextField from "../../global/components/CustomTextField";
import { formatLabel } from "../../utils/formatLabel";

const ProposalCustomCreateUpdateDialog = ({
  schema,
  row,
  endpoint,
  parentClose,
  dataListName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isEditMode = Boolean(row);
  const queryClient = useQueryClient();

  // Convert schema to Yup validation dynamically
  const validationSchema = yup.object(
    Object.keys(schema).reduce((acc, key) => {
      if (schema[key].type === "text" && schema[key].required) {
        acc[key] = yup.string().required(`${schema[key].label} is required`);
      } else if (schema[key].type === "number") {
        acc[key] = yup
          .number()
          .min(0, `${schema[key].label} must be a positive number`);
      } else if (schema[key].type === "boolean") {
        acc[key] = yup.boolean().default(schema[key].default ?? false);
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
          acc[key] = schema[key].default ?? "";
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
      toast.success(
        isEditMode ? "Updated successfully" : "Created successfully"
      );
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

  return (
    <div>
      {!row ? (
        <CustomButton onClick={handleOpen}>Add {label}</CustomButton>
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

      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>{isEditMode ? "Edit Entry" : "Add New Entry"}</DialogTitle>
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
            )
              return null; // Skip non-renderable / action fields

            return field.type === "date" ? (
              <CustomTextField
                key={key}
                control={control}
                fieldName={key}
                label={field.label}
                type={field.type}
                required={!!field.required}
                row={3}
                InputLabelProps={{ shrink: true }}
                multiline={field.type === "textarea"}
                sx={{ mb: 2 }}
              />
            ) : (
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
      </Dialog>
    </div>
  );
};

export default ProposalCustomCreateUpdateDialog;
