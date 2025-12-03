import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Button,
  Tooltip,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  AccountTree as AccountTreeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRegion } from '../../context/RegionContext';
import { useUser } from '../../context/UserContext';

const ActiveRegionDisplay = ({ variant = 'default', showButton = true }) => {
  const navigate = useNavigate();
  const { activeRegion, availableRegions, changeActiveRegion, hasMultipleRegions } = useRegion();
  const { currentUser } = useUser();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleRegionMenuClick = (event) => {
    if (hasMultipleRegions()) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleRegionMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRegionSelect = (region) => {
    changeActiveRegion(region);
    handleRegionMenuClose();
  };

  // Pull hierarchical assignment details from user context
  const access = currentUser?.hierarchicalAccess;
  const scope = access?.scope;
  const divisions = Array.isArray(access?.accessibleDivisions) ? access.accessibleDivisions : [];
  const departments = Array.isArray(access?.accessibleDepartments) ? access.accessibleDepartments : [];
  const regionsHA = Array.isArray(access?.accessibleRegions) ? access.accessibleRegions : [];

  const firstDivision = divisions[0];
  const firstDept = departments[0];
  const firstRegionHA = regionsHA[0];

  const divisionLabel = divisions.length > 1
    ? `${divisions.length} Divisions`
    : divisions.length === 1
      ? (typeof firstDivision === 'string' ? firstDivision : (firstDivision?.divisionName || firstDivision?.Division || firstDivision?.name))
      : null;

  const departmentLabel = departments.length > 1
    ? `${departments.length} Departments`
    : departments.length === 1
      ? (typeof firstDept === 'string' ? firstDept : (firstDept?.Department || firstDept?.departmentName || firstDept?.name))
      : null;

  const regionLabelFromHA = regionsHA.length > 1
    ? `${regionsHA.length} Regions`
    : regionsHA.length === 1
      ? (firstRegionHA?.regionName || firstRegionHA?.Region || firstRegionHA?.name)
      : null;

  // Compute the primary region name with fallbacks to hierarchical access info
  const regionName = (activeRegion && (activeRegion.name || activeRegion.regionName || activeRegion.Region))
    || regionLabelFromHA;

  const isFullScope = scope === 'FULL';

  // If no activeRegion, try to still show assignment chips from hierarchical access
  if (!activeRegion) {

    // If user has any assignment info, reflect it instead of showing "No Region Assigned"
    if (divisionLabel || departmentLabel || regionLabelFromHA) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {divisionLabel && (
            <Chip
              icon={<AccountTreeIcon />}
              label={`Division: ${divisionLabel}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 600, backgroundColor: '#375e38', color: 'white' }}
            />
          )}
          {departmentLabel && (
            <Chip
              icon={<BusinessIcon />}
              label={`Department: ${departmentLabel}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 600, backgroundColor: '#375e38', color: 'white' }}
            />
          )}
          {regionLabelFromHA && (
            <Chip
              icon={<LocationIcon />}
              label={`Region: ${regionLabelFromHA}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 600, backgroundColor: '#375e38', color: 'white' }}
            />
          )}
        </Box>
      );
    }

    // No assignments found at all
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isFullScope && (
          <Chip
            icon={<AccountTreeIcon />}
            label="Full Access"
            color="success"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        )}
        {!isFullScope && (
          <>
            <Chip
              icon={<LocationIcon />}
              label="No Region Assigned"
              color="error"
              size="small"
              sx={{ fontWeight: 500 }}
            />
            <Typography variant="caption" color="text.secondary">
              Contact administrator
            </Typography>
          </>
        )}
      </Box>
    );
  }

  // Compact variant (for headers, etc.)
  // Hide region selector completely for Full Access users
  if (variant === 'compact') {
    if (isFullScope) {
      return null; // Hide completely for BRD Level users
    }

    const primaryLabel = divisionLabel || departmentLabel || regionName;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {primaryLabel && (
          <Chip
            icon={<LocationIcon />}
            label={primaryLabel}
          color="primary"
          size="small"
          onClick={hasMultipleRegions() ? handleRegionMenuClick : undefined}
          sx={{ 
            fontWeight: 600,
            backgroundColor: '#375e38',
            color: 'white',
            cursor: hasMultipleRegions() ? 'pointer' : 'default',
            '&:hover': hasMultipleRegions() ? {
              backgroundColor: '#2e4e2e'
            } : {}
          }}
          />
        )}
        {hasMultipleRegions() && (
          <ExpandMoreIcon 
            sx={{ 
              color: '#375e38',
              fontSize: 16,
              cursor: 'pointer'
            }}
            onClick={handleRegionMenuClick}
          />
        )}
        
        {/* Region switching menu for users with multiple regions */}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleRegionMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          {availableRegions.map((region) => (
            <MenuItem
              key={region._id || region.id}
              onClick={() => handleRegionSelect(region)}
              selected={region._id === activeRegion._id}
            >
              <LocationIcon sx={{ mr: 1, fontSize: 16 }} />
              {region.name || region.regionName || region.Region}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    );
  }

  // Default variant with more information
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {isFullScope && (
        <Chip
          icon={<AccountTreeIcon />}
          label="Full Access"
          color="success"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      )}
      {divisionLabel && (
        <Chip
          icon={<AccountTreeIcon />}
          label={`Division: ${divisionLabel}`}
          color="primary"
          size="small"
          sx={{ 
            fontWeight: 600,
            backgroundColor: '#375e38',
            color: 'white',
          }}
        />
      )}
      {!divisionLabel && departmentLabel && (
        <Chip
          icon={<BusinessIcon />}
          label={`Department: ${departmentLabel}`}
          color="primary"
          size="small"
          sx={{ 
            fontWeight: 600,
            backgroundColor: '#375e38',
            color: 'white',
          }}
        />
      )}
      <Chip
        icon={<LocationIcon />}
        label={`Region: ${regionName}`}
        color="primary"
        size="small"
        onClick={hasMultipleRegions() ? handleRegionMenuClick : undefined}
        sx={{ 
          fontWeight: 600,
          backgroundColor: '#375e38',
          color: 'white',
          cursor: hasMultipleRegions() ? 'pointer' : 'default',
          '&:hover': hasMultipleRegions() ? {
            backgroundColor: '#2e4e2e'
          } : {}
        }}
      />
      {hasMultipleRegions() && (
        <Tooltip title="Switch region">
          <IconButton
            size="small"
            onClick={handleRegionMenuClick}
            sx={{
              color: '#375e38',
              '&:hover': {
                backgroundColor: 'rgba(55, 94, 56, 0.1)'
              }
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      
      {/* Region switching menu for users with multiple regions */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleRegionMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        {availableRegions.map((region) => (
          <MenuItem
            key={region._id || region.id}
            onClick={() => handleRegionSelect(region)}
            selected={region._id === activeRegion._id}
          >
            <LocationIcon sx={{ mr: 1, fontSize: 16 }} />
            {region.name || region.regionName || region.Region}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default ActiveRegionDisplay;