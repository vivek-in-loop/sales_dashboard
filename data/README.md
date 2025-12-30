# Data Directory

This directory contains **sensitive data files** that should NOT be exposed publicly.

## 📁 Folder Structure

```
data/
├── uploads/     # User-uploaded CSV files (Send, Opens, Contacts)
└── outputs/     # Generated output files (successful_matches, failed_records)
```

## 🔒 Security

- **These folders are excluded from Git** (see `.gitignore`)
- Files here are NOT served by the public web server
- Contains sensitive business data and customer information

## 📋 File Types

### uploads/
- `send_data.csv` - Email send records
- `mailsuite_opened_*.csv` - Email open/click tracking data
- `contacts.csv` - Contact information database
- `harshit.gupta_*.csv` - SDR-specific data files

### outputs/
- `successful_matches_*.csv` - Successfully processed and matched records
- `failed_records_*.csv` - Records that failed validation or matching

## ⚠️ Important

- **DO NOT commit these files to Git**
- **DO NOT move these back to the `public/` folder**
- Regularly backup this data to secure storage
- Clean up old output files periodically

## 🔄 Data Flow

```
User Upload → data/uploads/ → Processing Pipeline → data/outputs/ → Dashboard Display
```

---

Generated: 2024-12-30

