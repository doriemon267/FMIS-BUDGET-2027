const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5005';

async function testAllCategoriesFinal() {
  console.log('🔍 Final test of all Capital Outlay categories...\n');

  try {
    // Get all categories
    const categoriesResponse = await fetch(`${BASE_URL}/categories`);
    const categoriesData = await categoriesResponse.json();
    
    if (!categoriesData.categories) {
      console.log('❌ No categories found');
      return;
    }

    console.log(`Found ${categoriesData.categories.length} total categories\n`);

    const results = [];

    for (const category of categoriesData.categories) {
      console.log(`\n📁 Testing: ${category.categoryName}`);
      
      try {
        // Test subline items endpoint
        const sublineResponse = await fetch(`${BASE_URL}/subline-items?category=${encodeURIComponent(category.categoryName)}`);
        const sublineData = await sublineResponse.json();
        
        const sublineCount = sublineData.sublineItems?.length || 0;
        console.log(`   📋 Subline items: ${sublineCount}`);
        
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
            console.log(`     ✅ "${sublineItem}": ${accountingCount} accounting titles`);
          } else {
            console.log(`     ❌ "${sublineItem}": NO accounting titles`);
          }
        }

        results.push({
          category: category.categoryName,
          status: hasAccountingTitles ? '✅ WORKING' : '❌ NO ACCOUNTING TITLES',
          sublineItems: sublineCount,
          accountingTitles: totalAccountingTitles
        });

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        results.push({
          category: category.categoryName,
          status: `❌ ERROR: ${error.message}`,
          sublineItems: 0,
          accountingTitles: 0
        });
      }
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(80));

    const workingCategories = results.filter(r => r.status.includes('✅'));
    const brokenCategories = results.filter(r => r.status.includes('❌'));

    console.log(`\n✅ Working categories: ${workingCategories.length}`);
    workingCategories.forEach(cat => {
      console.log(`   • ${cat.category} (${cat.sublineItems} subline items, ${cat.accountingTitles} accounting titles)`);
    });

    if (brokenCategories.length > 0) {
      console.log(`\n❌ Categories with issues: ${brokenCategories.length}`);
      brokenCategories.forEach(cat => {
        console.log(`   • ${cat.category}: ${cat.status}`);
      });
    } else {
      console.log('\n🎉 ALL CATEGORIES ARE WORKING PERFECTLY!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total categories: ${results.length}`);
    console.log(`Working categories: ${workingCategories.length}`);
    console.log(`Categories with issues: ${brokenCategories.length}`);
    console.log(`Success rate: ${Math.round((workingCategories.length / results.length) * 100)}%`);

    const totalSublineItems = results.reduce((sum, r) => sum + r.sublineItems, 0);
    const totalAccountingTitles = results.reduce((sum, r) => sum + r.accountingTitles, 0);
    console.log(`Total subline items: ${totalSublineItems}`);
    console.log(`Total accounting titles: ${totalAccountingTitles}`);

    if (brokenCategories.length === 0) {
      console.log('\n🎯 CONCLUSION: The Capital Outlay chart of accounts issue has been completely resolved!');
      console.log('   All categories now have proper subline items and accounting titles.');
      console.log('   Users should be able to select accounting titles for all Capital Outlay categories.');
    } else {
      console.log('\n⚠️  CONCLUSION: Some categories still need attention.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAllCategoriesFinal();
