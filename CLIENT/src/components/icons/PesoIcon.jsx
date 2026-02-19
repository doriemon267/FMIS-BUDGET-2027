import { FaPesoSign } from "react-icons/fa6";
import { Box } from "@mui/material";

/**
 * Philippine Peso (₱) icon - drop-in replacement for dollar/currency icons.
 * Accepts MUI sx, fontSize, and standard icon props.
 */
const PesoIcon = ({ sx, fontSize, ...rest }) => {
  const size = fontSize ?? (typeof sx?.fontSize === "number" ? sx.fontSize : 24);
  return (
    <Box
      component={FaPesoSign}
      sx={{ display: "inline-flex", fontSize: size, ...sx }}
      {...rest}
    />
  );
};

export default PesoIcon;
