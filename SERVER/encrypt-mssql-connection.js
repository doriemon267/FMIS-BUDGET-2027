#!/usr/bin/env node

/**
 * MSSQL Connection String Encryption Tool
 * 
 * Usage:
 *   1. Generate a master key: node encrypt-mssql-connection.js --generate-key
 *   2. Encrypt connection string: node encrypt-mssql-connection.js --encrypt
 *   3. Test decryption: node encrypt-mssql-connection.js --test
 * 
 * Add MSSQL_ENCRYPTION_KEY and MSSQL_ENCRYPTED_CONNECTION to your .env file
 */

require('dotenv').config();

const EncryptionService = require('./utils/encryptionService');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0] || '--help';

function showHelp() {
  console.log(`
MSSQL Connection String Encryption Tool
=========================================

Usage:
  node encrypt-mssql-connection.js [command]

Commands:
  --generate-key      Generate a random master encryption key
  --encrypt           Encrypt connection string from .env
  --decrypt <string>  Decrypt an encrypted connection string
  --test              Test encrypt/decrypt cycle
  --help              Show this help message

Examples:
  # Step 1: Generate a master key
  node encrypt-mssql-connection.js --generate-key

  # Step 2: Encrypt your connection string
  node encrypt-mssql-connection.js --encrypt

  # Step 3: Test decryption
  node encrypt-mssql-connection.js --test

  # Decrypt a specific string
  node encrypt-mssql-connection.js --decrypt "abc123:def456..."
  `);
}

function generateKey() {
  const masterKey = EncryptionService.generateMasterKey();
  console.log('\n✓ Generated Master Key:');
  console.log(`  ${masterKey}\n`);
  console.log('📝 Add this to your .env file:');
  console.log(`  MSSQL_ENCRYPTION_KEY=${masterKey}\n`);
}

function encryptConnectionString() {
  const masterKey = process.env.MSSQL_ENCRYPTION_KEY;
  
  if (!masterKey) {
    console.error('❌ Error: MSSQL_ENCRYPTION_KEY not found in .env');
    console.log('   Run: node encrypt-mssql-connection.js --generate-key\n');
    process.exit(1);
  }

  try {
    const service = new EncryptionService(masterKey);
    const connectionString = EncryptionService.buildMssqlConnectionString(process.env);
    
    console.log('\n📊 Connection Details:');
    console.log(`  Host: ${process.env.MSSQL_HOST}`);
    console.log(`  Port: ${process.env.MSSQL_PORT}`);
    console.log(`  Database: ${process.env.MSSQL_DB}`);
    console.log(`  User: ${process.env.MSSQL_USER}`);
    console.log(`  Encrypt: ${process.env.MSSQL_ENCRYPT || 'false'}\n`);

    const encrypted = service.encrypt(connectionString);
    
    console.log('✓ Encrypted Connection String:');
    console.log(`  ${encrypted}\n`);
    console.log('📝 Add this to your .env file:');
    console.log(`  MSSQL_ENCRYPTED_CONNECTION=${encrypted}\n`);
    console.log('💡 Tip: After adding both keys to .env, the system will automatically');
    console.log('   decrypt the connection string when connecting to MSSQL.\n');
  } catch (err) {
    console.error('❌ Encryption failed:', err.message);
    process.exit(1);
  }
}

function decryptConnectionString(encryptedString) {
  const masterKey = process.env.MSSQL_ENCRYPTION_KEY;
  
  if (!masterKey) {
    console.error('❌ Error: MSSQL_ENCRYPTION_KEY not found in .env');
    process.exit(1);
  }

  try {
    const service = new EncryptionService(masterKey);
    const decrypted = service.decrypt(encryptedString);
    
    console.log('\n✓ Decrypted Connection String:');
    console.log(`  ${decrypted}\n`);
    
    const parsed = EncryptionService.parseConnectionString(decrypted);
    console.log('📊 Parsed Details:');
    Object.entries(parsed).forEach(([key, value]) => {
      if (key === 'Password') {
        console.log(`  ${key}: ***REDACTED***`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log();
  } catch (err) {
    console.error('❌ Decryption failed:', err.message);
    process.exit(1);
  }
}

function testEncryption() {
  const masterKey = process.env.MSSQL_ENCRYPTION_KEY;
  
  if (!masterKey) {
    console.error('❌ Error: MSSQL_ENCRYPTION_KEY not found in .env');
    console.log('   Run: node encrypt-mssql-connection.js --generate-key\n');
    process.exit(1);
  }

  try {
    const service = new EncryptionService(masterKey);
    const testString = 'Server=localhost,1433;Database=TestDB;User Id=sa;Password=Test123!;';
    
    console.log('\n🧪 Running Encryption Test...\n');
    console.log('Original string:');
    console.log(`  ${testString}`);
    
    const encrypted = service.encrypt(testString);
    console.log('\nEncrypted:');
    console.log(`  ${encrypted}`);
    
    const decrypted = service.decrypt(encrypted);
    console.log('\nDecrypted:');
    console.log(`  ${decrypted}`);
    
    if (decrypted === testString) {
      console.log('\n✓ Test PASSED: Encryption/Decryption working correctly!\n');
    } else {
      console.log('\n❌ Test FAILED: Decrypted string does not match original!\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

// Execute command
if (command === '--generate-key') {
  generateKey();
} else if (command === '--encrypt') {
  encryptConnectionString();
} else if (command === '--decrypt') {
  if (!args[1]) {
    console.error('❌ Error: No encrypted string provided');
    console.log('   Usage: node encrypt-mssql-connection.js --decrypt "encrypted_string"\n');
    process.exit(1);
  }
  decryptConnectionString(args[1]);
} else if (command === '--test') {
  testEncryption();
} else {
  showHelp();
}
