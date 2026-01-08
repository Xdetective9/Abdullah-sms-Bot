const Utils = require('../utils');

class OTPCommand {
  constructor(bot, db, logger) {
    this.bot = bot;
    this.db = db;
    this.logger = logger;
  }

  setup() {
    // /myotps command
    this.bot.onText(/\/myotps(?:@\w+)?/, async (msg) => {
      await this.handleMyOTPs(msg);
    });

    // /recentotps command
    this.bot.onText(/\/recentotps(?:@\w+)?/, async (msg) => {
      await this.handleRecentOTPs(msg);
    });
  }

  async handleMyOTPs(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    await this.showUserOTPs(chatId, userId);
  }

  async handleRecentOTPs(msg) {
    const chatId = msg.chat.id;
    
    const recentOTPs = await this.db.getRecentOTPs(20);
    
    if (!recentOTPs || recentOTPs.length === 0) {
      return this.bot.sendMessage(chatId, '📭 *No OTPs received yet*\n\nNumbers will start receiving OTPs soon.', {
        parse_mode: 'Markdown'
      });
    }
    
    let message = `📨 *Recent OTPs*\n\n`;
    
    recentOTPs.forEach((otp, index) => {
      const timeAgo = Utils.formatTimeAgo(otp.received_at);
      message += `${index + 1}. *${otp.service || 'Unknown'}*\n`;
      message += `   Number: \`${otp.number}\`\n`;
      message += `   OTP: \`${otp.otp_code}\`\n`;
      message += `   Time: ${timeAgo}\n`;
      message += `━━━━━━━━━━━━━━\n`;
    });
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown'
    });
  }

  async showUserOTPs(chatId, userId, page = 1) {
    const otps = await this.db.getUserOTPs(userId);
    const perPage = 5;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginated = otps.slice(start, end);
    
    if (paginated.length === 0) {
      return this.bot.sendMessage(chatId, '📭 *No OTPs received yet*\n\nUse a number to receive OTPs here.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌍 Get Number', callback_data: 'country_list:1' },
              { text: '🔄 Refresh', callback_data: 'refresh_otps' }
            ]
          ]
        }
      });
    }
    
    let message = `📨 *Your OTPs* (Page ${page}/${Math.ceil(otps.length / perPage)})\n\n`;
    message += `Total: ${otps.length} OTPs received\n\n`;
    
    paginated.forEach((otp, index) => {
      const timeAgo = Utils.formatTimeAgo(otp.received_at);
      message += `${start + index + 1}. *${otp.service || 'Unknown'}*\n`;
      message += `   Number: \`${otp.number}\`\n`;
      message += `   Time: ${timeAgo}\n`;
      message += `   Code: \`${otp.otp_code}\`\n`;
      message += `━━━━━━━━━━━━━━\n`;
    });
    
    const keyboard = {
      inline_keyboard: []
    };
    
    // Add OTP action buttons
    paginated.forEach((otp, index) => {
      keyboard.inline_keyboard.push([
        {
          text: `📋 Copy ${otp.service || 'OTP'}`,
          callback_data: `otp_copy:${otp.id}`
        },
        {
          text: '🗑️ Delete',
          callback_data: `otp_delete:${otp.id}`
        }
      ]);
    });
    
    // Add navigation buttons
    const navRow = [];
    if (page > 1) {
      navRow.push({
        text: '◀️ Previous',
        callback_data: `otp_page:${page - 1}`
      });
    }
    if (end < otps.length) {
      navRow.push({
        text: 'Next ▶️',
        callback_data: `otp_page:${page + 1}`
      });
    }
    
    if (navRow.length > 0) {
      keyboard.inline_keyboard.push(navRow);
    }
    
    keyboard.inline_keyboard.push([
      { text: '🌍 Get New Number', callback_data: 'country_list:1' },
      { text: '🔄 Refresh', callback_data: 'refresh_otps' }
    ]);
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleCallback(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    
    if (data.startsWith('otp_page:')) {
      const page = parseInt(data.split(':')[1]);
      await this.showUserOTPs(chatId, userId, page);
      
    } else if (data.startsWith('otp_copy:')) {
      const otpId = parseInt(data.split(':')[1]);
      await this.copyOTP(otpId, chatId, callbackQuery.id);
      
    } else if (data.startsWith('otp_delete:')) {
      const otpId = parseInt(data.split(':')[1]);
      await this.deleteOTP(otpId, chatId, callbackQuery.id);
      
    } else if (data === 'refresh_otps') {
      await this.showUserOTPs(chatId, userId);
    } else if (data === 'my_otps:1') {
      await this.showUserOTPs(chatId, userId);
    }
    
    this.bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
  }

  async copyOTP(otpId, chatId, callbackQueryId) {
    try {
      const otp = await this.db.getOTP(otpId);
      
      if (!otp) {
        this.bot.answerCallbackQuery(callbackQueryId, {
          text: 'OTP not found',
          show_alert: true
        });
        return;
      }
      
      // Mark OTP as copied
      await this.db.markOTPCopied(otpId);
      
      this.bot.answerCallbackQuery(callbackQueryId, {
        text: `OTP ${otp.otp_code} copied!`,
        show_alert: true
      });
      
      // Send OTP in code format for easy copying
      this.bot.sendMessage(chatId, `📋 *OTP Copied*\n\nService: ${otp.service || 'Unknown'}\nNumber: \`${otp.number}\`\n\n\`${otp.otp_code}\``, {
        parse_mode: 'Markdown'
      });
      
    } catch (error) {
      this.logger.error('Error copying OTP:', error);
      this.bot.answerCallbackQuery(callbackQueryId, {
        text: 'Error copying OTP',
        show_alert: true
      });
    }
  }

  async deleteOTP(otpId, chatId, callbackQueryId) {
    try {
      const deleted = await this.db.deleteOTP(otpId);
      
      if (deleted) {
        this.bot.answerCallbackQuery(callbackQueryId, {
          text: 'OTP deleted successfully',
          show_alert: true
        });
        
        // Delete the message
        this.bot.deleteMessage(chatId, callbackQuery.message.message_id).catch(() => {});
      } else {
        this.bot.answerCallbackQuery(callbackQueryId, {
          text: 'Failed to delete OTP',
          show_alert: true
        });
      }
      
    } catch (error) {
      this.logger.error('Error deleting OTP:', error);
      this.bot.answerCallbackQuery(callbackQueryId, {
        text: 'Error deleting OTP',
        show_alert: true
      });
    }
  }
}

module.exports = OTPCommand;
