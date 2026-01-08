class CaptchaSolver {
  constructor(bot, logger) {
    this.bot = bot;
    this.logger = logger;
    this.pendingCaptchas = new Map();
  }

  async handleMessage(msg) {
    // Check if this is a captcha response from admin
    if (msg.reply_to_message && msg.reply_to_message.text.includes('CAPTCHA')) {
      await this.processCaptchaResponse(msg);
    }
  }

  async processCaptchaResponse(msg) {
    try {
      const replyText = msg.reply_to_message.text;
      const captchaIdMatch = replyText.match(/ID:\s*(\w+)/);
      
      if (captchaIdMatch) {
        const captchaId = captchaIdMatch[1];
        const solution = msg.text.trim();
        
        // Forward solution to panel manager
        const panel = require('./panel');
        const panelManager = new panel(this.logger);
        
        const success = panelManager.submitCaptchaSolution(captchaId, solution);
        
        if (success) {
          await this.bot.sendMessage(msg.chat.id, '✅ Captcha solution submitted successfully!');
        } else {
          await this.bot.sendMessage(msg.chat.id, '❌ Invalid captcha ID or solution already submitted.');
        }
      }
    } catch (error) {
      this.logger.error('Error processing captcha response:', error);
    }
  }

  async requestManualSolve(captchaText, captchaId) {
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    
    if (!adminId) {
      this.logger.error('No admin ID configured for manual captcha solving');
      return false;
    }
    
    const message = `
🔐 *CAPTCHA REQUIRED*

A captcha needs to be solved to access the panel.

*Captcha:* \`${captchaText}\`
*ID:* ${captchaId}

Please reply to this message with the solution.
    `;
    
    try {
      await this.bot.sendMessage(adminId, message, {
        parse_mode: 'Markdown'
      });
      
      // Store captcha info
      this.pendingCaptchas.set(captchaId, {
        text: captchaText,
        timestamp: Date.now()
      });
      
      // Clean up after timeout
      setTimeout(() => {
        this.pendingCaptchas.delete(captchaId);
      }, 300000); // 5 minutes
      
      return true;
      
    } catch (error) {
      this.logger.error('Error sending captcha request:', error);
      return false;
    }
  }

  getPendingCaptcha(captchaId) {
    return this.pendingCaptchas.get(captchaId);
  }

  removePendingCaptcha(captchaId) {
    return this.pendingCaptchas.delete(captchaId);
  }
}

module.exports = CaptchaSolver;
