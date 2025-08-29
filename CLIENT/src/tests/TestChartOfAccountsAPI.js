/**
 * Test file to verify Chart of Accounts API functionality
 */

const testAPI = async () => {

  const baseURL = "http://localhost:5005";

  try {
    // Test 1: GET all chart of accounts
    const getResponse = await fetch(`${baseURL}/chart-of-accounts`);
    const getData = await getResponse.json();

    // Test 2: POST new chart of account
    const newAccount = {
      accountClass: "Asset",
      lineItem: "Infrastructure Outlay",
      sublineItem: "Infrastructure Outlay",
      accountingTitle: "Road Construction and Improvement",
      uacsCode: "5-01-01-010"
    };

    const postResponse = await fetch(`${baseURL}/chart-of-accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newAccount)
    });

    if (postResponse.ok) {
      const postData = await postResponse.json();
      
      // Test 3: GET all chart of accounts again to verify creation
      const getResponse2 = await fetch(`${baseURL}/chart-of-accounts`);
      const getData2 = await getResponse2.json();
      
    } else {
      const errorData = await postResponse.text();
    }

    // Test 4: Test another account
    const newAccount2 = {
      accountClass: "Asset",
      lineItem: "Building and Other Structures",
      sublineItem: "Building and Other Structures",
      accountingTitle: "School Buildings",
      uacsCode: "5-01-02-020"
    };

    const postResponse2 = await fetch(`${baseURL}/chart-of-accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newAccount2)
    });

    if (postResponse2.ok) {
      const postData2 = await postResponse2.json();
    } else {
      const errorData2 = await postResponse2.text();
    }

    // Test 5: Final GET to see all accounts
    const finalResponse = await fetch(`${baseURL}/chart-of-accounts`);
    const finalData = await finalResponse.json();

  } catch (error) {
    console.error("❌ API Test Error:", error.message);
  }
};

// Run the test
testAPI();
