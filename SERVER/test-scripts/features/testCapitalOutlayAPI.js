const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5005';

async function testCapitalOutlayAPI() {
  console.log('Testing Capital Outlay API endpoints...\n');

  try {
    // Test 1: Get categories
    console.log('1. Testing /categories endpoint...');
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    console.log(`   Status: ${categoriesResponse.status}`);
    console.log(`   Categories found: ${categoriesData.categories?.length || 0}`);
    
    if (categoriesData.categories?.length > 0) {
      const capitalOutlayCategories = categoriesData.categories.filter(cat => 
        cat.categoryName.toLowerCase().includes('outlay') || 
        cat.categoryName.toLowerCase().includes('infrastructure') ||
        cat.categoryName.toLowerCase().includes('building') ||
        cat.categoryName.toLowerCase().includes('machinery') ||
        cat.categoryName.toLowerCase().includes('transportation') ||
        cat.categoryName.toLowerCase().includes('furniture')
      );
      console.log(`   Capital Outlay categories: ${capitalOutlayCategories.length}`);
      capitalOutlayCategories.forEach(cat => {
        console.log(`     - ${cat.categoryName} (sublineItems: ${cat.sublineItems?.length || 0})`);
      });
    }
    console.log('');

    // Test 2: Get subline items for a specific category
    console.log('2. Testing /subline-items endpoint...');
    const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=Infrastructure Outlay`);
    const sublineData = await sublineResponse.json();
    console.log(`   Status: ${sublineResponse.status}`);
    console.log(`   Subline items for "Infrastructure Outlay": ${sublineData.sublineItems?.length || 0}`);
    if (sublineData.sublineItems?.length > 0) {
      sublineData.sublineItems.forEach(item => {
        console.log(`     - ${item}`);
      });
    }
    console.log('');

    // Test 3: Get accounting titles for a subline item
    console.log('3. Testing /accounting-titles endpoint...');
    const accountingResponse = await fetch(`${BASE_URL}/accounting-titles?sublineItem=Infrastructure Outlay`);
    const accountingData = await accountingResponse.json();
    console.log(`   Status: ${accountingResponse.status}`);
    console.log(`   Accounting titles for "Infrastructure Outlay": ${accountingData.accountingTitles?.length || 0}`);
    if (accountingData.accountingTitles?.length > 0) {
      accountingData.accountingTitles.forEach(title => {
        console.log(`     - ${title.accountingTitle} (${title.uacsCode})`);
      });
    }
    console.log('');

    // Test 4: Test another category
    console.log('4. Testing another category - "Machinery and Equipment Outlay"...');
    const sublineResponse2 = await fetch(`${BASE_URL}/subline-items?category=Machinery and Equipment Outlay`);
    const sublineData2 = await sublineResponse2.json();
    console.log(`   Subline items: ${sublineData2.sublineItems?.length || 0}`);
    
    if (sublineData2.sublineItems?.length > 0) {
      const accountingResponse2 = await fetch(`${BASE_URL}/accounting-titles?sublineItem=Machinery and Equipment Outlay`);
      const accountingData2 = await accountingResponse2.json();
      console.log(`   Accounting titles: ${accountingData2.accountingTitles?.length || 0}`);
      if (accountingData2.accountingTitles?.length > 0) {
        // console.log('   Sample accounting titles:');
        accountingData2.accountingTitles.slice(0, 3).forEach(title => {
          console.log(`     - ${title.accountingTitle} (${title.uacsCode})`);
        });
      }
    }
    console.log('');

    // Test 5: Manual seed endpoint
    // console.log('5. Testing manual seed endpoint...');
    const seedResponse = await fetch(`${BASE_URL}/seed-chart-of-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const seedData = await seedResponse.json();
    // console.log(`   Status: ${seedResponse.status}`);
    // console.log(`   Message: ${seedData.message}`);
    if (seedData.count) {
      // console.log(`   Count: ${seedData.count}`);
    }
    // console.log('');

    // console.log('✅ All tests completed successfully!');
    // console.log('\n=== SUMMARY ===');
    // console.log('The Capital Outlay chart of accounts integration is working correctly.');
    // console.log('Categories have proper subline items, and accounting titles are being fetched.');
    // console.log('The issue with the Capital Outlay table should now be resolved.');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    console.log('\nMake sure the server is running on port 5005');
  }
}

// Run the test
testCapitalOutlayAPI();
