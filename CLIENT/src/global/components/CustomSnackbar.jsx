import React, { useEffect, useState } from "react";
import { Alert, Fade, Box } from "@mui/material";
import PropTypes from "prop-types";

/**
 * A custom Snackbar component that avoids using MUI's Snackbar to prevent
 * the ownerState prop warning with ClickAwayListener.
 */
const CustomSnackbar = ({ 
  open, 
  message, 
  severity = "info", 
  onClose, 
  autoHideDuration = 6000, 
  anchorOrigin = { vertical: "bottom", horizontal: "center" },
  onClick
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(open);
    
    let timer;
    if (open && autoHideDuration) {
      timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) {
          onClose(null, "timeout");
        }
      }, autoHideDuration);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open, autoHideDuration, onClose]);
  
  if (!open && !isVisible) return null;
  
  const handleClose = (event) => {
    if (onClose) {
      onClose(event, "closeClick");
    }
  };
  
  // Calculate position based on anchorOrigin
  const getPositionStyle = () => {
    const position = { position: 'fixed', zIndex: 1400 };
    
    if (anchorOrigin.vertical === 'top') {
      position.top = 24;
    } else {
      position.bottom = 24;
    }
    
    if (anchorOrigin.horizontal === 'left') {
      position.left = 24;
    } else if (anchorOrigin.horizontal === 'right') {
      position.right = 24;
    } else {
      position.left = '50%';
      position.transform = 'translateX(-50%)';
    }
    
    return position;
  };
  
  return (
    <Fade in={isVisible}>
      <Box sx={{ ...getPositionStyle() }}>
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          elevation={6}
          onClick={onClick ? (e) => { onClick(e); handleClose(e); } : undefined}
          sx={{ width: '100%', minWidth: '288px', maxWidth: '500px', cursor: onClick ? 'pointer' : 'default' }}
        >
          {message}
        </Alert>
      </Box>
    </Fade>
  );
};

CustomSnackbar.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  severity: PropTypes.oneOf(['error', 'warning', 'info', 'success']),
  onClose: PropTypes.func,
  autoHideDuration: PropTypes.number,
  anchorOrigin: PropTypes.shape({
    vertical: PropTypes.oneOf(['top', 'bottom']),
    horizontal: PropTypes.oneOf(['left', 'center', 'right'])
  }),
  onClick: PropTypes.func
};

export default CustomSnackbar;
