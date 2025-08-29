const axios = require('axios');

const testCategoryCreation = async () => {
  try {
    console.log('Testing category creation with duplicate name in different region...');
    
    // First, create a category in Region 1
    const category1 = {
      incomeCategoryName: "Test Category",
      incomeSubcategoryName: ["Subcategory 1"],
      description: "Test description",
      isGlobal: false,
      regions: ["Region 1"]
    };
    
    console.log('Creating first category:', category1);
    const response1 = await axios.post('http://localhost:5005/api/incomeCategories/create', category1);
    console.log('First category created:', response1.data);
    
    // Now try to create the same category name in Region 2
    const category2 = {
      incomeCategoryName: "Test Category",
      incomeSubcategoryName: ["Subcategory 2"],
      description: "Test description for region 2",
      isGlobal: false,
      regions: ["Region 2"]
    };
    
    console.log('Creating second category:', category2);
    const response2 = await axios.post('http://localhost:5005/api/incomeCategories/create', category2);
    console.log('Second category created:', response2.data);
    
  } catch (error) {
    console.error('Error during test:', error.response?.data || error.message);
    console.error('Full error:', error);
  }
};

testCategoryCreation();
