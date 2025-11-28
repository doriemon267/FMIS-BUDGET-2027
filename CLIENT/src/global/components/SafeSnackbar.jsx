import React from 'react';
import { Snackbar as MuiSnackbar } from '@mui/material';
import sanitizeProps from '../../utils/sanitizeProps';
import PropTypes from 'prop-types';

/**
 * SafeSnackbar
 * A thin wrapper around MUI Snackbar which strips unsupported props
 * (like ownerState) forwarded to DOM nodes or internal components.
 */
const SafeSnackbar = ({ children, ...props }) => {
  const rest = sanitizeProps(props, ['ownerState']);
  return <MuiSnackbar {...rest}>{children}</MuiSnackbar>;
};

SafeSnackbar.propTypes = {
  children: PropTypes.node,
};

export default SafeSnackbar;
