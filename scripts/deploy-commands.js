#!/usr/bin/env node
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

async function deployCommands() {
  console.log('🚀 Deploying bot commands...');
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }
  
  const bot = new TelegramBot(token);
  
  const commands = [
    {
      command: 'start',
      description: 'Start the bot and show main menu'
    },
    {
      command: 'getnumbers',
      description: 'Browse available numbers by country'
    },
    {
      command: 'myotps',
      description: 'View your received OTPs'
    },
    {
      command: 'mynumbers',
      description: 'View your active numbers'
    },
    {
      command: 'countries',
      description: 'List all available countries'
    },
    {
      command: 'recentotps',
      description: 'View recent OTPs from all users'
    },
    {
      command: 'stats',
      description: 'View bot statistics'
    },
    {
      command: 'help',
      description: 'Get help and instructions'
    },
    {
      command: 'admin',
      description: 'Admin panel (admin only)'
    }
  ];
  
  try {
    await bot.setMyCommands(commands);
    console.log('✅ Bot commands deployed successfully!');
    
    // Get bot info
    const botInfo = await bot.getMe();
    console.log(`🤖 Bot: @${botInfo.username}`);
    console.log(`📝 Commands: ${commands.length} commands set`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployCommands();
}
