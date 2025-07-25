const path = require('path');

// i18n configuration
const i18nConfig = {
  locales: ['en', 'fr', 'es'],
  defaultLocale: 'en',
  queryParameter: 'lang',
  directory: path.join(__dirname, '../../locales'),
  autoReload: true,
  updateFiles: false,
  syncFiles: false,
  objectNotation: true,
  cookie: 'lang',
  register: global
};

// Simple i18n implementation
class I18n {
  constructor(config) {
    this.config = config;
    this.translations = {};
    this.currentLocale = config.defaultLocale;
    
    // Load translations
    this.loadTranslations();
  }

  loadTranslations() {
    const fs = require('fs');
    
    this.config.locales.forEach(locale => {
      try {
        const filePath = path.join(this.config.directory, `${locale}.json`);
        if (fs.existsSync(filePath)) {
          this.translations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
          this.translations[locale] = {};
        }
      } catch (err) {
        console.error(`Error loading locale ${locale}:`, err);
        this.translations[locale] = {};
      }
    });
  }

  setLocale(locale) {
    if (this.config.locales.includes(locale)) {
      this.currentLocale = locale;
    }
  }

  getLocale() {
    return this.currentLocale;
  }

  __(key, ...args) {
    const keys = key.split('.');
    let value = this.translations[this.currentLocale];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to default locale
        value = this.translations[this.config.defaultLocale];
        for (const k2 of keys) {
          if (value && typeof value === 'object' && k2 in value) {
            value = value[k2];
          } else {
            return key; // Return key if translation not found
          }
        }
        break;
      }
    }

    // Replace placeholders
    if (typeof value === 'string' && args.length > 0) {
      args.forEach((arg, index) => {
        value = value.replace(`{${index}}`, arg);
      });
    }

    return value || key;
  }

  __n(singular, plural, count) {
    const key = count === 1 ? singular : plural;
    return this.__(key).replace('%s', count);
  }

  getCatalog(locale) {
    return this.translations[locale || this.currentLocale] || {};
  }

  getLocales() {
    return this.config.locales;
  }
}

// i18n middleware
async function i18nMiddleware(req, res, next) {
  console.log('i18n middleware called for URL:', req.url, 'user:', req.auth?.userId);
  
  // Get locale from various sources - prioritize query param first
  let locale = req.query.lang;
  
  console.log('i18n - initial locale sources:', {
    queryLang: req.query.lang,
    cookieLang: req.cookies.lang,
    userAuth: req.auth?.userId
  });
  
  // If user is authenticated, try to get their preference (unless overridden by query param)
  if (req.auth && req.auth.userId && !locale) {
    try {
      const db = require('../db');
      const user = await db.User.findByPk(req.auth.userId, {
        attributes: ['preferred_language']
      });
      console.log('DEBUG i18n middleware - user language check:', {
        userId: req.auth.userId,
        preferred_language: user?.preferred_language,
        currentLocale: locale,
        queryLang: req.query.lang,
        cookieLang: req.cookies.lang
      });
      if (user && user.preferred_language) {
        locale = user.preferred_language;
        console.log('DEBUG i18n middleware - using user preferred language:', locale);
      } else {
        console.log('DEBUG i18n middleware - no user preferred language found');
      }
    } catch (err) {
      console.error('Error fetching user language preference:', err);
    }
  }
  
  // If still no locale, check cookie
  if (!locale) {
    locale = req.cookies.lang;
    console.log('DEBUG i18n middleware - using cookie language:', locale);
  }
  
  // Fallback to accept-language header or default
  if (!locale) {
    locale = req.acceptsLanguages(i18n.config.locales) || i18n.config.defaultLocale;
    console.log('DEBUG i18n middleware - using fallback language:', locale);
  }

  // Ensure locale is valid
  if (!i18n.config.locales.includes(locale)) {
    locale = i18n.config.defaultLocale;
  }

  // Create i18n instance for this request
  req.i18n = Object.create(i18n);
  req.i18n.setLocale(locale);
  
  console.log('i18n middleware - final locale set:', locale, 'for user:', req.auth?.userId);

  // Helper functions
  res.locals.__ = (key, ...args) => req.i18n.__(key, ...args);
  res.locals.__n = (singular, plural, count) => req.i18n.__n(singular, plural, count);
  res.locals.locale = locale;
  res.locals.locales = i18n.config.locales;

  // Set cookie if different
  if (req.cookies.lang !== locale) {
    res.cookie('lang', locale, { 
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
      sameSite: 'lax'
    });
  }

  next();
}

// Create global instance
const i18n = new I18n(i18nConfig);

module.exports = {
  i18n,
  i18nConfig,
  i18nMiddleware
};