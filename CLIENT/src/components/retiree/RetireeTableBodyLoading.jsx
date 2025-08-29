import React from "react";
import { TableBody, TableCell, TableRow, Skeleton } from "@mui/material";

const TableBodyLoading = ({ numCell = 5, numRow = 10 }) => {
  return (
    <TableBody>
      {[...Array(numRow)].map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {[...Array(numCell)].map((_, cellIndex) => (
            <TableCell key={cellIndex}>
              <Skeleton animation="wave" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
};

export default TableBodyLoading;