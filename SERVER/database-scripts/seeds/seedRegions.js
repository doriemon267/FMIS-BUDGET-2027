/**
 * Simple script to seed regions into the database
 * Run with: node seedRegions.js
 */

require('dotenv').config();
const seedRegions = require('./migrations/seedRegions');

// Run the seeding
seedRegions();
