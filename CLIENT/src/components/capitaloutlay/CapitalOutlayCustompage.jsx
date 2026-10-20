import React, { useState, useEffect } from "react";
import TextSearchable from "../../global/components/TextSearchable";

const mockData = [
  {
    itemName: "Printer",
    amount: 5000,
    category: "Office",
    purchaseDate: "2025-06-01",
    createdAt: "2025-06-15",
  },
  {
    itemName: "Laptop",
    amount: 35000,
    category: "IT",
    purchaseDate: "2025-05-20",
    createdAt: "2025-05-21",
  },
];

const CustomPage = ({ dataListName, schema }) => {
  const [data, setData] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editRow, setEditRow] = useState({});

  // Mock fetch for demo/testing
  useEffect(() => {
    setTimeout(() => setData(mockData), 300); // Simulate async fetch
  }, [dataListName]);

  const handleEdit = (idx) => {
    setEditIndex(idx);
    setEditRow({ ...data[idx] });
  };

  const handleCancel = () => {
    setEditIndex(null);
    setEditRow({});
  };

  const handleChange = (e, key) => {
    setEditRow((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = () => {
    setData((prev) =>
      prev.map((row, idx) => (idx === editIndex ? editRow : row))
    );
    setEditIndex(null);
    setEditRow({});
    // TODO: Add API call here to save changes to backend
  };

  return (
    <div>
      <h1>{dataListName}</h1>
      <table>
        <thead>
          <tr>
            {Object.keys(schema).map((key) => (
              <th key={key}>{schema[key].label}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item, index) => (
              <tr key={item._id || item.id || index}>
                {Object.keys(schema).map((key) => (
                  <td key={key}>
                    {editIndex === index ? (
                      <input
                        type={
                          schema[key].type === "number"
                            ? "number"
                            : schema[key].type === "date"
                            ? "date"
                            : "text"
                        }
                        value={editRow[key] || ""}
                        onChange={(e) => handleChange(e, key)}
                      />
                    ) : (
                      item[key]
                    )}
                  </td>
                ))}
                <td>
                  {editIndex === index ? (
                    <>
                      <button onClick={handleSave}>Save</button>
                      <button onClick={handleCancel}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => handleEdit(index)}>Edit</button>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              {Object.keys(schema).map((key) => (
                <td key={key}>No data</td>
              ))}
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CustomPage;