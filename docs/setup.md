Here's a setup documentation in Markdown format for your app:

---

# 🛠 App Setup Guide

This guide explains how to set up and run the application locally.

## 📦 Prerequisites

* **Node.js** (v16+ recommended)
* **PostgreSQL** (Ensure the DB is accessible with the credentials you provide)
* **npm** (comes with Node.js)

---

## 🚀 Getting Started

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd <your-project-folder>
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory and populate it using the template below:

   ```dotenv
   NODE_ENV=development
   PORT=4000
   HOST=localhost

   # Database Configuration
   DB_HOST=<database_host>
   DB_PORT=5432
   DB_NAME=<database_name>
   DB_USER=<database_user>
   DB_PASSWORD="<database_password>"
   DB_SSL=true

   # JWT Configuration
   ACCESS_TOKEN_SECRET="<access_token_secret>"
   REFRESH_TOKEN_SECRET="<refresh_token_secret>"
   ACCESS_TOKEN_EXPIRY=15m
   REFRESH_TOKEN_EXPIRY=7d

   # Security Configuration
   PEPPER="<pepper_secret>"
   CRYPTO_SECRET="<crypto_secret>"
   LOG_ENCRYPTION_ENABLED=true
   REFERENCE_CODE_EXPIRY_DAYS=7

   # CORS Configuration
   CORS_ORIGIN=http://localhost:4000

   # Email Configuration
   EMAIL_FROM=no-reply@example.com
   EMAIL_HOST=mail.example.com
   EMAIL_PORT=25
   EMAIL_USER=no-reply@example.com
   EMAIL_PASSWORD="<email_password>"
   EMAIL_SECURE=false

   # Password Policy
   PASSWORD_MIN_LENGTH=12
   PASSWORD_REQUIRE_UPPERCASE=true
   PASSWORD_REQUIRE_LOWERCASE=true
   PASSWORD_REQUIRE_NUMBER=true
   PASSWORD_REQUIRE_SYMBOL=true

   # Session Settings
   SESSION_DEVICE_BINDING=true
   ```

   > 🔒 Make sure `.env` is listed in `.gitignore` to avoid committing secrets.

4. **Run database migrations and seed**

   ```bash
   npm run migrate
   ```

5. **Create the first admin user**

   ```bash
   npm run create-admin
   ```

---

## ✅ You're Ready!

Start the app using your preferred script (e.g. `nodemon`, `node`, or a custom start script) and access it at:

```
http://localhost:4000
```
