const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvFile = path.join(__dirname, 'harshit.gupta_send.csv');
const data = fs.readFileSync(csvFile, 'utf-8');

// Parse CSV
const lines = data.trim().split('\n');
const headers = lines[0].split(',');

// Find the recipient_email column index
const emailIndex = headers.findIndex(h => h.trim().toLowerCase() === 'recipient_email');

if (emailIndex === -1) {
  console.log('Could not find recipient_email column');
  console.log('Available columns:', headers);
  process.exit(1);
}

// Extract all emails
const allEmails = [];
const emailCounts = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  // Simple CSV parsing (handles basic cases)
  const parts = line.split(',');
  const email = parts[emailIndex]?.trim().toLowerCase();
  
  if (email) {
    allEmails.push(email);
    emailCounts[email] = (emailCounts[email] || 0) + 1;
  }
}

// Get unique emails
const uniqueEmails = Object.keys(emailCounts);

// Find duplicates (emails that appear more than once)
const duplicates = Object.entries(emailCounts)
  .filter(([email, count]) => count > 1)
  .sort((a, b) => b[1] - a[1]);

// Print results
console.log('='.repeat(60));
console.log('EMAIL ANALYSIS REPORT');
console.log('='.repeat(60));
console.log(`\nFile: ${csvFile}`);
console.log(`Total rows (excluding header): ${lines.length - 1}`);
console.log(`Total emails found: ${allEmails.length}`);
console.log(`Unique emails: ${uniqueEmails.length}`);
console.log(`Duplicate emails: ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log('\n' + '-'.repeat(60));
  console.log('TOP 20 DUPLICATE EMAILS (email: count)');
  console.log('-'.repeat(60));
  duplicates.slice(0, 20).forEach(([email, count]) => {
    console.log(`  ${email}: ${count} times`);
  });
  
  if (duplicates.length > 20) {
    console.log(`  ... and ${duplicates.length - 20} more duplicates`);
  }
}

// Extract domains
const domains = {};
uniqueEmails.forEach(email => {
  const domain = email.split('@')[1];
  if (domain) {
    domains[domain] = (domains[domain] || 0) + 1;
  }
});

const topDomains = Object.entries(domains)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

console.log('\n' + '-'.repeat(60));
console.log('TOP 15 DOMAINS');
console.log('-'.repeat(60));
topDomains.forEach(([domain, count]) => {
  console.log(`  ${domain}: ${count} unique emails`);
});

console.log('\n' + '='.repeat(60));
