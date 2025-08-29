import React from 'react';
import { useNavigate, } from 'react-router-dom';
import { BsArrowLeft } from 'react-icons/bs';
import { Button, } from '@mui/material';
import { IoMdArrowBack } from "react-icons/io";

const GoBackButton = () => {
    const navigate = useNavigate();

    return (
        <Button onClick={() => navigate(-1)} startIcon={<IoMdArrowBack />}>Back</Button>
    );
};

export default GoBackButton;
