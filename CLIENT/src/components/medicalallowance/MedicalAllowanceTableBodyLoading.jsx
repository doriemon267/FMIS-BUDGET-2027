import { TableBody, TableRow, TableCell } from "@mui/material";
import React, { useMemo } from "react";
import PropTypes from "prop-types";

const TableBodyLoading = ({ numRow = 10, numCell = 5 }) => {
  const rows = Array.from({ length: numRow }, (_, i) => i + 1);
  const cells = Array.from({ length: numCell }, (_, i) => i + 1);
  const animationDuration = useMemo(() => `${Math.random() * (1.5 - 0.5) + 0.5}s`, []);

  return (
    <TableBody>
      {rows.map((r) => (
        <TableRow className="fade-in" key={r}>
          {cells.map((c) => (
            <TableCell
              key={c}
              className="loading-cell"
              sx={{
                animationDuration,
                py: 3.2,
                border: "2px solid white",
              }}
            />
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
};

TableBodyLoading.propTypes = {
  numRow: PropTypes.number,
  numCell: PropTypes.number,
};

export default TableBodyLoading;