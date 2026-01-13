# MailSuite Pro Integration - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### MailSuite Pro Web API Support

MailSuite Pro offers multiple APIs including Web API, REST API, PHP API, and JavaScript API.
This integration uses **MailSuite Pro Web API** to fetch tracking data.

**Documentation**: https://afterlogic.com/docs/mailsuite-pro-8/developers-guide/using-web-api

### Step 1: Configure MailSuite Pro API URL

1. **Get your MailSuite Pro server URL**
   - Example: `https://your-server.com/mailsuite`
   - Or: `https://mailsuite.yourdomain.com`

2. **Add to `.env` file**:
   ```env
   REACT_APP_MAILSUITE_API_URL=https://your-server.com/mailsuite
   ```

3. **Restart development server**:
   ```bash
   npm start
   ```

### Step 2: Authenticate with MailSuite Pro

1. Open dashboard
2. Click settings/upload button
3. Find "MailSuite Pro Integration" card (purple border)
4. Enter your **MailSuite Pro username (email)** and **password**
5. Click **"Authenticate with MailSuite Pro"**

**Note**: MailSuite Pro uses its own authentication system, separate from Google OAuth. You need your MailSuite Pro account credentials.

### Step 3: Fetch Data

1. **Select date range** (defaults to last 30 days)
2. Click **"Fetch Opens & Clicks from MailSuite"**
3. Data will automatically populate your Opens CSV

### That's It! 🎉

No API URLs, no tokens, no configuration needed. Just sign in with Google and fetch your data.

---

## 🔄 How It Works

1. **Each SDR signs in** with their own Google account
2. **System uses Google OAuth** to authenticate with MailSuite
3. **Fetches tracking data** for the signed-in user's account
4. **Automatically formats** data to match your CSV structure

---

## 🔧 Troubleshooting

**Error: "MailSuite Pro API URL not configured"**
- ✅ Add `REACT_APP_MAILSUITE_API_URL` to `.env` file
- ✅ Use your MailSuite Pro server URL (e.g., `https://your-server.com/mailsuite`)
- ✅ Restart development server after updating `.env`

**Error: "MailSuite Pro credentials required"**
- ✅ Enter your MailSuite Pro username (email address)
- ✅ Enter your MailSuite Pro password
- ✅ These are your MailSuite Pro account credentials, not Google credentials

**Error: "Authentication failed" or "Invalid username or password"**
- ✅ Verify your MailSuite Pro username (email) and password are correct
- ✅ Check that MailSuite Pro Web API is enabled on your server
- ✅ Verify your account has API access permissions
- ✅ Try logging into MailSuite Pro web interface first to confirm credentials work
- ✅ Check MailSuite Pro documentation for authentication requirements

**Error: "Tracking endpoint not found"**
- ✅ Check MailSuite Pro version (Web API available in v7.5+)
- ✅ Verify API endpoints in MailSuite Pro documentation
- ✅ Contact MailSuite Pro support for API access

**Error: "No tracking data found"**
- ✅ Verify emails were sent with MailSuite tracking enabled
- ✅ Try a different date range
- ✅ Check that tracking data exists in MailSuite Pro

**Still having issues?**
- Check browser console for detailed errors
- Review MailSuite Pro Web API documentation
- Export CSV from MailSuite Pro and upload manually (always works!)

---

## 📖 Full Guide

For detailed instructions, see: **MAILSUITE_SETUP_GUIDE.md**

---

## 📚 MailSuite Pro API Documentation

- **Web API**: https://afterlogic.com/docs/mailsuite-pro-8/developers-guide/using-web-api
- **REST API**: https://afterlogic.com/docs/mailsuite-pro-8/developers-guide/rest-api
- **Full Documentation**: https://afterlogic.com/docs/mailsuite-pro

