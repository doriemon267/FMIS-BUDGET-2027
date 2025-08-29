import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from "@mui/material";
import api from "../../config/api"; // Importing API instance

const CustomPage = ({ dataListName, schema }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/${dataListName}`);
        setData(response.data[dataListName]);
        setLoading(false);
      } catch (error) {
        console.error(`Error fetching ${dataListName}:`, error);
        setError(`Failed to retrieve ${dataListName}.`);
        setLoading(false);
      }
    };

    fetchData();
  }, [dataListName]);

  if (loading) return <p>Loading {dataListName}...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            {Object.keys(schema).map((key) => (
              schema[key].show && <TableCell key={key}>{schema[key].label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row._id}>
              {Object.keys(schema).map((key) => (
                schema[key].show && (
                  <TableCell key={key}>
                    {schema[key].customRender ? schema[key].customRender(row) : row[key]}
                  </TableCell>
                )
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default CustomPage;