const Utils = require('../utils');

class NumbersCommand {
  constructor(bot, db, logger) {
    this.bot = bot;
    this.db = db;
    this.logger = logger;
  }

  setup() {
    // /getnumbers command
    this.bot.onText(/\/getnumbers(?:@\w+)?/, async (msg) => {
      await this.handleGetNumbers(msg);
    });

    // /mynumbers command
    this.bot.onText(/\/mynumbers(?:@\w+)?/, async (msg) => {
      await this.handleMyNumbers(msg);
    });
  }

  async handleGetNumbers(msg) {
    const chatId = msg.chat.id;
    
    await this.showCountrySelection(chatId);
  }

  async handleMyNumbers(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const numbers = await this.db.getUserNumbers(userId);
    
    if (!numbers || numbers.length === 0) {
      return this.bot.sendMessage(chatId, '📭 *You have no active numbers*\n\nBrowse countries to get a number.', {
        parse_mode: 'Markdown'
      });
    }
    
    let message = `📱 *Your Active Numbers*\n\n`;
    
    numbers.forEach((number, index) => {
      const timeLeft = this.getTimeLeft(number.reserved_until);
      message += `${index + 1}. \`${number.number}\`\n`;
      message += `   Country: ${number.country_name}\n`;
      message += `   Service: ${number.service || 'N/A'}\n`;
      message += `   Status: ${this.getStatusEmoji(number.status)} ${number.status}\n`;
      message += `   Time Left: ${timeLeft}\n`;
      message += `━━━━━━━━━━━━━━\n`;
    });
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'refresh_mynumbers' },
          { text: '🌍 Get New', callback_data: 'browse_countries' }
        ]
      ]
    };
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async showCountrySelection(chatId, page = 1) {
    const countries = await this.db.getCountries();
    const perPage = 8;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginated = countries.slice(start, end);
    
    if (paginated.length === 0) {
      return this.bot.sendMessage(chatId, '🌍 *No countries available*\n\nPlease check back later.', {
        parse_mode: 'Markdown'
      });
    }
    
    const message = `🌍 *Select a Country* (Page ${page}/${Math.ceil(countries.length / perPage)})\n\n`;
    
    const keyboard = {
      inline_keyboard: []
    };
    
    // Add country buttons in 2 columns
    for (let i = 0; i < paginated.length; i += 2) {
      const row = [];
      if (paginated[i]) {
        row.push({
          text: `${paginated[i].flag} ${paginated[i].name} (${paginated[i].numbers_count || 0})`,
          callback_data: `country_select:${paginated[i].code}`
        });
      }
      if (paginated[i + 1]) {
        row.push({
          text: `${paginated[i + 1].flag} ${paginated[i + 1].name} (${paginated[i + 1].numbers_count || 0})`,
          callback_data: `country_select:${paginated[i + 1].code}`
        });
      }
      keyboard.inline_keyboard.push(row);
    }
    
    // Add navigation buttons
    const navRow = [];
    if (page > 1) {
      navRow.push({
        text: '◀️ Previous',
        callback_data: `country_page:${page - 1}`
      });
    }
    if (end < countries.length) {
      navRow.push({
        text: 'Next ▶️',
        callback_data: `country_page:${page + 1}`
      });
    }
    
    if (navRow.length > 0) {
      keyboard.inline_keyboard.push(navRow);
    }
    
    keyboard.inline_keyboard.push([
      { text: '🔙 Main Menu', callback_data: 'main_menu' }
    ]);
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async showCountryNumbers(chatId, countryCode, page = 1) {
    const country = await this.db.getCountry(countryCode);
    const numbers = await this.db.getNumbersByCountry(countryCode);
    const available = numbers.filter(n => n.status === 'available');
    
    const perPage = 5;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginated = available.slice(start, end);
    
    if (paginated.length === 0) {
      return this.bot.sendMessage(chatId, `📭 *No available numbers in ${country.name}*\n\nPlease try another country or check back later.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌍 Other Countries', callback_data: 'country_list:1' },
              { text: '🔙 Back', callback_data: `country_back:${countryCode}` }
            ]
          ]
        }
      });
    }
    
    let message = `${country.flag} *${country.name}*\n\n`;
    message += `📊 Total: ${numbers.length} | ✅ Available: ${available.length}\n\n`;
    message += `*Available Numbers:*\n`;
    
    paginated.forEach((number, index) => {
      message += `\n${start + index + 1}. \`${number.number}\`\n`;
      message += `   Service: ${number.service || 'Unknown'}\n`;
      message += `   Range: ${number.range || 'N/A'}\n`;
    });
    
    const keyboard = {
      inline_keyboard: []
    };
    
    // Add number selection buttons
    paginated.forEach((number, index) => {
      keyboard.inline_keyboard.push([
        {
          text: `📱 Select ${number.number}`,
          callback_data: `number_select:${number.id}`
        }
      ]);
    });
    
    // Add navigation buttons
    const navRow = [];
    if (page > 1) {
      navRow.push({
        text: '◀️ Previous',
        callback_data: `country_numbers:${countryCode}:${page - 1}`
      });
    }
    if (end < available.length) {
      navRow.push({
        text: 'Next ▶️',
        callback_data: `country_numbers:${countryCode}:${page + 1}`
      });
    }
    
    if (navRow.length > 0) {
      keyboard.inline_keyboard.push(navRow);
    }
    
    keyboard.inline_keyboard.push([
      { text: '🌍 Other Countries', callback_data: 'country_list:1' },
      { text: '🔙 Back', callback_data: 'country_list:1' }
    ]);
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleNumberSelection(numberId, userId, chatId) {
    try {
      const number = await this.db.getNumber(numberId);
      
      if (!number) {
        return this.bot.sendMessage(chatId, '❌ Number not found.');
      }
      
      if (number.status !== 'available') {
        return this.bot.sendMessage(chatId, `❌ Number \`${number.number}\` is not available.`, {
          parse_mode: 'Markdown'
        });
      }
      
      // Check if user has reached limit
      const userNumbers = await this.db.getUserNumbers(userId);
      const maxNumbers = parseInt(process.env.MAX_NUMBERS_PER_USER) || 3;
      
      if (userNumbers.length >= maxNumbers) {
        return this.bot.sendMessage(chatId, `❌ You can only have ${maxNumbers} active numbers at a time.\n\nPlease wait for your current numbers to expire or release them.`);
      }
      
      // Reserve the number
      const reserved = await this.db.reserveNumber(numberId, userId);
      
      if (!reserved) {
        return this.bot.sendMessage(chatId, '❌ Failed to reserve number. Please try again.');
      }
      
      const message = `
✅ *Number Reserved Successfully!*

📱 *Number:* \`${number.number}\`
🌍 *Country:* ${number.country_name} ${number.country_flag || ''}
🏢 *Service:* ${number.service || 'Unknown'}
⏰ *Valid For:* 10 minutes
📝 *Status:* Reserved for you

💡 *How to use:*
1. Use this number for OTP verification
2. OTP will appear here automatically
3. Click "Copy OTP" button when it arrives

⚠️ *Note:* This number will be released after 10 minutes.
      `;
      
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '📋 Copy Number',
              callback_data: `number_copy:${number.id}`
            }
          ],
          [
            {
              text: '🔄 Get Another',
              callback_data: 'country_list:1'
            },
            {
              text: '📊 My Numbers',
              callback_data: 'my_numbers'
            }
          ]
        ]
      };
      
      this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      this.logger.error('Error handling number selection:', error);
      this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  async handleCallback(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    
    if (data.startsWith('country_page:')) {
      const page = parseInt(data.split(':')[1]);
      await this.showCountrySelection(chatId, page);
      
    } else if (data.startsWith('country_select:')) {
      const countryCode = data.split(':')[1];
      await this.showCountryNumbers(chatId, countryCode);
      
    } else if (data.startsWith('country_numbers:')) {
      const parts = data.split(':');
      const countryCode = parts[1];
      const page = parseInt(parts[2]);
      await this.showCountryNumbers(chatId, countryCode, page);
      
    } else if (data.startsWith('number_select:')) {
      const numberId = parseInt(data.split(':')[1]);
      await this.handleNumberSelection(numberId, userId, chatId);
      
    } else if (data.startsWith('number_copy:')) {
      const numberId = parseInt(data.split(':')[1]);
      await this.copyNumber(numberId, chatId, callbackQuery.id);
      
    } else if (data === 'refresh_mynumbers') {
      await this.handleMyNumbers(callbackQuery.message);
    }
    
    this.bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
  }

  async copyNumber(numberId, chatId, callbackQueryId) {
    try {
      const number = await this.db.getNumber(numberId);
      
      if (!number) {
        this.bot.answerCallbackQuery(callbackQueryId, {
          text: 'Number not found',
          show_alert: true
        });
        return;
      }
      
      this.bot.answerCallbackQuery(callbackQueryId, {
        text: `Number ${number.number} copied to clipboard!`,
        show_alert: true
      });
      
      // Send number in code format for easy copying
      this.bot.sendMessage(chatId, `📋 *Number Copied*\n\n\`${number.number}\`\n\nCountry: ${number.country_name}\nService: ${number.service || 'N/A'}`, {
        parse_mode: 'Markdown'
      });
      
    } catch (error) {
      this.logger.error('Error copying number:', error);
      this.bot.answerCallbackQuery(callbackQueryId, {
        text: 'Error copying number',
        show_alert: true
      });
    }
  }

  getTimeLeft(expiryDate) {
    if (!expiryDate) return 'Expired';
    
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }

  getStatusEmoji(status) {
    const emojiMap = {
      'available': '✅',
      'reserved': '⏳',
      'busy': '❌',
      'expired': '⌛'
    };
    return emojiMap[status] || '❓';
  }
}

module.exports = NumbersCommand;
