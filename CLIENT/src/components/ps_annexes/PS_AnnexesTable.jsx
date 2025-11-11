import React, { useEffect, useState } from "react";
import api from "../../config/api"; // Importing API instance
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  TextField,
  Box,
} from "@mui/material";
import { Edit, Delete, Close, Add, Save } from "@mui/icons-material";
import { useUser } from "../../context/UserContext";

const PS_AnnexesTable = () => {
  const [psAnnexes, setPSAnnexes] = useState([]);
  const [annexNames, setAnnexNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editedAnnex, setEditedAnnex] = useState({});
  const [newAnnexes, setNewAnnexes] = useState({});
  const [addingAnnexNameId, setAddingAnnexNameId] = useState(null);
  const { currentUser } = useUser();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [annexesRes, annexNamesRes] = await Promise.all([
          api.get("/ps_annexes"),
          api.get("/annexes"),
        ]);

        setPSAnnexes(annexesRes.data.ps_annexes);
        setAnnexNames(annexNamesRes.data.annexNames);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to retrieve data.");
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Ensure this runs only once when the component mounts

  const handleAddAnnex = async (annexNameId) => {
    try {
      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const region = currentUser.Region;
      const processDate = new Date();
      const fiscalYear = new Date().getFullYear().toString();

      await api.post("/ps_annexes", {
        ...newAnnexes[annexNameId],
        annexName: annexNameId,
        processBy,
        region,
        processDate,
        fiscalYear,
      });
      const annexesRes = await api.get("/ps_annexes");
      setPSAnnexes(annexesRes.data.ps_annexes);
      setNewAnnexes((prev) => ({ ...prev, [annexNameId]: {} }));
      setAddingAnnexNameId(null);
    } catch (error) {
      console.error("Error adding new annex:", error);
    }
  };

  const handleEditAnnex = (id) => {
    setEditingId(id);
    const annex = psAnnexes.find((annex) => annex._id === id);
    setEditedAnnex(annex);
  };

  const handleSaveEdit = async (id) => {
    try {
      const updatedAnnex = {
        ...editedAnnex,
        annexName: editedAnnex.annexName?._id || editedAnnex.annexName,
      };

      const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
      const region = currentUser.Region;
      const processDate = new Date();
      const fiscalYear = new Date().getFullYear().toString();

      await api.put(`/ps_annexes/${id}`, {
        ...updatedAnnex,
        processBy,
        region,
        processDate,
        fiscalYear,
      });
      const annexesRes = await api.get("/ps_annexes");
      setPSAnnexes(annexesRes.data.ps_annexes);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating annex:", error);
    }
  };

  const handleDeleteAnnex = async (id) => {
    try {
      await api.delete(`/ps_annexes/${id}`);
      const annexesRes = await api.get("/ps_annexes");
      setPSAnnexes(annexesRes.data.ps_annexes);
    } catch (error) {
      console.error("Error deleting annex:", error);
    }
  };

  const handleAnnexNameChange = (annexNameId) => {
    setNewAnnexes((prev) => ({
      ...prev,
      [annexNameId]: {
        ...prev[annexNameId],
        employeeFullName: "",
        positionTitle: "",
        Department: "",
        Division: "",
        Amount: "",
        status: "Not Submitted",
        region: "",
        processBy: "",
        processDate: "",
        fiscalYear: "",
      },
    }));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedAnnex({});
  };

  const handleCancelAdd = () => {
    setAddingAnnexNameId(null);
    setNewAnnexes({});
  };

  if (loading) return <p>Loading annex names and PS annexes...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  // Group PS annexes by annex name
  let sectionNumber = 1;
  const groupedData = (annexNames || []).map((annexName) => {
    if (!annexName || !annexName._id) {
      console.warn("Invalid annex name:", annexName);
      return null;
    }

    const items = psAnnexes.filter((annex) => {
      if (!annex.annexName || !annex.annexName._id) {
        console.warn("Invalid annex name:", annex);
        return false;
      }
      return annex.annexName._id === annexName._id;
    });

    // Calculate total amount per annex name
    const totalAmount = items.reduce((sum, item) => sum + item.Amount, 0);

    return {
      sectionNumber: sectionNumber++,
      annexName: annexName.name,
      annexNameId: annexName._id,
      items,
      totalAmount,
    };
  }).filter(group => group !== null); // Filter out null values

  return (
    <>
      {groupedData.map((group) => (
        <div key={group.sectionNumber} style={{ marginBottom: "20px" }}>
          <Typography variant="h6" gutterBottom>
            {group.sectionNumber}. {group.annexName}
          </Typography>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell style={{ fontWeight: "bold" }}>ACTION</TableCell>
                  <TableCell style={{ fontWeight: "bold" }}>EMPLOYEE FULL NAME</TableCell>
                  <TableCell style={{ fontWeight: "bold" }}>POSITION TITLE</TableCell>
                  <TableCell style={{ fontWeight: "bold" }}>DEPARTMENT</TableCell>
                  <TableCell style={{ fontWeight: "bold" }}>DIVISION</TableCell>
                  <TableCell style={{ fontWeight: "bold" }} align="right">
                    AMOUNT (Peso)
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {group.items.length > 0 ? (
                  group.items.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        {editingId === item._id ? (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleSaveEdit(item._id)}
                              color="primary"
                            >
                              <Save />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={handleCancelEdit}
                              color="secondary"
                            >
                              <Close />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleEditAnnex(item._id)}
                              color="primary"
                              disabled={item.status === "Finalized"}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteAnnex(item._id)}
                              color="secondary"
                              disabled={item.status === "Finalized"}
                            >
                              <Delete />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                      <TableCell style={{ fontWeight: "normal" }}>
                        {editingId === item._id ? (
                          <TextField
                            value={editedAnnex.employeeFullName}
                            onChange={(e) =>
                              setEditedAnnex({
                                ...editedAnnex,
                                employeeFullName: e.target.value,
                              })
                            }
                            fullWidth
                          />
                        ) : (
                          item.employeeFullName
                        )}
                      </TableCell>
                      <TableCell style={{ fontWeight: "normal" }}>
                        {editingId === item._id ? (
                          <TextField
                            value={editedAnnex.positionTitle}
                            onChange={(e) =>
                              setEditedAnnex({
                                ...editedAnnex,
                                positionTitle: e.target.value,
                              })
                            }
                            fullWidth
                          />
                        ) : (
                          item.positionTitle
                        )}
                      </TableCell>
                      <TableCell style={{ fontWeight: "normal" }}>
                        {editingId === item._id ? (
                          <TextField
                            value={editedAnnex.Department}
                            onChange={(e) =>
                              setEditedAnnex({
                                ...editedAnnex,
                                Department: e.target.value,
                              })
                            }
                            fullWidth
                          />
                        ) : (
                          item.Department
                        )}
                      </TableCell>
                      <TableCell style={{ fontWeight: "normal" }}>
                        {editingId === item._id ? (
                          <TextField
                            value={editedAnnex.Division}
                            onChange={(e) =>
                              setEditedAnnex({
                                ...editedAnnex,
                                Division: e.target.value,
                              })
                            }
                            fullWidth
                          />
                        ) : (
                          item.Division
                        )}
                      </TableCell>
                      <TableCell style={{ fontWeight: "normal" }} align="right">
                        {editingId === item._id ? (
                          <TextField
                            value={editedAnnex.Amount}
                            onChange={(e) =>
                              setEditedAnnex({
                                ...editedAnnex,
                                Amount: parseFloat(e.target.value),
                              })
                            }
                            type="number"
                            fullWidth
                          />
                        ) : (
                          `₱${item.Amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No records available
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {addingAnnexNameId === group.annexNameId ? (
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() => handleAddAnnex(group.annexNameId)}
                          color="primary"
                        >
                          <Save />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleCancelAdd}
                          color="secondary"
                        >
                          <Close />
                        </IconButton>
                        <TextField
                          placeholder="Employee Full Name"
                          value={newAnnexes[group.annexNameId]?.employeeFullName || ""}
                          onChange={(e) =>
                            setNewAnnexes((prev) => ({
                              ...prev,
                              [group.annexNameId]: {
                                ...prev[group.annexNameId],
                                employeeFullName: e.target.value,
                              },
                            }))
                          }
                          fullWidth
                          style={{ marginLeft: 8, marginRight: 8 }}
                        />
                        <TextField
                          placeholder="Position Title"
                          value={newAnnexes[group.annexNameId]?.positionTitle || ""}
                          onChange={(e) =>
                            setNewAnnexes((prev) => ({
                              ...prev,
                              [group.annexNameId]: {
                                ...prev[group.annexNameId],
                                positionTitle: e.target.value,
                              },
                            }))
                          }
                          fullWidth
                          style={{ marginLeft: 8, marginRight: 8 }}
                        />
                        <TextField
                          placeholder="Department"
                          value={newAnnexes[group.annexNameId]?.Department || ""}
                          onChange={(e) =>
                            setNewAnnexes((prev) => ({
                              ...prev,
                              [group.annexNameId]: {
                                ...prev[group.annexNameId],
                                Department: e.target.value,
                              },
                            }))
                          }
                          fullWidth
                          style={{ marginLeft: 8, marginRight: 8 }}
                        />
                        <TextField
                          placeholder="Division"
                          value={newAnnexes[group.annexNameId]?.Division || ""}
                          onChange={(e) =>
                            setNewAnnexes((prev) => ({
                              ...prev,
                              [group.annexNameId]: {
                                ...prev[group.annexNameId],
                                Division: e.target.value,
                              },
                            }))
                          }
                          fullWidth
                          style={{ marginLeft: 8, marginRight: 8 }}
                        />
                        <TextField
                          placeholder="Amount"
                          type="number"
                          value={newAnnexes[group.annexNameId]?.Amount || ""}
                          onChange={(e) =>
                            setNewAnnexes((prev) => ({
                              ...prev,
                              [group.annexNameId]: {
                                ...prev[group.annexNameId],
                                Amount: parseFloat(e.target.value),
                              },
                            }))
                          }
                          fullWidth
                          style={{ marginLeft: 8, marginRight: 8 }}
                        />
                      </Box>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setAddingAnnexNameId(group.annexNameId);
                          handleAnnexNameChange(group.annexNameId);
                        }}
                        color="primary"
                      >
                        <Add />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ fontWeight: "bold" }} colSpan={5}>
                    Total
                  </TableCell>
                  <TableCell style={{ fontWeight: "bold" }} align="right">
                    ₱
                    {group.totalAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      ))}
    </>
  );
};

export default PS_AnnexesTable;