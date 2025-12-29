# 🚫 Data Exclusions Guide

Complete explanation of what emails and data are excluded from the dashboard analysis.

---

## ⚠️ Yes, Some Data is Excluded!

The dashboard excludes certain emails to ensure accurate, meaningful analytics. Here's exactly what gets filtered out:

---

## 🔴 Exclusion #1: Loopwork.co Domains

### What is Excluded?

**All emails sent to `loopwork.co` email addresses are automatically removed.**

### Code Implementation

```javascript
// In emailProcessor.js - normalizeSend()
const filtered = rows.filter((row) => {
  const domain = row.Domain || row.domain || "";
  return !domain.toLowerCase().includes("loopwork.co");
});
```

### Why Are These Excluded?

**Loopwork.co emails are internal/test emails**, not real prospects:
- Internal team testing
- System-generated emails
- QA/demo accounts
- Automated workflows

### Examples of Excluded Emails

```
✅ INCLUDED:
john@techcorp.com
sarah@startup.io
mike@company.co.uk

❌ EXCLUDED:
test@loopwork.co
demo@loopwork.co
internal@loopwork.co
anything@loopwork.co
```

### When This Happens

- **Stage**: During initial data normalization (before any analysis)
- **Impact**: These emails never appear in any KPI or table
- **Automatic**: Happens silently, no user action needed

### How to Check

If your raw CSV has 1,050 emails but dashboard shows 1,000 total sends:
- **50 emails** were to `loopwork.co` domains
- **1,000 emails** are actual prospects (analyzed)

---

## 🔴 Exclusion #2: "Unknown" Companies

### What is Excluded?

**Companies labeled as "Unknown" are excluded from company-level analysis.**

### Where This Applies

**Excluded from**:
- ✅ Company count in "High Engagement Accounts" KPI
- ✅ Company Engagement Analysis section
- ✅ Company matrix/table views
- ✅ "X companies analyzed" headline

**Still included in**:
- ✅ Total Sends KPI
- ✅ Open Rate calculation
- ✅ Individual prospect analysis
- ✅ SDR performance metrics
- ✅ Detailed records table

### Code Implementation

```javascript
// In EmailAnalyticsPage.js - buildCompanyEngagement()
const companies = Array.from(companyMap.values())
  .filter((c) => c.company !== "Unknown") // Exclude Unknown companies
  .map((company) => {
    // ... calculate engagement metrics
  });
```

### Why Are These Excluded?

"Unknown" is a **fallback value** when company name cannot be determined from:
- Company field
- Company Name field
- Company URL
- Email domain

**Example**: If all identification methods fail, company defaults to "Unknown"

### When Does a Company Become "Unknown"?

**Company Identification Priority**:

```javascript
// Step 1: Try direct company name fields
Company, Company Name, Company / Account, Account Name

// Step 2: If not found, extract from Company URL
"https://techcorp.com" → "techcorp.com"

// Step 3: If still not found, extract from email domain
"john@startup.io" → "startup.io"

// Step 4: If all fail → "Unknown"
```

### Examples

#### Example 1: Successfully Identified ✅
```
CSV Data:
  Recipient Email: john@techcorp.com
  Company: TechCorp

Result: Company = "TechCorp" → INCLUDED in analysis
```

#### Example 2: Identified from URL ✅
```
CSV Data:
  Recipient Email: sarah@work.com
  Company: (empty)
  Company URL: https://startup.io

Result: Company = "startup.io" → INCLUDED in analysis
```

#### Example 3: Identified from Email ✅
```
CSV Data:
  Recipient Email: mike@companyxyz.com
  Company: (empty)
  Company URL: (empty)

Result: Company = "companyxyz.com" → INCLUDED in analysis
```

#### Example 4: Unknown (Excluded) ❌
```
CSV Data:
  Recipient Email: (missing or invalid)
  Company: (empty)
  Company URL: (empty)

Result: Company = "Unknown" → EXCLUDED from company analysis
```

---

## 📊 Impact on KPIs

### KPIs Affected by Loopwork.co Exclusion

All KPIs use the filtered dataset (loopwork.co already removed):

| KPI | Impact |
|-----|--------|
| Total Sends | ✅ Count after removing loopwork.co |
| Total Prospects | ✅ Count after removing loopwork.co |
| Open Rate | ✅ Calculated on filtered data |
| All other KPIs | ✅ Use filtered data |

**Result**: More accurate metrics focused on real prospects!

---

### KPIs Affected by "Unknown" Exclusion

Only company-specific metrics:

| Metric | Includes "Unknown"? |
|--------|-------------------|
| **Total Sends** | ✅ Yes |
| **Total Prospects** | ✅ Yes |
| **Open Rate** | ✅ Yes |
| **Total Views/Clicks** | ✅ Yes |
| **Prospect Opened Rate** | ✅ Yes |
| **Accounts Owned** | ❌ Partially (depends on Contacts match) |
| **High Engagement Accounts** | ❌ No (Unknown excluded) |
| **Companies Analyzed** | ❌ No (Unknown excluded) |
| **Company Engagement List** | ❌ No (Unknown excluded) |

**Example**:
```
Total emails: 1,000
Emails to "Unknown" companies: 50
Emails to identified companies: 950

Dashboard shows:
- Total Sends: 1,000 ✅
- Companies Analyzed: 150 (excludes Unknown) ✅
- High Engagement Accounts: 42 (excludes Unknown) ✅
```

---

## 🔍 How to Identify Exclusions in Your Data

### Check for Loopwork.co Exclusions

**Method 1: Count Difference**
```
1. Check your Send CSV: 1,050 rows
2. Check dashboard "Total Sends": 1,000
3. Difference: 50 emails to loopwork.co were excluded
```

**Method 2: Manual Search**
Open your Send CSV and search for `loopwork.co` in the Domain or Recipient Email columns.

---

### Check for Unknown Companies

**Method 1: Dashboard vs CSV**
```
Your CSV unique companies: 200
Dashboard "Companies Analyzed": 180
Difference: 20 companies marked as "Unknown" (excluded)
```

**Method 2: Check Data Quality**
Look at your CSV:
- Count rows with **empty** Company field
- Count rows with **empty** Company URL field
- Count rows with **invalid** email addresses

These are likely to become "Unknown".

---

## 💡 Best Practices

### To Minimize Exclusions

1. **Fill Company Names**: Always include Company or Company Name in your CSV
2. **Add Company URLs**: Provide Company URL as backup identifier
3. **Use Valid Emails**: Ensure Recipient Email is properly formatted
4. **Clean Your Data**: Before upload, review for missing fields

### To Improve Data Quality

**Before uploading CSV**:

```
✅ Good Data:
Recipient Email, Company, Company URL
john@tech.com, TechCorp, https://techcorp.com

❌ Poor Data (becomes "Unknown"):
(empty), (empty), (empty)

⚠️ Risky (may become "Unknown"):
test@email.com, (empty), (empty)
```

---

## 📋 Exclusion Summary Table

| Exclusion Type | What's Excluded | When | Why | Impact |
|---------------|----------------|------|-----|--------|
| **Loopwork.co** | Emails to loopwork.co domains | During normalization | Internal/test emails | All KPIs |
| **Unknown Companies** | Companies that can't be identified | During company analysis | Insufficient data | Company metrics only |

---

## 🎯 Examples with Real Numbers

### Scenario 1: Clean Data (Minimal Exclusions)

**Your CSV**:
- 1,000 email records
- 5 to loopwork.co
- All have company names

**Dashboard Shows**:
- Total Sends: **995** (excluded 5 loopwork.co)
- Companies Analyzed: **150** (all identified)
- High Engagement: **42** (all valid)

**Exclusions**: 0.5% (very good!)

---

### Scenario 2: Missing Company Data

**Your CSV**:
- 1,000 email records
- 5 to loopwork.co
- 100 missing company names/URLs

**Dashboard Shows**:
- Total Sends: **995** (excluded 5 loopwork.co)
- Companies Analyzed: **130** (excluded 20 "Unknown")
- High Engagement: **35** (excluded Unknown)

**Exclusions**: 2.5% (acceptable, but improvable)

---

### Scenario 3: Poor Data Quality

**Your CSV**:
- 1,000 email records
- 50 to loopwork.co
- 300 missing company data

**Dashboard Shows**:
- Total Sends: **950** (excluded 50 loopwork.co)
- Companies Analyzed: **80** (excluded 120 "Unknown")
- High Engagement: **20** (many excluded)

**Exclusions**: 17% (⚠️ needs data cleanup!)

---

## ❓ Common Questions

### Q: Can I see the excluded loopwork.co emails?

**A**: No, they're filtered out before processing. To see them:
1. Open your original Send CSV
2. Search for `loopwork.co` in Domain column

### Q: Can I include loopwork.co emails?

**A**: Currently no. They're automatically excluded to ensure clean analytics. If you need them, you'd need to modify the code.

### Q: Why does my company count seem low?

**A**: Likely many companies are marked as "Unknown" due to:
- Missing Company field
- Missing Company URL
- Invalid email addresses

**Solution**: Fill in company names in your CSV before uploading.

### Q: Do "Unknown" emails still count in Open Rate?

**A**: Yes! "Unknown" companies are only excluded from **company-level** analysis. They still count in:
- Total Sends
- Open Rate
- Prospect metrics
- SDR performance

### Q: How do I improve my data quality?

**A**: Before uploading CSV:
1. ✅ Fill Company or Company Name column
2. ✅ Add Company URL as backup
3. ✅ Verify email format (name@domain.com)
4. ✅ Remove test/internal emails manually
5. ✅ Check for empty rows

---

## 🔄 Data Flow with Exclusions

```
1. Upload CSV (1,000 rows)
   ↓
2. Filter out loopwork.co (50 excluded)
   ↓ 950 rows remain
3. Normalize & clean data
   ↓
4. Join Send + Open + Contacts
   ↓
5. Apply user filters (date, SDR, search)
   ↓ 900 rows remain (after filters)
6. Calculate KPIs on 900 rows ✅
   ↓
7. Group by company (identify 120 companies)
   ↓
8. Exclude "Unknown" companies (20 excluded)
   ↓ 100 companies remain
9. Calculate Company Engagement on 100 companies ✅
```

---

## 💡 Pro Tips

1. **Monitor Exclusions**: If dashboard shows significantly fewer records than CSV, check for:
   - Many loopwork.co emails
   - Missing company data

2. **Data Quality Score**:
   ```
   Quality Score = (Dashboard Sends / CSV Rows) × 100
   
   95-100%: Excellent ✅
   85-95%: Good 👍
   70-85%: Acceptable ⚠️
   <70%: Poor - clean your data ❌
   ```

3. **Best Practice**: Always review a sample of your CSV before uploading to catch data quality issues early.

---

## 📝 Quick Reference

### What Gets Excluded?

1. ❌ **All loopwork.co emails** (from all analysis)
2. ❌ **"Unknown" companies** (from company analysis only)

### What's NOT Excluded?

1. ✅ Emails with Views = 0 (counted as not opened, but included)
2. ✅ Emails with empty Clicks (treated as 0)
3. ✅ Emails not matched with Contacts (still in Send+Open analysis)
4. ✅ Old emails outside date filter (user can adjust filters)

---

Need to check your specific exclusions? Ask the AI Assistant:
- *"How many emails were excluded?"*
- *"Why is my company count different from my CSV?"*
- *"What companies couldn't be identified?"*

The AI has access to your actual data and can help investigate! 🤖

