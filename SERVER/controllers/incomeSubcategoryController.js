const IncomeSubcategory = require('../models/Income_SubCategories');
exports.getAllIncomeSubcategories = async (req, res) => {
    try{
        const incomeSubcategories = await IncomeSubcategory.find();
        res.status(200).json({
            status: 'success',
            data:{
                incomeSubcategories,
            },
        });
    }catch(err){
        console.log(err);
    }
};
