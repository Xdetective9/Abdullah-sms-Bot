const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

class PanelManager {
  constructor(logger) {
    this.logger = logger;
    this.baseURL = process.env.PANEL_URL || 'http://135.125.222.224';
    this.username = process.env.PANEL_USERNAME || 'Adil_Abdullah0';
    this.password = process.env.PANEL_PASSWORD || 'Adil_Abdullah0';
    this.sessionCookie = null;
    this.captchaQueue = [];
    this.isAuthenticated = false;
    
    // Create axios instance with default config
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }

  async authenticate() {
    try {
      this.logger.info('Authenticating with panel...');
      
      // First, get the login page to check for captcha
      const loginPage = await this.axios.get('/ints/client/SMSCDRStats');
      const $ = cheerio.load(loginPage.data);
      
      // Check if captcha is present
      const captchaText = $('td:contains("Security Code")').next().find('font').text();
      
      if (captchaText && captchaText.includes('+') || captchaText.includes('=')) {
        this.logger.info('Captcha detected, solving...');
        const captchaResult = await this.solveCaptcha(captchaText);
        
        if (!captchaResult) {
          this.logger.error('Failed to solve captcha');
          return false;
        }
        
        // Login with captcha
        const loginData = {
          username: this.username,
          password: this.password,
          captcha: captchaResult
        };
        
        const response = await this.axios.post('/ints/client/SMSCDRStats', loginData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        // Check if login was successful
        if (response.data.includes('Welcome') || response.data.includes('Dashboard')) {
          this.isAuthenticated = true;
          this.sessionCookie = response.headers['set-cookie'];
          this.logger.info('Authentication successful with captcha');
          return true;
        }
      } else {
        // Try login without captcha
        const loginData = {
          username: this.username,
          password: this.password
        };
        
        const response = await this.axios.post('/ints/client/SMSCDRStats', loginData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        // Check if login was successful
        if (response.data.includes('Welcome') || response.data.includes('Dashboard')) {
          this.isAuthenticated = true;
          this.sessionCookie = response.headers['set-cookie'];
          this.logger.info('Authentication successful');
          return true;
        }
      }
      
      this.logger.error('Authentication failed');
      return false;
      
    } catch (error) {
      this.logger.error('Authentication error:', error.message);
      return false;
    }
  }

  async solveCaptcha(captchaText) {
    try {
      // Extract math expression
      const expression = captchaText.replace(/[^0-9+\-*/=()\s]/g, '').trim();
      
      // Parse and solve
      const math = require('mathjs');
      const result = math.evaluate(expression.split('=')[0]);
      
      this.logger.info(`Solved captcha: ${expression} = ${result}`);
      return result.toString();
      
    } catch (error) {
      this.logger.error('Failed to solve captcha automatically:', error);
      
      // If automatic solving fails, add to queue for manual solving
      return await this.manualCaptchaSolve(captchaText);
    }
  }

  async manualCaptchaSolve(captchaText) {
    return new Promise((resolve) => {
      const captchaId = crypto.randomBytes(8).toString('hex');
      
      this.captchaQueue.push({
        id: captchaId,
        text: captchaText,
        resolve,
        timestamp: Date.now()
      });
      
      // Notify admin via Telegram
      if (process.env.TELEGRAM_ADMIN_ID) {
        // This will be handled by the captcha solver module
      }
      
      // Timeout after 30 seconds
      setTimeout(() => {
        const index = this.captchaQueue.findIndex(item => item.id === captchaId);
        if (index !== -1) {
          this.captchaQueue.splice(index, 1);
          resolve(null);
        }
      }, 30000);
    });
  }

  async getCountries() {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }
    
    try {
      const response = await this.axios.get('/ints/client/SMSCDRStats', {
        headers: {
          Cookie: this.sessionCookie
        }
      });
      
      const $ = cheerio.load(response.data);
      const countries = [];
      
      // Parse countries from the page (adjust selector based on actual HTML)
      $('select[name="country"] option').each((index, element) => {
        const value = $(element).val();
        const text = $(element).text().trim();
        
        if (value && text && value !== '0') {
          countries.push({
            code: value,
            name: text,
            flag: this.getFlagForCountry(text)
          });
        }
      });
      
      return countries;
      
    } catch (error) {
      this.logger.error('Error fetching countries:', error);
      return [];
    }
  }

  async getNumbers() {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }
    
    try {
      const response = await this.axios.get('/ints/client/SMSCDRStats?action=numbers', {
        headers: {
          Cookie: this.sessionCookie
        }
      });
      
      const $ = cheerio.load(response.data);
      const numbers = [];
      
      // Parse numbers table (adjust selector based on actual HTML)
      $('table tr').each((index, row) => {
        const cells = $(row).find('td');
        
        if (cells.length >= 3) {
          const number = $(cells[0]).text().trim();
          const country = $(cells[1]).text().trim();
          const service = $(cells[2]).text().trim();
          const status = $(cells[3]).text().trim().toLowerCase();
          
          if (number && country) {
            numbers.push({
              number,
              country,
              service,
              status: status === 'available' ? 'available' : 'busy',
              range: service, // Assuming service field contains the range
              added_at: new Date().toISOString()
            });
          }
        }
      });
      
      return numbers;
      
    } catch (error) {
      this.logger.error('Error fetching numbers:', error);
      return [];
    }
  }

  async getNewOTPs() {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }
    
    try {
      const response = await this.axios.get('/ints/client/SMSCDRStats?action=smsreport', {
        headers: {
          Cookie: this.sessionCookie
        }
      });
      
      const $ = cheerio.load(response.data);
      const otps = [];
      
      // Parse OTPs table (adjust selector based on actual HTML)
      $('table tr').each((index, row) => {
        const cells = $(row).find('td');
        
        if (cells.length >= 4) {
          const number = $(cells[0]).text().trim();
          const message = $(cells[1]).text().trim();
          const service = $(cells[2]).text().trim();
          const timestamp = $(cells[3]).text().trim();
          
          // Extract OTP from message
          const otpMatch = message.match(/\b\d{4,8}\b/);
          
          if (otpMatch) {
            otps.push({
              number,
              message,
              service,
              otp_code: otpMatch[0],
              received_at: new Date(timestamp).toISOString() || new Date().toISOString(),
              source: 'panel'
            });
          }
        }
      });
      
      return otps;
      
    } catch (error) {
      this.logger.error('Error fetching OTPs:', error);
      return [];
    }
  }

  getFlagForCountry(countryName) {
    const flagMap = {
      'USA': '🇺🇸',
      'UK': '🇬🇧',
      'Canada': '🇨🇦',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Italy': '🇮🇹',
      'Spain': '🇪🇸',
      'Russia': '🇷🇺',
      'China': '🇨🇳',
      'Japan': '🇯🇵',
      'India': '🇮🇳',
      'Brazil': '🇧🇷',
      'Australia': '🇦🇺',
      'Malaysia': '🇲🇾',
      'Indonesia': '🇮🇩',
      'Philippines': '🇵🇭',
      'Vietnam': '🇻🇳',
      'Thailand': '🇹🇭',
      'Singapore': '🇸🇬',
      'Pakistan': '🇵🇰',
      'Bangladesh': '🇧🇩',
      'Nigeria': '🇳🇬',
      'South Africa': '🇿🇦',
      'Egypt': '🇪🇬',
      'Turkey': '🇹🇷',
      'Saudi Arabia': '🇸🇦',
      'UAE': '🇦🇪'
    };
    
    return flagMap[countryName] || '🏳️';
  }

  // Method to submit captcha solution from Telegram
  submitCaptchaSolution(captchaId, solution) {
    const index = this.captchaQueue.findIndex(item => item.id === captchaId);
    
    if (index !== -1) {
      this.captchaQueue[index].resolve(solution);
      this.captchaQueue.splice(index, 1);
      return true;
    }
    
    return false;
  }
}

module.exports = PanelManager;
