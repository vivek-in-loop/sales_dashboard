# 📬 MailSuite Data Processing Guide

Complete explanation of how MailSuite open tracking data (Views & Clicks) is processed in the dashboard.

---

## 🔍 What is MailSuite?

MailSuite is an email tracking tool that monitors:
- **Opens/Views**: How many times a recipient opened/viewed your email
- **Clicks**: How many times links in your email were clicked
- **Open timestamps**: When emails were opened

---

## 📊 MailSuite CSV Structure

### Open/Tracking CSV Columns

MailSuite exports include these key columns:

| Column Name | Description | Example Value |
|------------|-------------|---------------|
| `Recipient` | Email recipient name | "John Doe" |
| `Recipient Email` | Email address | "john@company.com" |
| `Sent` or `sent_date` | When email was sent | "Jul 3, 2025, 02:14:21" |
| `Opens` or `Views` | **Number of times opened** | `3` (opened 3 times) |
| `Clicks` | **Number of link clicks** | `1` (clicked once) |
| `Last Opened` | Timestamp of last open | "Jul 3, 2025, 15:30:00" |

---

## 🔢 How Views (Opens) are Counted

### MailSuite Tracking Logic

MailSuite uses **pixel tracking** to detect opens:

1. **Invisible tracking pixel** embedded in email
2. When recipient opens email → pixel loads → MailSuite records a "view"
3. **Each time** email is opened → counter increments

### Examples

#### Single Open
```
Recipient: john@company.com
Views: 1
```
→ John opened the email **once**

#### Multiple Opens
```
Recipient: jane@company.com
Views: 5
```
→ Jane opened the email **5 times** (shows high interest!)

#### Never Opened
```
Recipient: bob@company.com
Views: 0
```
→ Bob **never opened** the email

#### No Tracking Data
```
Recipient: alice@company.com
Views: (empty/null)
```
→ No tracking data available → **Treated as 0 in dashboard**

---

## 🖱️ How Clicks are Counted

### MailSuite Click Tracking

MailSuite wraps links with tracking URLs:

1. **Original link**: `https://yoursite.com/product`
2. **Tracked link**: `https://mailsuite.track/redirect?url=yoursite.com&id=xyz`
3. When clicked → MailSuite records the click
4. **Each click** on any tracked link increments the counter

### Examples

#### No Clicks
```
Recipient: john@company.com
Views: 3
Clicks: 0
```
→ John opened 3 times but didn't click any links

#### Single Click
```
Recipient: jane@company.com
Views: 5
Clicks: 1
```
→ Jane opened 5 times and clicked a link once

#### Multiple Clicks
```
Recipient: bob@company.com
Views: 2
Clicks: 4
```
→ Bob opened twice and clicked links 4 times (very engaged!)

---

## 🔄 Dashboard Processing Logic

### Step 1: Normalization

When you upload MailSuite Open CSV:

```javascript
function normalizeOpen(rows) {
  return rows.map((row) => {
    // Map column variants
    if (row["Opens"]) → row["Views"] = row["Opens"]
    if (row["Recipient"]) → row["recipient_name"] = row["Recipient"]
    if (row["Sent"]) → row["sent_date"] = row["Sent"]
    
    // Convert Views/Clicks to numbers
    row.Views = row.Views != null && row.Views !== "" 
      ? Number(row.Views) || 0 
      : 0
      
    row.Clicks = row.Clicks != null && row.Clicks !== "" 
      ? Number(row.Clicks) || 0 
      : 0
    
    return row;
  });
}
```

### Step 2: Handling Missing/Empty Values

| MailSuite Value | Dashboard Treats As | Open Status |
|----------------|-------------------|------------|
| `Views = 5` | `5` | ✅ Opened (5 times) |
| `Views = 1` | `1` | ✅ Opened (once) |
| `Views = 0` | `0` | ❌ Not opened |
| `Views = ""` (empty) | `0` | ❌ Not opened |
| `Views = null` | `0` | ❌ Not opened |
| `Views = undefined` | `0` | ❌ Not opened |

**Key Rule**: Only `Views > 0` counts as an open!

---

## ✅ Open Criteria

### What Counts as "Opened"?

```javascript
// An email is considered "opened" if:
const isOpened = (record) => {
  const views = record.Views;
  return views != null && views !== '' && Number(views) > 0;
}

// Examples:
isOpened({ Views: 1 })  → true  ✅
isOpened({ Views: 5 })  → true  ✅
isOpened({ Views: 0 })  → false ❌
isOpened({ Views: "" }) → false ❌
isOpened({ Views: null }) → false ❌
```

### Dashboard KPI Calculation

```javascript
// Open Rate Calculation
const totalSends = allEmails.length  // e.g., 1000

const openedEmails = allEmails.filter(email => {
  return email.Views != null && 
         email.Views !== '' && 
         Number(email.Views) > 0
})  // e.g., 450 emails

const openRate = (openedEmails.length / totalSends) * 100
// 450 / 1000 * 100 = 45.0%
```

---

## 🎯 Engagement Levels

Based on MailSuite Views data:

### Not Engaged
```
Views: 0 or null or empty
Status: Never opened
Action: Send follow-up or try different approach
```

### Low Engagement
```
Views: 1
Status: Opened once, didn't return
Action: Send one more follow-up
```

### Medium Engagement
```
Views: 2-3
Status: Opened multiple times
Action: Good sign, follow up with valuable content
```

### High Engagement
```
Views: 4+
Status: Very interested!
Action: 🔥 Hot lead! Call or send personalized follow-up immediately
```

### Super High Engagement
```
Views: 10+
Clicks: 2+
Status: Extremely interested
Action: 🔥🔥🔥 Top priority! Contact ASAP!
```

---

## 📈 High Engagement Companies/Prospects

### How High Engagement is Determined

The dashboard uses the **2× Rule**:

```javascript
// For a company or prospect to be "high engagement":
// Total Views must be MORE THAN 2× Total Emails

// Example 1: High Engagement ✅
Company: "TechCorp"
Total Emails Sent: 10
Total Views (sum across all emails): 25
Is High Engagement? 25 > (2 × 10) = 25 > 20 → YES ✅

// Example 2: Not High Engagement ❌
Company: "StartupCo"
Total Emails Sent: 10
Total Views: 18
Is High Engagement? 18 > (2 × 10) = 18 > 20 → NO ❌
```

### Why the 2× Threshold?

- **Average engagement**: ~1 view per email
- **Good engagement**: ~1.5 views per email
- **High engagement**: 2+ views per email
- **Indicates**: Strong interest, multiple team members viewing, or recipient reading multiple times

---

## 🔍 Real-World Scenarios

### Scenario 1: Engaged Prospect

```
MailSuite Data:
  Recipient: sarah@techcorp.com
  Email 1: Views: 3, Clicks: 1
  Email 2: Views: 2, Clicks: 0
  Email 3: Views: 4, Clicks: 2

Dashboard Calculates:
  Total Emails: 3
  Total Views: 3 + 2 + 4 = 9
  Total Clicks: 1 + 0 + 2 = 3
  Engagement Rate: (9 / 3) × 100 = 300%
  Status: 🔥 HIGH ENGAGEMENT (9 > 2×3)
```

**Interpretation**: Sarah is very interested! She's opened emails 9 times total and clicked 3 times.

---

### Scenario 2: Cold Prospect

```
MailSuite Data:
  Recipient: john@company.com
  Email 1: Views: 0, Clicks: 0
  Email 2: Views: 0, Clicks: 0
  Email 3: Views: 1, Clicks: 0

Dashboard Calculates:
  Total Emails: 3
  Total Views: 0 + 0 + 1 = 1
  Total Clicks: 0
  Engagement Rate: (1 / 3) × 100 = 33.3%
  Status: Low engagement (1 < 2×3)
```

**Interpretation**: John barely engaged. Only opened once. Try different messaging or channel.

---

### Scenario 3: Company-Level Analysis

```
MailSuite Data for "TechCorp":
  sarah@techcorp.com: 5 emails, 12 views, 3 clicks
  mike@techcorp.com: 3 emails, 8 views, 1 click
  lisa@techcorp.com: 2 emails, 5 views, 2 clicks

Dashboard Calculates:
  Company: TechCorp
  Total Emails: 5 + 3 + 2 = 10
  Total Views: 12 + 8 + 5 = 25
  Total Clicks: 3 + 1 + 2 = 6
  Engagement Rate: (25 / 10) × 100 = 250%
  Status: 🔥 HIGH ENGAGEMENT (25 > 2×10)
```

**Interpretation**: TechCorp is highly engaged! Multiple people viewing multiple times. Prioritize this account!

---

## 🛠️ Technical Details

### Data Join Process

MailSuite data joins with Send data:

```javascript
// Step 1: Match by email address
sendRecord.email === openRecord.email

// Step 2: Match by timestamp (within ±60 seconds)
const timeDiff = Math.abs(
  sendRecord.timestamp - openRecord.timestamp
)
if (timeDiff <= 60) {
  // Match! Merge Views and Clicks into send record
  sendRecord.Views = openRecord.Views
  sendRecord.Clicks = openRecord.Clicks
}
```

### Views/Clicks Conversion

```javascript
// Convert to number, default to 0
Views = Views != null && Views !== "" 
  ? Number(Views) || 0 
  : 0

// Examples of conversion:
"3" → 3
"0" → 0
"" → 0
null → 0
undefined → 0
"abc" → 0 (invalid, defaults to 0)
```

---

## 📊 Dashboard Display

### KPI Cards
- **Total Views**: Sum of all Views across all emails
- **Open Rate**: % of emails with Views > 0

### Company Engagement Matrix
Shows companies with Views > 2× Emails:
```
🔥 HIGH | TechCorp
📧 10 emails │ 👁️ 25 views │ 🖱️ 6 clicks │ 📊 250% rate
```

### Detailed Records Table
Shows individual email records with Views and Clicks columns

---

## ❓ FAQs

### Q: Why do some emails show Views = 0?

**A**: Recipient either:
- Didn't open the email
- Has images/pixels blocked (tracking can't work)
- Uses a privacy-focused email client
- Email went to spam

### Q: Can Views be higher than 1 for a single email?

**A**: Yes! If recipient:
- Opens email multiple times
- Forwards to colleagues who open it
- Views on multiple devices

### Q: Why are Clicks higher than Views sometimes?

**A**: Rare, but possible if:
- Recipient clicked cached version without loading pixel
- Link was shared and clicked by others
- Technical tracking glitch

### Q: What if MailSuite data is missing?

**A**: Dashboard treats missing Views/Clicks as 0:
- Open Rate still calculates (denominator is total sends)
- Those emails count as "not opened"

### Q: How accurate is MailSuite tracking?

**A**: Generally 85-95% accurate. Can be blocked by:
- Privacy email clients (Apple Mail Privacy Protection)
- Corporate email filters
- VPNs/proxies
- Disabled images

---

## 💡 Best Practices

### For SDRs

1. **Check Views regularly**: Look for 3+ views = hot lead
2. **Clicks = very interested**: Follow up immediately
3. **0 views after 3 days**: Try different subject line
4. **Multiple opens, no clicks**: Add better CTAs

### For Analysis

1. **Focus on engagement rate**: Not just open rate
2. **Compare SDRs**: Who gets most repeat opens?
3. **Track by company**: Which accounts are most engaged?
4. **Time-based patterns**: When do prospects open most?

---

## 🎯 Summary

### MailSuite Tracking Criteria

| Metric | MailSuite Records | Dashboard Uses |
|--------|------------------|----------------|
| **Opens/Views** | Pixel load count | `Views > 0` = opened |
| **Clicks** | Link redirect count | Sum for engagement score |
| **No data** | Empty/null | Treat as 0 (not opened) |

### Key Formulas

```javascript
// Is Opened?
opened = Views > 0

// Open Rate
openRate = (emails with Views > 0) / total emails × 100

// High Engagement
highEngagement = Total Views > (2 × Total Emails)

// Engagement Rate
engagementRate = Total Views / Total Emails × 100
```

---

Need more clarification? Ask the AI Assistant in the dashboard! 🤖

It has access to your actual MailSuite data and can answer questions like:
- "Which prospects have the most views?"
- "Show me emails with 5+ views"
- "Why is my open rate 45%?"

