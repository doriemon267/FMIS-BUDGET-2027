@"
const fs = require("fs");

function addOnChange(filepath) {
  let content = fs.readFileSync(filepath, "utf-8");

  const target = `                        rules={{ required: "Position title is required" }}`;
  
  const replacement = `                        rules={{ required: "Position title is required" }}
                        onChange={async (selectedPosition) => {
                          if (selectedPosition) {
                            if (selectedPosition.SG != null) {
                              setValue("SG", selectedPosition.SG);
                            }
                            if (selectedPosition.JG) {
                              setValue("JG", selectedPosition.JG);
                            }
                            if (selectedPosition.PG) {
                              setValue("PG", selectedPosition.PG);
                            }

                            // Trigger Rate recalculation
                            const stepVal = getValues("Step") || "1";
                            setValue("Step", stepVal);
                            const status = getValues("StatusOfAppointment")?.toString().toUpperCase();
                            
                            if (status) {
                              if (status === "COS" && selectedPosition.SG != null) {
                                try {
                                  const res = await api.get(\`/cos-salary/rate/\${selectedPosition.SG}/\${stepVal}\`);
                                  if (res.data?.rate != null) setValue("Rate", res.data.rate);
                                } catch (err) {
                                  console.error("Error fetching COS rate:", err);
                                }
                              } else if (status === "CASUAL" && selectedPosition.JG) {
                                try {
                                  const path = typeof useCPCSForEmployeeAdd !== "undefined" && useCPCSForEmployeeAdd
                                    ? \`/cpcs-salary/rate-by-job-grade-and-step/\${selectedPosition.JG}/\${stepVal}\`
                                    : \`/rate-by-job-grade-and-step/\${selectedPosition.JG}/\${stepVal}\`;
                                  const response = await api.get(path);
                                  if (response.data?.rate) setValue("Rate", response.data.rate);
                                } catch (error) {
                                  console.error("Error fetching JG rate:", error);
                                }
                              } else if ((status === "PERMANENT" || status === "CONTRACTUAL" || (status === "CASUAL" && typeof cpcs2Types !== "undefined" && cpcs2Types.includes("CASUAL"))) && selectedPosition.SG != null) {
                                try {
                                  const url = typeof useCPCSForEmployeeAdd !== "undefined" && useCPCSForEmployeeAdd
                                    ? \`cpcs-salary/grades?salary_grade=\${selectedPosition.SG}\`
                                    : \`salary-grades?salary_grade=\${selectedPosition.SG}\`;
                                  const response = await api.get(url);
                                  const salaryGrades = response.data.grades?.[0];
                                  if (salaryGrades) {
                                    if (typeof setSalaryData !== "undefined") setSalaryData(salaryGrades);
                                    const steps = salaryGrades.steps.map(aw => aw + "");
                                    if (typeof setStepOptions !== "undefined") setStepOptions(steps);
                                    const stepToUse = steps.includes(stepVal) ? stepVal : (steps[0] || "1");
                                    setValue("Step", stepToUse);
                                    const rate = salaryGrades.rates?.[stepToUse];
                                    setValue("Rate", rate || "");
                                  }
                                } catch (err) {
                                  console.error("Error fetching SG rate:", err);
                                }
                              }
                            }
                            trigger(["SG", "JG", "PG", "Step", "Rate"]);
                          }
                        }}`;

  if (content.includes(target) && !content.includes("setValue(\"SG\", selectedPosition.SG)")) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filepath, content, "utf-8");
    console.log("Patched " + filepath);
  } else {
    console.log("Target not found or already patched in " + filepath);
  }
}

addOnChange("D:/_2026_FMIS-BUDGET/GOKO/SYSTEM_LOST_V4/FMIS-BUDGET/CLIENT/src/components/employee/EmployeeCustomAdd.jsx");
addOnChange("D:/_2026_FMIS-BUDGET/GOKO/SYSTEM_LOST_V4/FMIS-BUDGET/CLIENT/src/components/employee/EmployeeEditDialog.jsx");
"@
