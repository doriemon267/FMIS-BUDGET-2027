import { yupResolver } from '@hookform/resolvers/yup';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as yup from 'yup';
import { IoMdAdd } from "react-icons/io";
import api from '../../config/api';

// Validation schema using Yup
const schema = yup.object().shape({
    name: yup.string().required('Role Name is required'),
    permission: yup.string().required('Permissions are required'),
});

const CustomDialogForm = () => {
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data) => {
            setLoading(true);
            try {
                const res = await api.post('/create-role', data);
                return res.data.message;
            } catch (e) {
                toast.error(e.response.data.error, { duration: 4000 });
                throw e;
            } finally {
                setLoading(false);
            }
        }
    });

    // Initialize the form with react-hook-form
    const { control, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
    });

    const handleOpen = () => setIsOpen(true)
    const handleClose = () => {
        setIsOpen(!isOpen);
        if (isOpen) reset(); // Reset the form when closing
    }

    const onSubmit = async (data) => {
        try {
            mutation.mutate(data, {
                onSuccess: (message) => {
                    queryClient.invalidateQueries(['roles']);
                    toast.success(message, { duration: 4000 });
                    handleClose();
                }
            });
        } catch (e) {
            toast.error("Something went wrong!", { duration: 4000 });
        }
    };

    return (
        <div>
            <Button
                variant="contained"
                color="success"
                onClick={handleOpen}
                aria-label="Create new role"
                startIcon={<IoMdAdd />}
            >
                Create Role
            </Button>

            <Dialog open={isOpen} onClose={handleOpen}>
                <DialogTitle>Add New Role</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" gutterBottom mb={2}>
                        Please fill in the details below to create a new role within the government system.
                    </Typography>

                    {/* Role Name Field */}
                    <Controller
                        name="name"
                        control={control}
                        defaultValue=""
                        render={({ field }) => (
                            <TextField
                                {...field}
                                label="Role Name"
                                fullWidth
                                error={!!errors.name}
                                helperText={errors.name ? errors.name.message : ''}
                                variant="outlined"
                                required
                            />
                        )}
                    />

                    {/* Permissions Field */}
                    <Controller
                        name="permission"
                        control={control}
                        defaultValue=""
                        render={({ field }) => (
                            <TextField
                                {...field}
                                label="Permissions"
                                fullWidth
                                multiline
                                rows={3}
                                error={!!errors.permission}
                                helperText={errors.permission ? errors.permission.message : ''}
                                margin="normal"
                                variant="outlined"
                                required
                            />
                        )}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleClose}
                        color="error"
                        disabled={loading}
                    >
                        Close
                    </Button>
                    <Button
                        onClick={handleSubmit(onSubmit)}
                        variant="contained"
                        color="success"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Role'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default CustomDialogForm;
