import React from "react";
import { TableRow, TableCell, CircularProgress } from "@mui/material";

const TableBodyLoading = ({ numCell }) => {
  return (
    <TableRow>
      <TableCell colSpan={numCell} align="center">
        <CircularProgress />
      </TableCell>
    </TableRow>
  );
};

export default TableBodyLoading;
