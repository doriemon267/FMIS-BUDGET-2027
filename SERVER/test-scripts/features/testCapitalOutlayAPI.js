const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:5005';
async function testCapitalOutlayAPI() {
  try {
    // Test 1: Get categories
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    if (categoriesData.categories?.length > 0) {
      const capitalOutlayCategories = categoriesData.categories.filter(cat => 
        cat.categoryName.toLowerCase().includes('outlay') || 
        cat.categoryName.toLowerCase().includes('infrastructure') ||
        cat.categoryName.toLowerCase().includes('building') ||
        cat.categoryName.toLowerCase().includes('machinery') ||
        cat.categoryName.toLowerCase().includes('transportation') ||
        cat.categoryName.toLowerCase().includes('furniture')
      );
      capitalOutlayCategories.forEach(cat => {
        `);
      });
    }
    // Test 2: Get subline items for a specific category
    const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=Infrastructure Outlay`);
    const sublineData = await sublineResponse.json();
    if (sublineData.sublineItems?.length > 0) {
      sublineData.sublineItems.forEach(item => {
        });
    }
    // Test 3: Get accounting titles for a subline item
    const accountingResponse = await fetch(`${BASE_URL}/accounting-titles?sublineItem=Infrastructure Outlay`);
    const accountingData = await accountingResponse.json();
    if (accountingData.accountingTitles?.length > 0) {
      accountingData.accountingTitles.forEach(title => {
        `);
      });
    }
    // Test 4: Test another category
    const sublineResponse2 = await fetch(`${BASE_URL}/subline-items?category=Machinery and Equipment Outlay`);
    const sublineData2 = await sublineResponse2.json();
    if (sublineData2.sublineItems?.length > 0) {
      const accountingResponse2 = await fetch(`${BASE_URL}/accounting-titles?sublineItem=Machinery and Equipment Outlay`);
      const accountingData2 = await accountingResponse2.json();
      if (accountingData2.accountingTitles?.length > 0) {
        // accountingData2.accountingTitles.slice(0, 3).forEach(title => {
          `);
        });
      }
    }
    // Test 5: Manual seed endpoint
    // const seedResponse = await fetch(`${BASE_URL}/seed-chart-of-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const seedData = await seedResponse.json();
    // // if (seedData.count) {
      // }
    // // // // // // } catch (error) {
    console.error('❌ Error testing API:', error.message);
    }
}
// Run the test
testCapitalOutlayAPI();