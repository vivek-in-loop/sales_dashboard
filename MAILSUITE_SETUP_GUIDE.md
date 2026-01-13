# MailSuite API Configuration - Step-by-Step Guide

This guide will help you configure MailSuite API integration to fetch email tracking data directly.

## Step 1: Identify Your MailSuite Service

First, determine which MailSuite service you're using:

### Option A: MailSuite (Chrome Extension / Email Tracking Service)
- If you're using a Chrome extension or web-based email tracking service
- Check if it's: **MailSuite**, **MailSuite.io**, or similar

### Option B: MailSuite Pro (Enterprise Email Server)
- If you're using MailSuite Pro (by AfterLogic)
- This is an enterprise email server solution

### Option C: Other MailSuite Service
- Check your email provider or tracking service documentation

---

## Step 2: Check for API Availability

### For MailSuite (Chrome Extension/Web Service):

1. **Check MailSuite Dashboard/Website**:
   - Log into your MailSuite account
   - Look for: Settings → API, Developer, Integrations, or Webhooks
   - Check for "API Access", "Developer Tools", or "API Keys" section

2. **Contact MailSuite Support**:
   - Email: support@mailsuite.com (or check their website for support email)
   - Ask: "Do you provide a REST API for fetching email tracking data (opens & clicks)?"
   - Request: API documentation and endpoint URLs

3. **Check Documentation**:
   - Visit: https://mailsuite.com/docs (or their documentation site)
   - Search for: "API", "REST API", "Webhooks", "Developer"

### For MailSuite Pro:

1. **Check MailSuite Pro Documentation**:
   - Visit: https://afterlogic.com/docs/mailsuite-pro
   - Look for: "Web API" or "Integration" sections
   - MailSuite Pro has a Web API that supports OAuth

2. **Access MailSuite Pro Admin Panel**:
   - Log into your MailSuite Pro admin interface
   - Navigate to: Settings → API or External Services
   - Enable API access if available

---

## Step 3: Get API Credentials (If API Exists)

### If MailSuite Provides API:

1. **Get API Base URL**:
   - Example formats:
     - `https://api.mailsuite.com`
     - `https://api.mailsuite.io/v1`
     - `https://your-company.mailsuite.com/api`
   - This will be provided in their API documentation

2. **Get API Key/Token** (if required):
   - Some APIs require an API key in addition to OAuth
   - Check MailSuite's API documentation for authentication requirements

3. **Verify OAuth Support**:
   - Check if MailSuite API accepts Google OAuth tokens
   - Or if it requires separate MailSuite API credentials

---

## Step 4: Configure Environment Variables

### Step 4.1: Locate or Create `.env` File

1. **Navigate to your project root**:
   ```bash
   cd /Users/vivekkumarbaroliya/sales_dashboard/salesdashbaord
   ```

2. **Check if `.env` file exists**:
   ```bash
   ls -la | grep .env
   ```

3. **If `.env` doesn't exist, create it**:
   ```bash
   touch .env
   ```

### Step 4.2: Add MailSuite API Configuration

Open `.env` file in a text editor and add:

```env
# MailSuite API Configuration
REACT_APP_MAILSUITE_API_URL=https://api.mailsuite.com
```

**Replace `https://api.mailsuite.com` with your actual MailSuite API URL**

### Step 4.3: Example `.env` File (Complete)

Your `.env` file should look something like this:

```env
# Google OAuth Configuration (already configured)
REACT_APP_GOOGLE_API_KEY=your_google_api_key_here
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here

# MailSuite API Configuration (NEW)
REACT_APP_MAILSUITE_API_URL=https://api.mailsuite.com
```

**Important Notes**:
- Do NOT commit `.env` file to git (it should be in `.gitignore`)
- Replace placeholder URLs with actual values
- No spaces around the `=` sign
- No quotes needed around the URL

---

## Step 5: Restart Development Server

After updating `.env` file:

1. **Stop your current development server** (if running):
   - Press `Ctrl+C` in the terminal where it's running

2. **Start the server again**:
   ```bash
   npm start
   # or
   yarn start
   ```

3. **Why restart?**
   - Environment variables are loaded when the app starts
   - Changes to `.env` require a restart to take effect

---

## Step 6: Test the Integration

1. **Open your dashboard** in the browser
2. **Click the settings/upload button** to open the dialog
3. **Find the "MailSuite Integration" card** (purple border)
4. **Click "Sign in with Google"** (if not already signed in)
5. **Select a date range**
6. **Click "Fetch Opens & Clicks from MailSuite"**
7. **Check for errors**:
   - If successful: You'll see "✓ Tracking data fetched successfully!"
   - If error: Check the error message for clues

---

## Step 7: Troubleshooting

### Error: "MailSuite API URL not configured"
- **Solution**: Make sure `REACT_APP_MAILSUITE_API_URL` is in `.env` file
- **Check**: Restart the development server after adding it

### Error: "404 Not Found" or "Invalid endpoint"
- **Solution**: The API URL might be incorrect
- **Action**: Verify the URL with MailSuite support/documentation
- **Check**: Make sure you're using the correct API version (v1, v2, etc.)

### Error: "401 Unauthorized" or "403 Forbidden"
- **Solution**: API might require additional authentication
- **Action**: Check if MailSuite API needs API keys or different OAuth scopes
- **Update**: You may need to modify `src/utils/mailSuiteApi.js` to add API key headers

### Error: "MailSuite API is not configured"
- **Solution**: 
  1. Check `.env` file exists and has the variable
  2. Make sure variable name is exactly: `REACT_APP_MAILSUITE_API_URL`
  3. Restart the development server
  4. Check browser console for any errors

---

## Alternative: If MailSuite Doesn't Have an API

If MailSuite doesn't provide a REST API, you have these options:

### Option 1: Continue Using CSV Exports (Recommended)
- Export tracking data from MailSuite as CSV
- Upload the CSV file manually in the dashboard
- This is the current method and works perfectly

### Option 2: Request API Access
- Contact MailSuite support to request API access
- They may provide it for enterprise customers
- Once you have API access, follow steps above

### Option 3: Use MailSuite Webhooks (If Available)
- Check if MailSuite supports webhooks
- Set up webhooks to receive tracking data automatically
- This requires backend server setup

### Option 4: Browser Automation (Not Recommended)
- Use tools like Puppeteer to automate CSV exports
- Complex and not recommended for production use

---

## Quick Reference: Common MailSuite API URLs

Based on common MailSuite services, try these (if applicable):

```env
# MailSuite.io (if that's your service)
REACT_APP_MAILSUITE_API_URL=https://api.mailsuite.io/v1

# MailSuite.com (if that's your service)
REACT_APP_MAILSUITE_API_URL=https://api.mailsuite.com/v1

# MailSuite Pro (custom installation)
REACT_APP_MAILSUITE_API_URL=https://your-server.com/mailsuite/api

# Generic (replace with actual)
REACT_APP_MAILSUITE_API_URL=https://api.yourmailsuite.com
```

**⚠️ Important**: These are examples. You must get the actual URL from MailSuite documentation or support.

---

## Next Steps After Configuration

Once you have the API URL configured:

1. **Test the integration** (Step 6)
2. **If it works**: Great! You're all set
3. **If it doesn't work**: 
   - Check the error message
   - Verify the API endpoint structure
   - You may need to update `src/utils/mailSuiteApi.js` to match MailSuite's actual API format

---

## Need Help?

1. **Check MailSuite Documentation**: Look for API/Developer sections
2. **Contact MailSuite Support**: Ask about REST API availability
3. **Check Browser Console**: Look for detailed error messages
4. **Review Code**: Check `src/utils/mailSuiteApi.js` for API call structure

---

## Summary Checklist

- [ ] Identified which MailSuite service you're using
- [ ] Checked MailSuite documentation/website for API
- [ ] Contacted MailSuite support (if needed)
- [ ] Obtained API base URL
- [ ] Added `REACT_APP_MAILSUITE_API_URL` to `.env` file
- [ ] Restarted development server
- [ ] Tested the integration
- [ ] Verified data is fetched correctly

Good luck! 🚀

