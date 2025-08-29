import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../config/api';

const CustomAlertDialog = ({ roleName }) => {
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            setLoading(true)
            try {
                const res = await api.delete(`/delete-role/${roleName}`); // Adjust the endpoint as necessary
                return res.data.message;
            } catch (e) {
                toast.error(e.response.data.error, { duration: 4000 });
                throw e;
            } finally {
                setLoading(false)
            }
        },
        onSuccess: (message) => {
            queryClient.invalidateQueries(['roles']);
            toast.success(message, { duration: 4000 });
            handleClose();
        },
        onError: () => {
            toast.error("Something went wrong!", { duration: 4000 });
        },
    });

    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    const handleDelete = async () => {
        const id = 1;
        mutation.mutate(id, {
            onSuccess: (message) => {
                queryClient.invalidateQueries(['roles']);
                toast.success(message, { duration: 4000 });
                handleClose();
            },
            onError: () => {
                toast.error("Something went wrong!", { duration: 4000 });
            },
        });
    };

    return (
        <div>
            <Button
                variant="contained"
                color="error"
                onClick={handleOpen}
                aria-label="Delete role"
            >
                Delete Role
            </Button>

            <Dialog open={isOpen} onClose={loading ? handleOpen : handleClose}>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" gutterBottom>
                        Are you sure you want to delete the role <strong>{roleName}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="error" disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleDelete} variant="contained" color="success" disabled={loading}>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default CustomAlertDialog;
