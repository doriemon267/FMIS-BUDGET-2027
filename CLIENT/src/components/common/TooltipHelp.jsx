/**
 * Tooltip with help text component
 */

import { Tooltip, IconButton, Box } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';

const TooltipHelp = ({ title, placement = 'top', size = 'small', sx = {} }) => {
  return (
    <Tooltip title={title} placement={placement} arrow>
      <IconButton
        size={size}
        sx={{
          p: 0.5,
          color: 'text.secondary',
          '&:hover': {
            color: 'primary.main',
          },
          ...sx,
        }}
      >
        <HelpOutline fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
};

export default TooltipHelp;
