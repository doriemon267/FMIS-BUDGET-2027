import React from 'react';
import { Snackbar as MuiSnackbar } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * SafeSnackbar
 * A thin wrapper around MUI Snackbar which strips unsupported props
 * (like ownerState) forwarded to DOM nodes or internal components.
 */
const SafeSnackbar = ({ children, ...props }) => {
  // Remove props that MUI's ClickAwayListener and others don't expect
  const { ownerState, ...rest } = props || {};
  return <MuiSnackbar {...rest}>{children}</MuiSnackbar>;
};

SafeSnackbar.propTypes = {
  children: PropTypes.node,
};

export default SafeSnackbar;
