const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:5005';
async function checkAllCategories() {
  try {
    // Get all categories
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    if (!categoriesData.categories) {
      return;
    }
    for (const category of categoriesData.categories) {
      if (category.sublineItems && category.sublineItems.length > 0) {
        category.sublineItems.forEach(item => {
          });
      } else {
        }
      // Test subline items endpoint
      try {
        const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=${encodeURIComponent(category.categoryName)}`);
        const sublineData = await sublineResponse.json();
        if (sublineData.sublineItems && sublineData.sublineItems.length > 0) {
          // Test accounting titles for each subline item
          for (const sublineItem of sublineData.sublineItems) {
            const accountingResponse = await fetch(`${BASE_URL}/accounting-titles?sublineItem=${encodeURIComponent(sublineItem)}`);
            const accountingData = await accountingResponse.json();
            if (accountingData.accountingTitles && accountingData.accountingTitles.length > 0) {
              accountingData.accountingTitles.forEach(title => {
                `);
              });
            } else {
              }
          }
        } else {
          }
      } catch (error) {
        }
      );
    }
    // Summary
    const categoriesWithIssues = [];
    for (const category of categoriesData.categories) {
      try {
        const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=${encodeURIComponent(category.categoryName)}`);
        const sublineData = await sublineResponse.json();
        if (!sublineData.sublineItems || sublineData.sublineItems.length === 0) {
          categoriesWithIssues.push({
            name: category.categoryName,
            issue: 'No subline items'
          });
          continue;
        }
        let hasAccountingTitles = false;
        for (const sublineItem of sublineData.sublineItems) {
          const accountingResponse = await fetch(`${BASE_URL}/accounting-titles?sublineItem=${encodeURIComponent(sublineItem)}`);
          const accountingData = await accountingResponse.json();
          if (accountingData.accountingTitles && accountingData.accountingTitles.length > 0) {
            hasAccountingTitles = true;
            break;
          }
        }
        if (!hasAccountingTitles) {
          categoriesWithIssues.push({
            name: category.categoryName,
            issue: 'No accounting titles for any subline items'
          });
        }
      } catch (error) {
        categoriesWithIssues.push({
          name: category.categoryName,
          issue: `API error: ${error.message}`
        });
      }
    }
    if (categoriesWithIssues.length > 0) {
      categoriesWithIssues.forEach(cat => {
        });
    } else {
      }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}
checkAllCategories();