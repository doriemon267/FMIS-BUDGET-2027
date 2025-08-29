import { yupResolver } from "@hookform/resolvers/yup";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
  Button,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { IoMdAdd } from "react-icons/io";
import { FaEdit } from "react-icons/fa";
import * as yup from "yup";
import api from "../../config/api";
import CustomButton from "../../global/components/CustomButton";

const schema = yup.object().shape({
  title: yup.string().required("Title is required"),
  description: yup.string().optional(),
  likes: yup.number().min(0, "Likes must be a positive number"),
  isPublish: yup.boolean().default(true),
});

const CreateUpdateTestDialog = ({ row, parentClose }) => {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isEditMode = Boolean(row);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data) => {
      setLoading(true);
      try {
        const res = isEditMode
          ? await api.put(`/editTest/${row._id}`, data)
          : await api.post("/addTest", data);
        return res.data.message;
      } catch (e) {
        toast.error(e.response?.data?.error || "Error occurred", {
          duration: 4000,
        });
        throw e;
      } finally {
        setLoading(false);
      }
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: isEditMode
      ? row
      : { title: "", description: "", likes: 0, isPublish: true },
  });

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const onSubmit = async (data) => {
    mutation.mutate(data, {
      onSuccess: (message) => {
        queryClient.invalidateQueries(["tests", 0]);
        toast.success(message, { duration: 4000 });
        handleClose();
        if (parentClose) parentClose();
      },
    });
  };

  return (
    <div>
      {isEditMode ? (
        <MenuItem
          onClick={handleOpen}
          disableRipple
          sx={{ display: "flex", gap: 1 }}
        >
          <FaEdit /> Edit
        </MenuItem>
      ) : (
        <Button
          variant="contained"
          size="large"
          onClick={handleOpen}
          aria-label="Add new test"
          startIcon={<IoMdAdd />}
        >
          Add Test
        </Button>
      )}

      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>{isEditMode ? "Edit Test" : "Add New Test"}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom mb={2}>
            {isEditMode
              ? "Update the details below to edit the test entry."
              : "Provide the details below to add a new test."}
          </Typography>

          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                sx={{ mb: 2 }}
                size="small"
                {...field}
                label="Title"
                fullWidth
                error={!!errors.title}
                helperText={errors.title?.message}
                required
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                sx={{ mb: 2 }}
                size="small"
                {...field}
                label="Description"
                fullWidth
                multiline
                rows={3}
              />
            )}
          />

          <Controller
            name="likes"
            control={control}
            render={({ field }) => (
              <TextField
                sx={{ mb: 2 }}
                size="small"
                {...field}
                label="Likes"
                type="number"
                fullWidth
                error={!!errors.likes}
                helperText={errors.likes?.message}
              />
            )}
          />

          <Controller
            name="isPublish"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value} />}
                label="Publish"
              />
            )}
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

export default CreateUpdateTestDialog;
