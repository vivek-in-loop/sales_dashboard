# MailSuite API Integration Setup

This guide explains how to set up MailSuite API integration to fetch email tracking data (opens & clicks) directly using Google OAuth.

## Overview

The MailSuite integration allows you to:
- Sign in with Google (same OAuth as Gmail integration)
- Fetch email tracking data (opens & clicks) directly from MailSuite
- Select a date range for the data you want to fetch
- Automatically populate the Opens CSV file in the dashboard

## Prerequisites

1. **Google OAuth Setup** (already configured for Gmail):
   - `REACT_APP_GOOGLE_API_KEY` - Google API Key
   - `REACT_APP_GOOGLE_CLIENT_ID` - Google OAuth Client ID

2. **MailSuite API Access**:
   - MailSuite API URL endpoint
   - API authentication credentials (if required beyond Google OAuth)

## Setup Steps

### Step 1: Check MailSuite API Availability

MailSuite may or may not have a public REST API. You need to:

1. **Contact MailSuite Support** to inquire about:
   - API availability and documentation
   - API endpoint URLs
   - Authentication requirements
   - Rate limits and quotas

2. **Check MailSuite Documentation**:
   - Look for "API", "Developer", or "Integration" sections
   - Check if they have a Web API (MailSuite Pro mentions Web API support)

### Step 2: Configure Environment Variables

If MailSuite has an API, add to your `.env` file:

```env
# MailSuite API Configuration
REACT_APP_MAILSUITE_API_URL=https://api.mailsuite.com
# Or whatever the actual MailSuite API base URL is
```

### Step 3: Update API Endpoints

If MailSuite API is available, you'll need to update the API endpoints in:
- `src/utils/mailSuiteApi.js`

Specifically, update:
- The `fetchMailSuiteTrackingData` function with the correct endpoint
- The `transformMailSuiteResponse` function to match MailSuite's response format
- Field mappings in `transformRecord` to match MailSuite's field names

### Step 4: Test the Integration

1. Sign in with Google in the MailSuite Integration card
2. Select a date range
3. Click "Fetch Opens & Clicks from MailSuite"
4. Verify that the data is fetched and formatted correctly

## Current Implementation

The current implementation includes:

1. **MailSuiteIntegration Component** (`src/components/MailSuiteIntegration.js`):
   - UI for signing in with Google
   - Date range selection
   - Fetch and download functionality

2. **MailSuite API Utility** (`src/utils/mailSuiteApi.js`):
   - Functions to fetch tracking data from MailSuite API
   - Data transformation to match expected CSV format
   - Error handling and helpful error messages

3. **Integration with EmailAnalyticsPage**:
   - MailSuite component added to the upload dialog
   - Auto-populates the Opens CSV file when data is fetched

## If MailSuite Doesn't Have a Public API

If MailSuite doesn't provide a public API, you have these options:

### Option 1: Continue Using CSV Exports (Current Method)
- Export tracking data from MailSuite as CSV
- Upload the CSV file manually
- This is the current workflow and works well

### Option 2: Request API Access
- Contact MailSuite support to request API access
- They may provide API access for enterprise customers
- Once you have API credentials, follow the setup steps above

### Option 3: Alternative Integration Methods
- Check if MailSuite integrates with Zapier or other automation platforms
- Use webhooks if MailSuite supports them
- Consider browser automation to automate CSV exports (not recommended for production)

## Troubleshooting

### Error: "MailSuite API URL not configured"
- **Solution**: Set `REACT_APP_MAILSUITE_API_URL` in your `.env` file

### Error: "User not signed in"
- **Solution**: Sign in with Google first using the "Sign in with Google" button

### Error: "MailSuite API error: 401 Unauthorized"
- **Solution**: Check that Google OAuth token is valid and MailSuite accepts it
- You may need additional MailSuite-specific API credentials

### Error: "MailSuite API error: 404 Not Found"
- **Solution**: The API endpoint URL may be incorrect
- Verify the endpoint with MailSuite documentation or support

### Data Format Issues
- **Solution**: Update the `transformRecord` function in `mailSuiteApi.js` to match MailSuite's actual response format
- Check MailSuite API documentation for field names

## Next Steps

1. **Contact MailSuite** to determine API availability
2. **If API exists**: Follow setup steps above
3. **If no API**: Continue using CSV exports (current method works fine)
4. **Update code** based on MailSuite's actual API structure once you have access

## Notes

- The integration reuses Google OAuth from the Gmail integration
- Date range filtering is supported
- Data is automatically formatted to match the expected CSV structure
- The component provides helpful error messages if API is not configured

For questions or issues, refer to MailSuite's official documentation or contact their support team.

