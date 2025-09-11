const IncomeCategories= require('../models/Income_Categories');
exports.getIncomeCategories = async (req, res) => {
    try{
        const incomeCategory = await IncomeCategories.find();
        return res.status(201).json({incomeCategory});
    }catch(err){
        return res.status(500).json({
            success:false,
            error:'Server Error'
        })
    }
};