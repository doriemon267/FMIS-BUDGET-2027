import React, { useState } from 'react';
import { Button } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import IncomeSubCategoryRegionMapping from './IncomeSubCategoryRegionMapping';

const RegionMappingButton = ({ row, endpoint, parentClose }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    if (parentClose) parentClose();
  };

  return (
    <>
      <Button
        startIcon={<PublicIcon />}
        onClick={handleOpen}
        color="primary"
        size="small"
        fullWidth
      >
        Region Mapping
      </Button>
      
      <IncomeSubCategoryRegionMapping
        subcategoryId={row._id}
        open={open}
        onClose={handleClose}
      />
    </>
  );
};

export default RegionMappingButton;