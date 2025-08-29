// Add this function to force refresh personnel data
exports.refreshPersonnelData = async (req, res) => {
  try {
    // This endpoint doesn't do anything except trigger a client refresh
    // The client will refetch data after calling this endpoint
    return res.status(200).json({ 
      message: "Refresh triggered successfully",
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error refreshing personnel data:", error);
    return res.status(500).json({ 
      message: "Server error", 
      details: error.message 
    });
  }
};