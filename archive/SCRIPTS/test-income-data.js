// Test script to check income categories data structure
const axios = require('axios');

async function checkIncomeData() {
  try {
    console.log('🔍 Fetching income categories data...');
    
    // Assuming server is running on port 5005
    const response = await axios.get('http://localhost:5005/api/income-categories');
    
    console.log('\n📊 Raw API Response:');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Is Array:', Array.isArray(response.data));
    
    const categories = Array.isArray(response.data) ? response.data : response.data.incomeCategories || [];
    
    console.log('\n📋 Categories found:', categories.length);
    
    categories.forEach((category, index) => {
      console.log(`\n--- Category ${index + 1} ---`);
      console.log('ID:', category._id);
      console.log('Name:', category.incomeCategoryName);
      console.log('incomeSubcategoryName field:', category.incomeSubcategoryName);
      console.log('Type of incomeSubcategoryName:', typeof category.incomeSubcategoryName);
      console.log('Is Array:', Array.isArray(category.incomeSubcategoryName));
      
      if (Array.isArray(category.incomeSubcategoryName)) {
        console.log('Subcategories count:', category.incomeSubcategoryName.length);
        console.log('Subcategories:', category.incomeSubcategoryName);
      } else if (category.incomeSubcategoryName) {
        console.log('Subcategories (string):', category.incomeSubcategoryName);
      } else {
        console.log('❌ No subcategories found');
      }
      
      // Check for alternative field names
      if (category.incomeSubcategories) {
        console.log('Alternative field (incomeSubcategories):', category.incomeSubcategories);
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

checkIncomeData();
