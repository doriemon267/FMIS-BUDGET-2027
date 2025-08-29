import { green } from "@mui/material/colors";
import React from "react";
import { useSearch } from "../../context/SearchContext";

const TextSearchable = ({ columnName }) => {
  const { searchValue } = useSearch();
  const colorText = green[700];

  let colName = columnName + "";

  return (
    <span>
      {colName.toLowerCase().includes(searchValue.toLowerCase()) ? (
        <span>
          {colName
            .split(new RegExp(`(${searchValue.toLowerCase()})`, "i"))
            .map((part, index) =>
              part.toLowerCase() === searchValue.toLowerCase() ? (
                <span
                  key={index}
                  style={{ background: colorText, color: "white" }}
                >
                  {part}
                </span>
              ) : (
                <span key={index}>{part}</span>
              )
            )}
        </span>
      ) : (
        colName
      )}
    </span>
  );
};

export default TextSearchable;
