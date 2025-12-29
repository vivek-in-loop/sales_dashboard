# 📊 Dashboard Calculations Guide

Complete explanation of how every metric in the Sales Email Analytics Dashboard is calculated.

---

## 📧 Email Analytics KPIs

### Data Processing Pipeline

Before calculations, data goes through this pipeline:

1. **Normalize** Send CSV → Clean headers and data
2. **Normalize** Open CSV → Clean headers and data
3. **Filter** Send data → Remove loopwork.co domains
4. **Filter** Open data → Split recipient names, convert dates
5. **Join** Send + Open → Match by email + datetime (±60 seconds)
6. **Join** with Contacts → Add company URL IDs
7. **Apply Filters** → Date range, SDR filter, search query

After this pipeline, you have three datasets:
- **send_df**: Original send data (filtered)
- **send_open_df**: Send data joined with open data
- **final_data**: Send+Open+Contacts (fully enriched)

---

## Stage 1: Send Data KPIs

These metrics use **send_open_df** (send data with Views/Clicks attached).

### 1. Total Sends

```javascript
totalSends = send_open_df.length
```

**What it is**: Count of all email records after filtering  
**Source**: All rows in the filtered Send + Open dataset  
**Example**: 1,000 rows = 1,000 total sends

---

### 2. Total Prospect Count

```javascript
totalProspects = new Set(
  send_open_df.map(row => row['Recipient Email'])
).size
```

**What it is**: Number of unique email addresses contacted  
**Source**: Unique count of "Recipient Email" column  
**Example**: 1,000 sends to 300 unique emails = 300 prospects  
**Why unique?**: Same prospect may receive multiple emails

---

### 3. Open Rate

```javascript
// Count emails where Views is not null/empty and > 0
recordsWithOpens = send_open_df.filter(row => {
  const views = row.Views;
  return views != null && views !== '' && Number(views) > 0;
});

openRate = (recordsWithOpens.length / totalSends) * 100
```

**What it is**: Percentage of emails that were opened (had at least 1 view)  
**Formula**: (Emails with Views > 0) ÷ Total Sends × 100  
**Example**:
- Total Sends: 1,000
- Emails with Views > 0: 450
- Open Rate: 450 ÷ 1,000 × 100 = **45.0%**

**Important**: 
- Views = null → NOT opened
- Views = "" (empty) → NOT opened
- Views = 0 → NOT opened
- Views > 0 → OPENED ✅

---

### 4. Prospect Opened Rate

```javascript
// Get unique prospects who opened (Views > 0)
openedProspects = new Set(
  send_open_df
    .filter(row => row.Views != null && row.Views !== '' && Number(row.Views) > 0)
    .map(row => row['Recipient Email'])
).size

prospectOpenedRate = (openedProspects / totalProspects) * 100
```

**What it is**: Percentage of unique prospects who opened at least one email  
**Formula**: (Unique prospects with opens) ÷ Total unique prospects × 100  
**Example**:
- Total Prospects: 300 unique emails
- Prospects who opened: 180 unique emails
- Prospect Opened Rate: 180 ÷ 300 × 100 = **60.0%**

**Difference from Open Rate**:
- **Open Rate**: % of individual emails opened
- **Prospect Opened Rate**: % of unique people who opened

**Example Scenario**:
- Prospect A gets 5 emails, opens 3 → Counts as 1 opened prospect
- Prospect B gets 2 emails, opens 0 → Counts as 0 opened prospects

---

### 5. Total Views

```javascript
totalViews = send_open_df.reduce((sum, row) => {
  return sum + (Number(row.Views) || 0);
}, 0)
```

**What it is**: Sum of all view counts across all emails  
**Source**: Sum of the "Views" column (treat null/empty as 0)  
**Example**: Email A: 3 views, Email B: 5 views, Email C: 0 views → **8 total views**

---

### 6. Total Clicks

```javascript
totalClicks = send_open_df.reduce((sum, row) => {
  return sum + (Number(row.Clicks) || 0);
}, 0)
```

**What it is**: Sum of all click counts across all emails  
**Source**: Sum of the "Clicks" column (treat null/empty as 0)  
**Example**: Email A: 2 clicks, Email B: 1 click, Email C: 0 clicks → **3 total clicks**

---

## Stage 2: Final Data KPIs

These metrics use **final_data** (Send + Open + Contacts joined).

### 7. Accounts Owned

```javascript
accountsOwned = new Set(
  final_data.map(row => row['Company URL ID'])
).size
```

**What it is**: Number of unique companies contacted (from Contacts CSV)  
**Source**: Unique count of "Company URL ID" from the Contacts join  
**Example**: 
- 1,000 emails sent
- Matched to 150 unique Company URL IDs
- Accounts Owned: **150**

**Why it matters**: Shows how many distinct companies you're engaging

---

### 8. Contact Match Rate

```javascript
contactMatchRate = (final_data.length / send_open_df.length) * 100
```

**What it is**: Percentage of emails that matched with a contact in your Contacts CSV  
**Formula**: (Records in final_data) ÷ (Records in send_open_df) × 100  
**Example**:
- Send+Open records: 1,000
- Matched with Contacts: 850
- Contact Match Rate: 850 ÷ 1,000 × 100 = **85.0%**

**Why it matters**: Shows data quality and how many prospects are in your CRM

---

### 9. High Engagement Accounts

```javascript
// Group by Company URL
companyGroups = groupBy(final_data, 'Company URL')

// For each company, calculate totals
companyEngagement = companyGroups.map(company => ({
  companyUrl: company[0]['Company URL'],
  totalEmails: company.length,
  totalViews: company.reduce((sum, row) => sum + (Number(row.Views) || 0), 0),
  totalClicks: company.reduce((sum, row) => sum + (Number(row.Clicks) || 0), 0)
}))

// Filter: totalViews > 2 × totalEmails
highEngagementCompanies = companyEngagement.filter(
  company => company.totalViews > (2 * company.totalEmails)
)

highEngagementAccounts = highEngagementCompanies.length
```

**What it is**: Number of companies where total views exceeded 2× the total emails sent  
**Logic**: If a company got 10 emails and had 21+ views → High engagement  
**Example**:
- Company A: 10 emails, 25 views → 25 > (2 × 10) ✅ High engagement
- Company B: 10 emails, 18 views → 18 < (2 × 10) ❌ Not high engagement
- Company C: 5 emails, 11 views → 11 > (2 × 5) ✅ High engagement
- **High Engagement Accounts**: 2 (Company A and C)

**Why 2×?**: Shows companies viewing emails multiple times (strong interest)

---

## 🏆 SDR Leaderboard

Calculated per SDR from their individual data:

### Per-SDR Metrics

```javascript
// For each SDR
sdrStats = {
  name: "SDR Name",
  totalSends: sdr_records.length,
  
  uniqueProspects: new Set(
    sdr_records.map(r => r['Recipient Email'])
  ).size,
  
  openRate: (
    sdr_records.filter(r => r.Views > 0).length / sdr_records.length
  ) * 100,
  
  totalViews: sdr_records.reduce((sum, r) => sum + (r.Views || 0), 0),
  
  totalClicks: sdr_records.reduce((sum, r) => sum + (r.Clicks || 0), 0),
  
  highEngagementCount: // Same logic as above, but for SDR's companies
}
```

### SDR Ranking Score

```javascript
// Each SDR gets a score based on:
score = (
  (totalSends / maxSends) * 30 +           // 30% weight
  (openRate / maxOpenRate) * 40 +          // 40% weight
  (highEngagementCount / maxHighEng) * 30  // 30% weight
) * 100

// Rank SDRs by score (highest to lowest)
// Top 3 get medals (🥇 🥈 🥉)
```

**What it is**: Composite score ranking SDRs by volume, quality, and impact  
**Components**:
1. **Volume (30%)**: Total sends compared to top SDR
2. **Quality (40%)**: Open rate compared to top SDR
3. **Impact (30%)**: High engagement accounts compared to top SDR

**Example**:
- SDR A: 500 sends, 50% open rate, 20 high-engagement → Score: 95
- SDR B: 400 sends, 60% open rate, 15 high-engagement → Score: 88
- SDR C: 300 sends, 45% open rate, 10 high-engagement → Score: 72

---

## 🔥 Company Engagement Analysis

### High Engagement Companies

```javascript
// Step 1: Group all emails by Company
companyGroups = groupBy(final_data, [
  'Company',
  'Company Name', 
  'Company / Account',
  'Company URL' // also extract domain
])

// Step 2: For each company, calculate metrics
companies = companyGroups.map(group => {
  const totalEmails = group.length
  const totalViews = group.reduce((sum, r) => sum + (r.Views || 0), 0)
  const totalClicks = group.reduce((sum, r) => sum + (r.Clicks || 0), 0)
  
  return {
    company: group[0]['Company'],
    emails: totalEmails,
    views: totalViews,
    clicks: totalClicks,
    engagementRate: (totalViews / totalEmails) * 100
  }
})

// Step 3: Filter for high engagement (Views > 2× Emails)
highEngagementCompanies = companies.filter(
  c => c.views > (2 * c.emails)
)

// Step 4: Sort by engagement rate (highest first)
highEngagementCompanies.sort((a, b) => b.engagementRate - a.engagementRate)
```

**Example Output**:
```
🔥 HIGH | tryautobrush.com
📧 1 emails │ 👁️ 23 views │ 🖱️ 1 clicks │ 📊 2300.0% rate

🔥 HIGH | typeonestyle.com
📧 7 emails │ 👁️ 136 views │ 🖱️ 0 clicks │ 📊 1942.9% rate
```

**Engagement Rate Formula**: (Total Views ÷ Total Emails) × 100

---

## ⭐ High Engagement Prospects

Same logic as companies, but grouped by individual prospects:

```javascript
// Step 1: Group by Recipient Email
prospectGroups = groupBy(final_data, 'Recipient Email')

// Step 2: Calculate per-prospect metrics
prospects = prospectGroups.map(group => {
  const totalEmails = group.length
  const totalViews = group.reduce((sum, r) => sum + (r.Views || 0), 0)
  const totalClicks = group.reduce((sum, r) => sum + (r.Clicks || 0), 0)
  
  return {
    email: group[0]['Recipient Email'],
    name: group[0]['Recipient Name'],
    company: group[0]['Company'],
    emails: totalEmails,
    views: totalViews,
    clicks: totalClicks,
    engagementRate: (totalViews / totalEmails) * 100
  }
})

// Step 3: Filter for high engagement (Views > 2× Emails)
highEngagementProspects = prospects.filter(
  p => p.views > (2 * p.emails)
)

// Step 4: Sort by engagement rate
highEngagementProspects.sort((a, b) => b.engagementRate - a.engagementRate)
```

**Example**:
- Prospect: john@company.com
- Emails sent: 5
- Total views: 12
- Engagement Rate: 12 ÷ 5 × 100 = **240%**
- Status: ✅ High engagement (12 > 2 × 5)

---

## 📞 Calls Analytics KPIs

### File Summary (Unfiltered)

```javascript
totalRecords = calls_data.length

uniqueCompanies = new Set(
  calls_data.map(r => r['Company / Account'])
).size

connectedRecords = calls_data.filter(
  r => r['Call Disposition']?.toLowerCase().trim() === 'connected'
).length

connectRate = (connectedRecords / totalRecords) * 100
```

---

### Filtered Call Metrics

After applying date range and SDR filters:

```javascript
// 1. Total Calls
totalCalls = filtered_data.length

// 2. Unique Companies
uniqueCompanies = new Set(
  filtered_data.map(r => r['Company / Account'])
).size

// 3. Connect Rate
connectedCalls = filtered_data.filter(
  r => r['Call Disposition']?.toLowerCase().trim() === 'connected'
).length
connectRate = (connectedCalls / totalCalls) * 100

// 4. Total Duration
totalSeconds = filtered_data.reduce(
  (sum, r) => sum + (Number(r['Call Duration (seconds)']) || 0),
  0
)
totalHours = totalSeconds / 3600

// 5. Unique Contacts
uniqueContacts = new Set(
  filtered_data.map(r => r['Contact'])
).size

// 6. Top Disposition
dispositions = filtered_data.map(r => r['Call Disposition'])
dispositionCounts = countOccurrences(dispositions)
topDisposition = mostFrequent(dispositionCounts)

// 7. Disposition Types
uniqueDispositions = new Set(
  filtered_data.map(r => r['Call Disposition'])
).size

// 8. Daily Average
dates = filtered_data.map(r => new Date(r['Date']))
minDate = Math.min(...dates)
maxDate = Math.max(...dates)
days = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)))
dailyAvg = totalCalls / days
```

---

## 🔗 Combined Analytics KPIs

Joins email and call data by Recipient Email:

### Join Summary

```javascript
// Email records
totalEmailRecords = email_data.length

// Join with calls
joinedRecords = email_data.map(email => {
  const calls = calls_data.filter(
    call => call['Contact Email'] === email['Recipient Email']
  )
  
  return {
    ...email,
    Total_Calls: calls.length,
    Connected_Calls: calls.filter(c => c['Call Disposition'] === 'connected').length,
    Total_Call_Duration: calls.reduce((sum, c) => sum + (c['Call Duration (seconds)'] || 0), 0)
  }
})

// Join stats
joined = joinedRecords.filter(r => r.Total_Calls > 0).length
emailOnly = totalEmailRecords - joined
joinSuccessRate = (joined / totalEmailRecords) * 100
```

### Combined Metrics

```javascript
// After filtering combined data:

totalEmails = filtered_combined.length

totalViews = filtered_combined.reduce((sum, r) => sum + (r.Views || 0), 0)

totalClicks = filtered_combined.reduce((sum, r) => sum + (r.Clicks || 0), 0)

recordsWithCalls = filtered_combined.filter(r => r.Total_Calls > 0).length

totalCallsMade = filtered_combined.reduce((sum, r) => sum + (r.Total_Calls || 0), 0)
```

---

## 📊 Trend Analysis

### Week-by-Week

```javascript
// Group data by week
weeklyData = groupBy(data, row => {
  return startOfWeek(new Date(row['Sent Date']))
})

// For each week, calculate:
weeklyStats = weeklyData.map(week => ({
  weekStart: week.date,
  sends: week.records.length,
  opens: week.records.filter(r => r.Views > 0).length,
  openRate: (opens / sends) * 100,
  views: week.records.reduce((sum, r) => sum + (r.Views || 0), 0),
  clicks: week.records.reduce((sum, r) => sum + (r.Clicks || 0), 0)
}))
```

### Month-by-Month

Same logic as week-by-week, but using `startOfMonth()`.

---

## 🎯 Key Concepts Summary

### Unique vs Total Counts

- **Total Sends**: Every email sent (can be multiple to same person)
- **Total Prospects**: Unique email addresses contacted
- **Opened Prospects**: Unique people who opened (not total opens)

### Open Metrics

- **Views = 0 or null or ""**: Email NOT opened
- **Views > 0**: Email was opened
- **Views can be > 1**: Person opened multiple times

### Engagement Thresholds

- **High Engagement**: Total Views > 2× Total Emails
- **Why 2×?**: Average is 1 view per email; 2× shows strong interest

### Rate Calculations

Always: `(Count of X / Total) × 100`

Examples:
- Open Rate: Opens ÷ Total Sends × 100
- Connect Rate: Connected Calls ÷ Total Calls × 100
- Contact Match: Matched Records ÷ Total Records × 100

---

## 🔄 Data Flow Summary

```
1. Upload CSVs
   ↓
2. Normalize headers & data
   ↓
3. Filter out invalid data
   ↓
4. Join Send + Open (by email + time)
   ↓
5. Join with Contacts (by email)
   ↓
6. Apply user filters (date, SDR, search)
   ↓
7. Calculate KPIs
   ↓
8. Display in dashboard
```

---

## 💡 Tips for Interpretation

### Good Open Rate
- **20-30%**: Industry average
- **30-50%**: Good performance
- **50%+**: Excellent targeting

### High Engagement
- **Few companies with 500%+ rate**: Very interested prospects
- **Focus on these**: Prioritize for follow-up

### SDR Performance
- **Balance matters**: High volume + high quality = top performer
- **Don't just look at sends**: Quality (open rate) matters more

### Contact Match Rate
- **80%+**: Good data quality
- **<50%**: Many prospects not in CRM (update contacts)

---

## 📝 Example Walkthrough

**Scenario**: You sent 100 emails to 50 unique prospects.

**Raw Data**:
- 100 emails sent
- 60 emails have Views > 0
- 35 unique prospects opened at least one email
- 25 prospects matched with Contacts CSV
- Total views across all emails: 150
- Total clicks: 30

**Calculated KPIs**:
- **Total Sends**: 100
- **Total Prospects**: 50
- **Open Rate**: 60 ÷ 100 × 100 = **60%**
- **Prospect Opened Rate**: 35 ÷ 50 × 100 = **70%**
- **Total Views**: 150
- **Total Clicks**: 30
- **Contact Match Rate**: 25 ÷ 100 × 100 = **25%**

**Interpretation**:
- 60% of emails were opened (good!)
- 70% of prospects engaged (excellent!)
- But only 25% are in your CRM (needs improvement)

---

Need clarification on any calculation? Ask the AI Assistant in the dashboard! 🤖

