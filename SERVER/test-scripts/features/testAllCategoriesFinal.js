const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:5005';
async function testAllCategoriesFinal() {
  try {
    // Get all categories
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    if (!categoriesData.categories) {
      return;
    }
    const results = [];
    for (const category of categoriesData.categories) {
      try {
        // Test subline items endpoint
        const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=${encodeURIComponent(category.categoryName)}`);
        const sublineData = await sublineResponse.json();
        const sublineCount = sublineData.sublineItems?.length || 0;
        if (sublineCount === 0) {
          results.push({
            category: category.categoryName,
            status: '❌ NO SUBLINE ITEMS',
            sublineItems: 0,
            accountingTitles: 0
          });
          continue;
        }
        let totalAccountingTitles = 0;
        let hasAccountingTitles = false;
        // Test accounting titles for each subline item
        for (const sublineItem of sublineData.sublineItems) {
          const accountingResponse = await fetch(`${BASE_URL}/accounting-titles?sublineItem=${encodeURIComponent(sublineItem)}`);
          const accountingData = await accountingResponse.json();
          const accountingCount = accountingData.accountingTitles?.length || 0;
          totalAccountingTitles += accountingCount;
          if (accountingCount > 0) {
            hasAccountingTitles = true;
            } else {
            }
        }
        results.push({
          category: category.categoryName,
          status: hasAccountingTitles ? '✅ WORKING' : '❌ NO ACCOUNTING TITLES',
          sublineItems: sublineCount,
          accountingTitles: totalAccountingTitles
        });
      } catch (error) {
        results.push({
          category: category.categoryName,
          status: `❌ ERROR: ${error.message}`,
          sublineItems: 0,
          accountingTitles: 0
        });
      }
    }
    // Summary
    );
    );
    const workingCategories = results.filter(r => r.status.includes('✅'));
    const brokenCategories = results.filter(r => r.status.includes('❌'));
    workingCategories.forEach(cat => {
      `);
    });
    if (brokenCategories.length > 0) {
      brokenCategories.forEach(cat => {
        });
    } else {
      }
    );
    );
    * 100)}%`);
    const totalSublineItems = results.reduce((sum, r) => sum + r.sublineItems, 0);
    const totalAccountingTitles = results.reduce((sum, r) => sum + r.accountingTitles, 0);
    if (brokenCategories.length === 0) {
      } else {
      }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}
testAllCategoriesFinal();