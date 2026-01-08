const Utils = require('../utils');

class StartCommand {
  constructor(bot, db, logger) {
    this.bot = bot;
    this.db = db;
    this.logger = logger;
  }

  setup() {
    // /start command
    this.bot.onText(/\/start(?:@\w+)?(?:\s+(.+))?/, async (msg, match) => {
      await this.handleStart(msg, match[1]);
    });
  }

  async handleStart(msg, param) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    this.logger.info(`User ${userId} (@${username}) started the bot`);
    
    // Register or get user
    const user = await this.db.getOrCreateUser(msg.from);
    
    // Check if user is admin
    const isAdmin = userId.toString() === process.env.TELEGRAM_ADMIN_ID;
    
    // Handle referral parameter if any
    if (param) {
      await this.handleReferral(param, userId);
    }
    
    // Send welcome message
    await this.sendWelcomeMessage(chatId, user, isAdmin);
  }

  async handleReferral(param, userId) {
    try {
      // Extract referral code
      const referralCode = param.trim();
      
      // Log referral
      this.logger.info(`User ${userId} used referral code: ${referralCode}`);
      
      // You can implement referral logic here
      // Example: Give bonus to referrer and referee
      
    } catch (error) {
      this.logger.error('Error handling referral:', error);
    }
  }

  async sendWelcomeMessage(chatId, user, isAdmin = false) {
    const welcomeMessage = `
🌟 *Welcome to Abdullah SMS Bot* 🌟

*Your Ultimate SMS & OTP Management Solution*

📱 *Features:*
• Get virtual numbers from 50+ countries
• Receive OTPs instantly in Telegram
• One-click OTP copying
• Real-time notifications
• User-friendly interface
• 24/7 availability

🎯 *Quick Start:*
1. Browse available countries
2. Select a number
3. Use it for verification
4. Receive OTP here instantly
5. Copy with one click!

⚡ *Commands:*
/start - Show this message
/getnumbers - Browse numbers
/myotps - View your OTPs
/countries - List all countries
/help - Get help

💡 *Pro Tip:* Use inline mode by typing @${this.bot.options.username} in any chat!

📞 *Support:* @AbdullahSMSSupport

🚀 *Enjoy seamless OTP management!*
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🌍 Browse Countries', callback_data: 'browse_countries' },
          { text: '📱 Get Number', callback_data: 'get_number' }
        ],
        [
          { text: '📨 My OTPs', callback_data: 'my_otps' },
          { text: '⚙️ Settings', callback_data: 'settings' }
        ],
        isAdmin ? [
          { text: '👨‍💼 Admin Panel', callback_data: 'admin_panel' }
        ] : [],
        [
          { text: '📖 Help', callback_data: 'help' },
          { text: '⭐ Rate Us', url: 'https://t.me/AbdullahSMSBot' }
        ]
      ]
    };
    
    try {
      await this.bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
      });
    } catch (error) {
      this.logger.error('Error sending welcome message:', error);
    }
  }

  async sendMainMenu(chatId, userId = null) {
    const isAdmin = userId && userId.toString() === process.env.TELEGRAM_ADMIN_ID;
    
    const menuMessage = `
🏠 *Main Menu*

Choose an option below to get started:
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🌍 Browse Countries', callback_data: 'country_list:1' },
          { text: '🔍 Search Number', switch_inline_query_current_chat: '' }
        ],
        [
          { text: '📨 My OTPs', callback_data: 'my_otps:1' },
          { text: '📊 My Stats', callback_data: 'user_stats' }
        ],
        [
          { text: '🔄 Refresh', callback_data: 'refresh_menu' },
          { text: '⚙️ Settings', callback_data: 'settings' }
        ],
        isAdmin ? [
          { text: '👨‍💼 Admin Panel', callback_data: 'admin_panel' }
        ] : []
      ]
    };
    
    try {
      await this.bot.sendMessage(chatId, menuMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      this.logger.error('Error sending main menu:', error);
    }
  }
}

module.exports = StartCommand;
