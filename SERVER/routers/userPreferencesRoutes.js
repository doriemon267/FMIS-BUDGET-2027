/**
 * User Preferences Routes
 * 
 * API endpoints for managing user preferences
 */

const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');

// Apply authentication to all routes
router.use(isAuth);

const UserPreferences = require('../models/UserPreferences');

/**
 * GET /api/user/preferences
 * Get current user's preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    let preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences) {
      // Create default preferences if none exist
      preferences = await UserPreferences.create({
        userId,
        preferences: {},
      });
    }

    res.json({
      success: true,
      preferences: preferences.preferences || {},
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: error.message,
    });
  }
});

/**
 * PUT /api/user/preferences
 * Update current user's preferences
 */
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { preferences: newPreferences } = req.body;

    if (!newPreferences || typeof newPreferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid preferences data',
      });
    }

    // Update or create preferences
    const preferences = await UserPreferences.findOneAndUpdate(
      { userId },
      { 
        preferences: newPreferences,
        updatedAt: new Date(),
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      success: true,
      preferences: preferences.preferences,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/user/preferences
 * Reset preferences to defaults
 */
router.delete('/preferences', async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    await UserPreferences.findOneAndUpdate(
      { userId },
      { 
        preferences: {},
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Preferences reset to defaults',
    });
  } catch (error) {
    console.error('Error resetting user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset preferences',
      error: error.message,
    });
  }
});

module.exports = router;

