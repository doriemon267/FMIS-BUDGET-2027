const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5005';

async function checkAllCategories() {
  console.log('Checking all categories and their accounting titles...\n');

  try {
    // Get all categories
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    
    if (!categoriesData.categories) {
      console.log('❌ No categories found');
      return;
    }

    console.log(`Found ${categoriesData.categories.length} categories\n`);

    for (const category of categoriesData.categories) {
      console.log(`\n=== ${category.categoryName} ===`);
      console.log(`Category ID: ${category._id}`);
      console.log(`SublineItems in category: ${category.sublineItems?.length || 0}`);
      
      if (category.sublineItems && category.sublineItems.length > 0) {
        category.sublineItems.forEach(item => {
          console.log(`  - ${item}`);
        });
      } else {
        console.log(`  ❌ NO SUBLINE ITEMS`);
      }

      // Test subline items endpoint
      try {
        const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=${encodeURIComponent(category.categoryName)}`);
        const sublineData = await sublineResponse.json();
        
        console.log(`\nSubline items from API: ${sublineData.sublineItems?.length || 0}`);
        
        if (sublineData.sublineItems && sublineData.sublineItems.length > 0) {
          // Test accounting titles for each subline item
          for (const sublineItem of sublineData.sublineItems) {
            console.log(`\n  Testing accounting titles for: "${sublineItem}"`);
            
            const accountingResponse = await fetch(`${BASE_URL}/accounting-titles?sublineItem=${encodeURIComponent(sublineItem)}`);
            const accountingData = await accountingResponse.json();
            
            console.log(`    Accounting titles found: ${accountingData.accountingTitles?.length || 0}`);
            
            if (accountingData.accountingTitles && accountingData.accountingTitles.length > 0) {
              accountingData.accountingTitles.forEach(title => {
                console.log(`      ✅ ${title.accountingTitle} (${title.uacsCode})`);
              });
            } else {
              console.log(`      ❌ NO ACCOUNTING TITLES FOUND`);
            }
          }
        } else {
          console.log(`  ❌ NO SUBLINE ITEMS FROM API`);
        }
      } catch (error) {
        console.log(`  ❌ Error testing category: ${error.message}`);
      }

      console.log('\n' + '='.repeat(50));
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    
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
      console.log('\n❌ Categories with issues:');
      categoriesWithIssues.forEach(cat => {
        console.log(`  - ${cat.name}: ${cat.issue}`);
      });
    } else {
      console.log('\n✅ All categories have proper accounting titles!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllCategories();
