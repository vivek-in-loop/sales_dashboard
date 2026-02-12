# Backend Architecture Documentation

## Overview

The backend provides a RESTful API for managing SDR profiles and persisting CSV data (Gmail send data and MailSuite tracking data). It uses SQLite for data storage and Express.js for the API server.

## Architecture Components

### 1. Database Layer (`server/database.js`)

- **Database**: SQLite3
- **Location**: `server/data/sales_dashboard.db`
- **Tables**:
  - `sdrs`: SDR user profiles
  - `gmail_send_data`: Gmail send CSV records
  - `mailsuite_data`: MailSuite CSV records (opens/clicks)

### 2. API Routes

#### SDR Management (`server/routes/sdrs.js`)
- CRUD operations for SDR profiles
- Each SDR has a unique ID (UUID)
- Supports optional fields: name, email, team, role

#### Data Management (`server/routes/data.js`)
- CSV upload endpoints for Gmail and MailSuite data
- CSV download endpoints (for frontend processing)
- Statistics endpoint
- Duplicate prevention logic

### 3. Server Entry Point (`server/index.js`)

- Express server setup
- CORS configuration
- Route registration
- Database initialization
- Health check endpoint

## Data Flow

### Upload Flow

1. Frontend uploads CSV file via POST request
2. Backend parses CSV using `csv-parse`
3. Backend normalizes field names (handles various CSV formats)
4. Backend checks for duplicates (SDR ID + email + date)
5. Backend inserts new records only
6. Backend returns statistics (inserted, skipped, errors)

### Fetch Flow

1. Frontend requests data via GET request
2. Backend queries database for SDR's data
3. Backend converts records to CSV format
4. Backend returns CSV file

## Duplicate Prevention

Records are considered duplicates based on:
- **Gmail Send Data**: `(sdr_id, recipient_email, sent_date)`
- **MailSuite Data**: `(sdr_id, recipient_email, sent_date)`

The database enforces uniqueness via UNIQUE constraints, and the application logic checks before inserting to provide accurate statistics.

## Data Isolation

Each SDR's data is isolated by:
- Foreign key relationship: `sdr_id` references `sdrs.id`
- Cascade delete: Deleting an SDR removes all associated data
- Query filtering: All data queries filter by `sdr_id`

## CSV Format Support

The backend normalizes various CSV column name formats to ensure compatibility with different export formats from Gmail and MailSuite.

### Gmail Send CSV Supported Fields:
- Recipient Name: `Recipient Name`, `recipient_name`, `Recipient`, `Name`
- Sent Date: `Date`, `sent_date`, `Sent Date`, `Sent`
- Email: `Recipient Email`, `recipient_email`, `Email`, `To`
- Domain: `Domain`, `domain`
- Subject: `Subject`, `subject`

### MailSuite CSV Supported Fields:
- Recipient: `Recipient`, `recipient`, `Recipient Name`, `Name`
- Email: `Recipient Email`, `recipient_email`, `Email`, `To`
- Sent Date: `Sent`, `sent_date`, `Sent Date`, `Date`
- Opens: `Opens`, `opens`, `Views`
- Clicks: `Clicks`, `clicks`
- Last Opened: `Last Opened`, `last_opened`, `Last Opened Date`

## Append Mode

New uploads **append** to existing data:
- Existing records are preserved
- Only new records (non-duplicates) are inserted
- No data replacement or truncation

## API Integration with Frontend

The backend is designed to work with the existing frontend without requiring frontend changes:

1. **Current Frontend Flow**: Upload CSV → Process in browser → Display results
2. **New Backend Flow**: Upload CSV → Store in DB → Fetch from DB → Process in browser → Display results

The frontend can continue using the same processing logic (`processMultiSdrPipeline`), but instead of processing uploaded files directly, it can:
1. Upload files to backend (stores in DB)
2. Fetch CSV data from backend (retrieves from DB)
3. Process the fetched CSV data (same as before)

## Security Considerations

- CORS enabled for frontend access
- Input validation on CSV parsing
- SQL injection prevention via parameterized queries
- File size limits (handled by multer)

## Future Enhancements

Potential improvements:
- Authentication/authorization
- Rate limiting
- Data export in other formats (JSON, Excel)
- Bulk operations
- Data validation rules
- Audit logging

