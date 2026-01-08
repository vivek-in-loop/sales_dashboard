# Gmail Integration Setup Guide

This guide will help you set up Google Gmail OAuth integration to fetch sent emails directly from Gmail.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Sales Dashboard")
5. Click "Create"

## Step 2: Enable Gmail API

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required fields (App name, User support email, Developer contact)
   - Add scopes: `https://www.googleapis.com/auth/gmail.readonly`
   - Add test users (your email) if in testing mode
   - Save and continue
4. Back to Credentials, select "Web application" as the application type
5. Give it a name (e.g., "Sales Dashboard Web Client")
6. Add Authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production - replace with your actual domain)
7. Add Authorized redirect URIs:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
8. Click "Create"
9. **Copy the Client ID** (you'll need this)

## Step 4: Create API Key

1. Still in "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the API Key
4. (Optional) Click "Restrict key" to limit usage to Gmail API only

## Step 5: Configure Environment Variables

1. Create a `.env` file in the root of your project (if it doesn't exist)
2. Add the following variables:

```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_GOOGLE_API_KEY=your-api-key
```

3. Replace `your-client-id` and `your-api-key` with the values from Steps 3 and 4
4. **Important**: Never commit the `.env` file to version control (it should already be in `.gitignore`)

## Step 6: Restart Development Server

After adding the environment variables, restart your React development server:

```bash
npm start
```

## Step 7: Test the Integration

1. Open the application in your browser
2. Click "Upload Data" button
3. You should see a "Gmail Integration" card
4. Click "Sign in with Google"
5. Select your Google account and grant permissions
6. Once signed in, click "Fetch Sent Emails from Gmail"
7. The emails will be automatically converted to CSV format and loaded into the first SDR's Send file

## Troubleshooting

### "Google API credentials not configured" warning
- Make sure your `.env` file exists and has the correct variable names
- Restart your development server after creating/modifying `.env`
- Check that the variable names start with `REACT_APP_`

### "Failed to sign in with Google" error
- Check that your OAuth client ID is correct
- Verify that `http://localhost:3000` is in your Authorized JavaScript origins
- Make sure Gmail API is enabled in your Google Cloud project

### "Failed to fetch Gmail data" error
- Check that you granted the necessary permissions during sign-in
- Verify your Google account has access to Gmail
- Check browser console for detailed error messages

### API Quota Exceeded
- Gmail API has daily quotas. If you exceed them, wait 24 hours or request a quota increase in Google Cloud Console

## Security Notes

- Never expose your API keys or Client IDs in client-side code (they're safe in React env variables as they're public anyway, but restrict API key usage)
- Use environment variables for different environments (development, staging, production)
- Regularly rotate your API keys
- Monitor API usage in Google Cloud Console

## Production Deployment

When deploying to production:

1. Update the OAuth consent screen with your production domain
2. Add your production domain to Authorized JavaScript origins and redirect URIs
3. Update `.env.production` or your hosting platform's environment variables
4. Ensure your production domain uses HTTPS (required for OAuth)

## Support

For more information, refer to:
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

