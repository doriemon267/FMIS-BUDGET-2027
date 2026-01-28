import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../config/api";

const PersonnelAggregates = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["personnelAggregates"],
    queryFn: async () => {
      const response = await api.get("/personnelAggregates");
      return response.data;
    },
  });

  if (isLoading) return <div>Loading aggregates...</div>;
  if (error) return <div>Error loading aggregates</div>;

  // Ensure that aggregates is an array.
  const aggregates = Array.isArray(data) ? data : [data];

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>Personnel Aggregates</h3>
      {aggregates.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Status</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Monthly Salary</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Hazard Pay</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Subsistence Allowance</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Honoraria</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Annual Salary</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>RATA</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>PERA</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Uniform Allowance</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Productivity Incentive</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Cash Gift</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Midyear Bonus</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Year End Bonus</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>GSIS Premium</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Philhealth Premium</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Pagibig Premium</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Employee Compensation</th>
            </tr>
          </thead>
          <tbody>
            {aggregates.map((group, index) => (
              <tr key={`${group._id}-${index}`}>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group._id}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalMonthlySalary}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalHazardPay}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalSubsistenceAllowance}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalHonoraria}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalAnnualSalary}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalRATA}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalPERA}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalUniformAllowance}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalProductivityIncentive}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalCashGift}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalMidyearBonus}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalYearEndBonus}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalGsisPremium}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalPhilhealthPremium}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalPagibigPremium}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{group.totalEmployeeCompensation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>No aggregate data available.</div>
      )}
    </div>
  );
};

export default PersonnelAggregates;
