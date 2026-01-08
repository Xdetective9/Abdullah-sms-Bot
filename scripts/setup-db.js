#!/usr/bin/env node
require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

async function setupDatabase() {
  console.log('🔧 Setting up database...');
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }
  
  // Initialize database
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './data/smsbot.db',
    logging: false
  });
  
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Import models
    const { Country, Number, OTP, User } = require('../src/database').models;
    
    // Sync all models
    await sequelize.sync({ force: false });
    console.log('✅ Database models synchronized');
    
    // Add default countries if none exist
    const countryCount = await Country.count();
    if (countryCount === 0) {
      const defaultCountries = [
        { code: 'US', name: 'United States', flag: '🇺🇸' },
        { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
        { code: 'CA', name: 'Canada', flag: '🇨🇦' },
        { code: 'AU', name: 'Australia', flag: '🇦🇺' },
        { code: 'DE', name: 'Germany', flag: '🇩🇪' },
        { code: 'FR', name: 'France', flag: '🇫🇷' },
        { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
        { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
        { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
        { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
        { code: 'IN', name: 'India', flag: '🇮🇳' },
        { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
        { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' }
      ];
      
      await Country.bulkCreate(defaultCountries);
      console.log(`✅ Added ${defaultCountries.length} default countries`);
    }
    
    console.log('🎉 Database setup completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setupDatabase();
}
