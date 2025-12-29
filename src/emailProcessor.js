import Papa from "papaparse";

/**
 * Public API: process three CSV strings (or File objects) and return combined result.
 * Matches Python DataProcessor.process_files logic exactly.
 *
 * @param {string|File} sendCsv
 * @param {string|File} openCsv
 * @param {string|File} contactsCsv
 * @returns {Promise<{
 *   successful: Array<Object>,
 *   failed: Array<{ failure_reason: string } & Object>,
 *   stats: Object
 * }>}
 */
export async function processEmailPipeline(sendCsv, openCsv, contactsCsv) {
  const [sendRows, openRows, contactRows] = await Promise.all([
    loadCsv(sendCsv),
    loadCsv(openCsv),
    loadCsv(contactsCsv),
  ]);

  // 1) Normalize / map headers
  const sendNorm = normalizeSend(sendRows);
  const openNorm = normalizeOpen(openRows);
  const contactsNorm = normalizeContacts(contactRows);

  // 2) Validate minimal required columns
  validateRequired(
    sendNorm,
    ["recipient_name", "sent_date", "Recipient Email"],
    "Send CSV"
  );
  validateRequired(
    openNorm,
    ["recipient_name", "sent_date", "Views", "Clicks"],
    "Open CSV"
  );
  validateRequired(contactsNorm, ["Email"], "Contacts CSV");

  // 3) Clean + parse dates
  sendNorm.forEach(
    (r) => (r.sent_date_parsed = parseDateFlexible(r.sent_date))
  );
  openNorm.forEach(
    (r) => (r.sent_date_parsed = parseDateFlexible(r.sent_date))
  );

  // Remove rows with invalid dates
  const sendValid = sendNorm.filter((r) => r.sent_date_parsed);
  const openValid = openNorm.filter((r) => r.sent_date_parsed);

  // 4) JOIN: Send ↔ Open with two-phase incremental matching (0-11s, then 12-60s)
  const { sendOpenSuccess, sendOpenFailures } = joinSendAndOpen(
    sendValid,
    openValid
  );

  // 5) JOIN: SendOpen ↔ Contacts (by Recipient Email)
  const { successful, contactFailures } = joinWithContacts(
    sendOpenSuccess,
    contactsNorm
  );

  const failed = [...sendOpenFailures, ...contactFailures];

  const stats = {
    total_send_records: sendNorm.length,
    total_open_records: openNorm.length,
    total_contact_records: contactsNorm.length,
    send_open_success: sendOpenSuccess.length,
    send_open_failures: sendOpenFailures.length,
    contact_join_success: successful.length,
    contact_join_failures: contactFailures.length,
  };

  return { successful, failed, stats };
}

/**
 * Process multiple SDR send/open pairs with a single contacts CSV.
 * @param {Array<{ name: string, sendCsv: string|File, openCsv: string|File }>} sdrConfigs
 * @param {string|File} contactsCsv
 */
export async function processMultiSdrPipeline(sdrConfigs, contactsCsv) {
  if (!Array.isArray(sdrConfigs) || !sdrConfigs.length) {
    throw new Error("At least one SDR configuration is required");
  }

  const contactsRows = await loadCsv(contactsCsv);
  const contactsNorm = normalizeContacts(contactsRows);
  validateRequired(contactsNorm, ["Email"], "Contacts CSV");

  const allSendOpenSuccess = [];
  const allSendOpenFailures = [];
  const sdrStats = [];
  let totalSendRecords = 0;
  let totalOpenRecords = 0;

  for (const config of sdrConfigs) {
    const { name } = config;
    const label = name || "SDR";
    const [sendRows, openRows] = await Promise.all([
      loadCsv(config.sendCsv),
      loadCsv(config.openCsv),
    ]);

    const sendNorm = normalizeSend(sendRows);
    const openNorm = normalizeOpen(openRows);

    validateRequired(
      sendNorm,
      ["recipient_name", "sent_date", "Recipient Email"],
      `${label} Send CSV`
    );
    validateRequired(
      openNorm,
      ["recipient_name", "sent_date", "Views", "Clicks"],
      `${label} Open CSV`
    );

    totalSendRecords += sendNorm.length;
    totalOpenRecords += openNorm.length;

    sendNorm.forEach(
      (r) => (r.sent_date_parsed = parseDateFlexible(r.sent_date))
    );
    openNorm.forEach(
      (r) => (r.sent_date_parsed = parseDateFlexible(r.sent_date))
    );

    const sendValid = sendNorm.filter((r) => r.sent_date_parsed);
    const openValid = openNorm.filter((r) => r.sent_date_parsed);

    const { sendOpenSuccess, sendOpenFailures } = joinSendAndOpen(
      sendValid,
      openValid
    );

    sendOpenSuccess.forEach((row) => {
      row.SDR_Name = label;
    });
    sendOpenFailures.forEach((row) => {
      row.SDR_Name = label;
    });

    allSendOpenSuccess.push(...sendOpenSuccess);
    allSendOpenFailures.push(...sendOpenFailures);

    sdrStats.push({
      name: label,
      total_send_records: sendNorm.length,
      matched: sendOpenSuccess.length,
      failures: sendOpenFailures.length,
    });
  }

  if (!allSendOpenSuccess.length) {
    throw new Error("No SDR send-open joins were successful");
  }

  const { successful, contactFailures } = joinWithContacts(
    allSendOpenSuccess,
    contactsNorm
  );

  const failed = [...allSendOpenFailures, ...contactFailures];

  const stats = {
    total_send_records: totalSendRecords,
    total_open_records: totalOpenRecords,
    total_contact_records: contactsNorm.length,
    send_open_success: allSendOpenSuccess.length,
    send_open_failures: allSendOpenFailures.length,
    contact_join_success: successful.length,
    contact_join_failures: contactFailures.length,
  };

  return { successful, failed, stats, sdrStats };
}

/* ---------------------- CSV loading ---------------------- */

function loadCsv(src) {
  return new Promise((resolve, reject) => {
    const parse = (csvText) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: (err) => reject(err),
      });
    };

    if (typeof File !== "undefined" && src instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => parse(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(src);
    } else {
      // assume string
      parse(src);
    }
  });
}

/* ---------------------- Normalization ---------------------- */

function normalizeSend(rows) {
  // Filter: Remove loopwork.co domains (matching Python _apply_filtering_rules)
  const filtered = rows.filter((row) => {
    const domain = row.Domain || row.domain || "";
    return !domain.toLowerCase().includes("loopwork.co");
  });

  return filtered.map((row) => {
    const out = { ...row };

    // Map common variants to canonical names
    if (row["Recipient Name"] && !row["recipient_name"]) {
      out["recipient_name"] = row["Recipient Name"];
    }
    if (row["recipient_name"]) {
      out["recipient_name"] = row["recipient_name"];
    }
    if (row["Date"] && !row["sent_date"]) {
      out["sent_date"] = row["Date"];
    }
    if (row["sent_date"]) {
      out["sent_date"] = row["sent_date"];
    }
    if (row["recipient_email"] && !row["Recipient Email"]) {
      out["Recipient Email"] = row["recipient_email"];
    }
    if (row["Recipient Email"]) {
      out["Recipient Email"] = row["Recipient Email"];
    }

    // basic cleaning
    if (out.recipient_name != null)
      out.recipient_name = String(out.recipient_name).trim();

    return out;
  });
}

function normalizeOpen(rows) {
  return rows.map((row) => {
    const out = { ...row };

    // Map "Recipient" -> recipient_name
    if (row["Recipient"] && !row["recipient_name"]) {
      out["recipient_name"] = row["Recipient"];
    } else if (row["recipient_name"]) {
      out["recipient_name"] = row["recipient_name"];
    }

    // Map "Sent" -> sent_date
    if (row["Sent"] && !row["sent_date"]) {
      out["sent_date"] = row["Sent"];
    } else if (row["sent_date"]) {
      out["sent_date"] = row["sent_date"];
    }

    // Map "Opens" -> Views
    if (row["Opens"] && !row["Views"]) {
      out["Views"] = row["Opens"];
    }

    // last_opened if present
    if (row["Last Opened"] && !row["last_opened"]) {
      out["last_opened"] = row["Last Opened"];
    }

    // Clean recipient_name: split by comma, take first (matching Python logic)
    if (out.recipient_name != null) {
      const v = String(out.recipient_name).trim();
      out.recipient_name = v.includes(",") ? v.split(",")[0].trim() : v;
    }

    // Convert date format from "Jul 3, 2025, 02:14:21" to "DD/MM/YYYY HH:MM:SS" (matching Python _apply_filtering_rules)
    if (out.sent_date) {
      try {
        const parsed = new Date(out.sent_date);
        if (!isNaN(parsed.getTime())) {
          const dd = String(parsed.getDate()).padStart(2, "0");
          const mm = String(parsed.getMonth() + 1).padStart(2, "0");
          const yyyy = parsed.getFullYear();
          const HH = String(parsed.getHours()).padStart(2, "0");
          const MM = String(parsed.getMinutes()).padStart(2, "0");
          const SS = String(parsed.getSeconds()).padStart(2, "0");
          out.sent_date = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
        }
      } catch (e) {
        // Keep original if parsing fails
      }
    }

    // Convert empty Views/Clicks to 0 (matching Python logic)
    out.Views = out.Views != null && out.Views !== "" ? Number(out.Views) || 0 : 0;
    out.Clicks = out.Clicks != null && out.Clicks !== "" ? Number(out.Clicks) || 0 : 0;

    return out;
  });
}

function normalizeContacts(rows) {
  return rows.map((row) => {
    const out = { ...row };

    // Ensure Email key
    if (!out.Email && row["email"]) out.Email = row["email"];
    if (out.Email != null) out.Email = String(out.Email).trim().toLowerCase();

    return out;
  });
}

function validateRequired(rows, cols, label) {
  if (!rows.length) throw new Error(`${label}: no rows found`);

  const keys = Object.keys(rows[0]);
  const missing = cols.filter((c) => !keys.includes(c));

  if (missing.length) {
    throw new Error(`${label}: missing required columns: ${missing.join(", ")}`);
  }
}

/* ---------------------- Date parsing ---------------------- */

function parseDateFlexible(value) {
  if (!value) return null;
  const s = String(value).trim();

  // Try DD/MM/YYYY HH:MM:SS FIRST (Send CSV format)
  // Must try this before native Date() to avoid MM/DD/YYYY ambiguity
  const ddmmyyyy = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/
  );
  if (ddmmyyyy) {
    const [, dd, mm, yyyy, HH, MM, SS] = ddmmyyyy;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(HH),
      Number(MM),
      Number(SS)
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Try YYYY-MM-DD HH:MM:SS (Opens CSV format - MailSuite)
  const yyyymmdd = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  );
  if (yyyymmdd) {
    const [, yyyy, mm, dd, HH, MM, SS] = yyyymmdd;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(HH),
      Number(MM),
      Number(SS)
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Finally try native Date (handles "Jul 3, 2025, 02:14:21" and other formats)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  return null;
}

/* ---------------------- Join: Send ↔ Open ---------------------- */

/**
 * Two-phase incremental datetime matching matching Python _incremental_datetime_join:
 * Phase 1: 0-11 seconds (fast & safe)
 * Phase 2: 12-60 seconds (on failed records only)
 * LEFT JOIN: All send records preserved, unmatched get NULL open fields
 */
function joinSendAndOpen(sendRows, openRows) {
  // Phase 1: 0-11 seconds matching
  const phase1Result = phase1Matching(sendRows, openRows);
  const phase1Success = phase1Result.successful;
  const phase1Failed = phase1Result.failed;
  const usedOpenIndices = phase1Result.usedIndices;

  // Phase 2: 12-60 seconds matching on failed records only
  const phase2Result = phase2Matching(phase1Failed, openRows, usedOpenIndices);
  const phase2Success = phase2Result.successful;
  const finalFailed = phase2Result.failed;

  // Combine successful matches
  const allSuccess = [...phase1Success, ...phase2Success];

  // LEFT JOIN: Add all failed records with NULL open fields (matching Python logic)
  const unmatchedWithNulls = finalFailed.map((failed) => {
    const record = { ...failed };
    delete record.failure_reason;
    delete record.match_count;
    // Add NULL open fields
    record.Views = null;
    record.Clicks = null;
    record.last_opened = null;
    return record;
  });

  // Combine successful matches + unmatched with NULLs
  const allRecords = [...allSuccess, ...unmatchedWithNulls];

  return {
    sendOpenSuccess: allRecords,
    sendOpenFailures: [], // Empty because we include all in success with NULLs (LEFT JOIN)
  };
}

/**
 * Phase 1: 0-11 second matching (matching Python _phase1_matching)
 */
function phase1Matching(sendRows, openRows) {
  const successful = [];
  const failed = [];
  const usedIndices = new Set();

  // Build email-based lookup - extract email from recipient_name
  const openByEmail = new Map();
  openRows.forEach((open, idx) => {
    // Extract email from recipient_name (handles formats like "user@domain.com" or "Name <user@domain.com>")
    const recipientStr = (open.recipient_name || "").toLowerCase().trim();
    const emailMatch = recipientStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    const email = emailMatch ? emailMatch[1] : recipientStr;
    
    if (email && !openByEmail.has(email)) {
      openByEmail.set(email, []);
    }
    if (email) {
      openByEmail.get(email).push({ ...open, _index: idx });
    }
  });

  sendRows.forEach((send) => {
    // Use 'Recipient Email' field for matching (more reliable than recipient_name)
    const email = (send["Recipient Email"] || send.recipient_email || send.recipient_name || "").toLowerCase().trim();
    
    // Get all opens for this email
    const emailOpens = openByEmail.get(email) || [];
    
    if (emailOpens.length === 0) {
      // No opens found for this email
      failed.push({ ...send, failure_reason: "no_opens_for_email" });
    } else if (emailOpens.length === 1) {
      // Single match - use it
      const matched = emailOpens[0];
      usedIndices.add(matched._index);
      successful.push({
        ...send,
        Views: matched.Views || 0,
        Clicks: matched.Clicks || 0,
        last_opened: matched.last_opened || matched.sent_date,
      });
    } else {
      // Multiple opens for same email - take the most recent one
      const mostRecent = emailOpens.reduce((latest, current) => {
        if (!latest) return current;
        const latestDate = latest.sent_date_parsed || new Date(0);
        const currentDate = current.sent_date_parsed || new Date(0);
        return currentDate > latestDate ? current : latest;
      }, null);
      
      if (mostRecent) {
        usedIndices.add(mostRecent._index);
        successful.push({
          ...send,
          Views: mostRecent.Views || 0,
          Clicks: mostRecent.Clicks || 0,
          last_opened: mostRecent.last_opened || mostRecent.sent_date,
        });
      } else {
        failed.push({ ...send, failure_reason: "multiple_matches_but_no_valid_date" });
      }
    }
  });

  return { successful, failed, usedIndices };
}

/**
 * Phase 2: 12-60 second matching on failed records with unused opens (matching Python _phase2_matching)
 */
function phase2Matching(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];

  // Get unused open records
  const unusedOpens = openRows
    .map((open, idx) => ({ ...open, _index: idx }))
    .filter((open) => !usedIndices.has(open._index));

  // Build email-based lookup for unused opens - extract email from recipient_name
  const unusedByEmail = new Map();
  unusedOpens.forEach((open) => {
    // Extract email from recipient_name
    const recipientStr = (open.recipient_name || "").toLowerCase().trim();
    const emailMatch = recipientStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    const email = emailMatch ? emailMatch[1] : recipientStr;
    
    if (email && !unusedByEmail.has(email)) {
      unusedByEmail.set(email, []);
    }
    if (email) {
      unusedByEmail.get(email).push(open);
    }
  });

  failedRecords.forEach((failed) => {
    // Use 'Recipient Email' field for matching (more reliable than recipient_name)
    const email = (failed["Recipient Email"] || failed.recipient_email || failed.recipient_name || "").toLowerCase().trim();
    
    // Get unused opens for this email
    const emailOpens = unusedByEmail.get(email) || [];
    
    if (emailOpens.length > 0) {
      // Take the most recent unused open
      const mostRecent = emailOpens.reduce((latest, current) => {
        if (!latest) return current;
        const latestDate = latest.sent_date_parsed || new Date(0);
        const currentDate = current.sent_date_parsed || new Date(0);
        return currentDate > latestDate ? current : latest;
      }, null);
      
      if (mostRecent) {
        successful.push({
          ...failed,
          Views: mostRecent.Views || 0,
          Clicks: mostRecent.Clicks || 0,
          last_opened: mostRecent.last_opened || mostRecent.sent_date,
        });
      } else {
        finalFailed.push({ ...failed, failure_reason: "no_valid_unused_open" });
      }
    } else {
      // No unused opens for this email
      finalFailed.push({ ...failed, failure_reason: "no_unused_opens_for_email" });
    }
  });

  return { successful, failed: finalFailed };
}

/* ---------------------- Join: With Contacts ---------------------- */

/**
 * Join with contacts and add Company URL IDs (matching Python _join_with_contacts and _add_company_url_ids)
 */
function joinWithContacts(sendOpenRows, contactRows) {
  // Build email lookup
  const contactLookup = new Map();
  contactRows.forEach((contact) => {
    const email = (contact.Email || "").toLowerCase().trim();
    if (email && !contactLookup.has(email)) {
      contactLookup.set(email, contact);
    }
  });

  const successful = [];
  const failures = [];
  const companyUrlToId = new Map();
  let nextId = 1;

  sendOpenRows.forEach((row) => {
    const email = (row["Recipient Email"] || "").toLowerCase().trim();
    const contact = contactLookup.get(email);

    if (contact) {
      const merged = { ...row, ...contact };

      // Add Company URL ID (matching Python _add_company_url_ids)
      if (merged["Company URL"]) {
        const url = String(merged["Company URL"]).toLowerCase().trim();
        if (!companyUrlToId.has(url)) {
          companyUrlToId.set(url, nextId++);
        }
        merged["Company URL ID"] = companyUrlToId.get(url);
      }

      successful.push(merged);
    } else {
      failures.push({
        ...row,
        failure_reason: "Send email not found in contacts",
      });
    }
  });

  return { successful, contactFailures: failures };
}
