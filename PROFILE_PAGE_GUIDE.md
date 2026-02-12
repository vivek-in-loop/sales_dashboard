# Profile Page Guide

## Overview

The Profile Page allows SDRs to manage their profile information and upload their CSV data files (Gmail send CSV and MailSuite CSV) through a dedicated interface.

## Features

### 1. Profile Management
- View and edit SDR profile information:
  - Name (required)
  - Email
  - Team
  - Role
- Auto-saves profile on creation
- Updates are persisted to the backend database

### 2. Data Upload
- **Gmail Send CSV Upload**: Upload Gmail sent emails export
- **MailSuite CSV Upload**: Upload MailSuite tracking data (opens & clicks)
- Real-time upload progress indicators
- Success/error feedback
- Automatic duplicate prevention

### 3. Data Statistics
- View data statistics:
  - Total Gmail send records
  - Total MailSuite records
- Refresh button to update statistics
- Auto-refreshes after successful uploads

## Accessing the Profile Page

1. Navigate to the Profile page from the sidebar menu
2. The page is accessible at `/profile` route
3. Each SDR has their own isolated profile and data

## How It Works

### SDR Identification

Currently, the profile page uses localStorage to store the current SDR ID:
- On first visit, a new SDR profile is automatically created
- The SDR ID is stored in `localStorage` as `currentSdrId`
- In production, this should be replaced with proper authentication

### Upload Process

1. **Select File**: Click "Choose Gmail Send CSV" or "Choose MailSuite CSV"
2. **Review**: Selected file name is displayed
3. **Upload**: Click "Upload" button
4. **Processing**: Backend processes the CSV:
   - Parses CSV data
   - Normalizes field names
   - Checks for duplicates
   - Inserts new records only
5. **Feedback**: Success/error message displayed
6. **Statistics**: Data statistics automatically refresh

### Duplicate Prevention

- Records are considered duplicates if they have the same:
  - SDR ID
  - Recipient Email
  - Sent Date
- Duplicate records are automatically skipped
- Upload response includes statistics (inserted, skipped, errors)

## API Integration

The Profile Page uses the backend API through `src/utils/api.js`:

- **SDR API**: `sdrApi.getById()`, `sdrApi.create()`, `sdrApi.update()`
- **Data API**: `dataApi.uploadGmailSend()`, `dataApi.uploadMailSuite()`, `dataApi.getStats()`

## Configuration

Set the backend API URL in your environment:

```bash
REACT_APP_API_URL=http://localhost:3001/api
```

Default: `http://localhost:3001/api`

## Future Enhancements

Potential improvements:
- Authentication/authorization integration
- Multiple SDR profile switching
- Upload history
- Data export functionality
- Bulk upload support
- File validation before upload

