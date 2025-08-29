import { InputAdornment, TextField } from "@mui/material";
import React, { useEffect } from "react";
import { CiSearch } from "react-icons/ci";
import { MdClear } from "react-icons/md";
import { useSearch } from "../../context/SearchContext";

const TableSearchBar = () => {
  const { searchValue, handleSetSearchValue, handleClearSearchValue } =
    useSearch();

  useEffect(() => {
    return handleClearSearchValue;
  }, []);

  return (
    <TextField
      autoComplete="off"
      size="small"
      value={searchValue}
      onChange={handleSetSearchValue}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <CiSearch />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end" sx={{ opacity: searchValue ? 1 : 0 }}>
            <MdClear
              style={{ cursor: searchValue ? "pointer" : "default" }}
              onClick={searchValue ? handleClearSearchValue : undefined}
            />
          </InputAdornment>
        ),
      }}
      placeholder="Search"
      variant="outlined"
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        width: {
          xs: "100%", // Full width on mobile
          sm: "auto", // Auto width on larger screens
        },
      }}
    />
  );
};

export default TableSearchBar;
