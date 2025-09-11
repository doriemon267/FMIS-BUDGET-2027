// Add this new route to your existing routes file
router.get('/all', auth, myProposalsController.getAllUserProposals);