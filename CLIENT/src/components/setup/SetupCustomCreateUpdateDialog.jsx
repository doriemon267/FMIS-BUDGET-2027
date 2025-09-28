import { yupResolver } from "@hookform/resolvers/yup";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  Box,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "react-hot-toast";
import { FaEdit } from "react-icons/fa";
import * as yup from "yup";
import api from "../../config/api";
import CustomButton from "../../global/components/CustomButton";
import CustomTextField from "../../global/components/CustomTextField";
import { formatLabel } from "../../utils/formatLabel";

const CustomCreateUpdateDialog = ({
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
      } else if (schema[key].type === "array") {
        acc[key] = yup.array().of(
          yup.object().shape({
            fromDate: yup.date().required("From Date is required"),
            toDate: yup.date().required("To Date is required"),
            isFinished: yup.boolean().default(false),
          })
        );
      } else {
        acc[key] = yup.string().optional();
      }
      return acc;
    }, {})
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "deadlines",
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
  const currentYear = watch("currentYear");

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

          <Box mb={2}>
            <Typography variant="h6">Deadlines</Typography>
            {fields.map((item, index) => (
              <Box key={item.id} mb={2}>
                <CustomTextField
                  control={control}
                  fieldName={`deadlines[${index}].fromDate`}
                  label="From Date"
                  type="date"
                  required
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <CustomTextField
                  control={control}
                  fieldName={`deadlines[${index}].toDate`}
                  label="To Date"
                  type="date"
                  required
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={item.isFinished}
                      onChange={(e) =>
                        setValue(
                          `deadlines[${index}].isFinished`,
                          e.target.checked
                        )
                      }
                    />
                  }
                  label="Is Finished"
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => remove(index)}
                  fullWidth
                >
                  Remove Deadline
                </Button>
              </Box>
            ))}
            <Button
              variant="contained"
              onClick={() =>
                append({ fromDate: "", toDate: "", isFinished: false })
              }
              fullWidth
            >
              Add Deadline
            </Button>
          </Box>

          <CustomTextField
            control={control}
            fieldName="proposalType"
            label="Proposal Type"
            select
            required
            fullWidth
            sx={{ mb: 2 }}
          >
            <MenuItem value="Initial">Initial</MenuItem>
            <MenuItem value="NEP">NEP</MenuItem>
            <MenuItem value="GAA">GAA</MenuItem>
          </CustomTextField>

          <CustomTextField
            control={control}
            fieldName="year"
            label="Year"
            select
            required
            fullWidth
            sx={{ mb: 2 }}
          >
            {(() => {
              // Generate dynamic fiscal years: current year - 1 to current year + 3
              const currentYear = new Date().getFullYear();
              const fiscalYears = [];
              for (let i = -1; i <= 3; i++) {
                fiscalYears.push(currentYear + i);
              }
              return fiscalYears.map((year) => (
                <MenuItem key={year} value={String(year)}>
                  {year}
                </MenuItem>
              ));
            })()}
          </CustomTextField>

          <FormControlLabel
            control={
              <Switch
                checked={currentYear}
                onChange={(e) =>
                  setValue("currentYear", e.target.checked)
                }
              />
            }
            label="Current Year"
            sx={{ mb: 2 }}
          />
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

export default CustomCreateUpdateDialog;