import Papa from "papaparse";

/**
 * Public API: process three CSV strings (or File objects) and return combined result.
 * Matches Python DataProcessor.process_files logic exactly.
 *
 * @param {string|File} sendCsv
 * @param {string|File} openCsv
 * @param {string|File} contactsCsv
 * @param {Object} options - Optional configuration
 * @param {string} options.matchingMode - 'email_only' (default), 'timestamp', or 'hybrid'
 * @returns {Promise<{
 *   successful: Array<Object>,
 *   failed: Array<{ failure_reason: string } & Object>,
 *   stats: Object
 * }>}
 */
export async function processEmailPipeline(sendCsv, openCsv, contactsCsv, options = {}) {
  const matchingMode = options.matchingMode || 'email_only';
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

  // 4) JOIN: Send ↔ Open (matching mode configurable)
  const joinResult = joinSendAndOpen(
    sendValid,
    openValid,
    matchingMode
  );
  const { sendOpenSuccess, sendOpenFailures } = joinResult;
  const strategyMatches = joinResult.strategyMatches || null;

  // 5) JOIN: SendOpen ↔ Contacts (by Recipient Email)
  const { successful, contactFailures } = joinWithContacts(
    sendOpenSuccess,
    contactsNorm
  );

  const failed = [...sendOpenFailures, ...contactFailures];

  // Calculate matching rates
  const sendOpenMatchRate = sendNorm.length > 0 
    ? ((sendOpenSuccess.length / sendNorm.length) * 100).toFixed(1)
    : 0;
  
  // Count Opens with actual tracking data (Views != NULL)
  const opensWithData = sendOpenSuccess.filter(r => {
    const views = r.Views;
    return views != null && views !== ''; // Using != to check both null and undefined
  }).length;
  
  const opensMatchRate = sendNorm.length > 0
    ? ((opensWithData / sendNorm.length) * 100).toFixed(1)
    : 0;

  const stats = {
    total_send_records: sendNorm.length,
    total_open_records: openNorm.length,
    total_contact_records: contactsNorm.length,
    send_open_success: sendOpenSuccess.length,
    send_open_failures: sendOpenFailures.length,
    send_open_match_rate: parseFloat(sendOpenMatchRate),
    opens_with_tracking_data: opensWithData,
    opens_data_match_rate: parseFloat(opensMatchRate),
    contact_join_success: successful.length,
    contact_join_failures: contactFailures.length,
    contact_match_rate: sendOpenSuccess.length > 0
      ? ((successful.length / sendOpenSuccess.length) * 100).toFixed(1)
      : 0,
    strategy_matches: strategyMatches, // Add strategy breakdown for composite mode
  };

  return { successful, failed, stats, matchingMode };
}

/**
 * Process multiple SDR send/open pairs with a single contacts CSV.
 * @param {Array<{ name: string, sendCsv: string|File, openCsv: string|File }>} sdrConfigs
 * @param {string|File} contactsCsv
 * @param {Object} options - Optional configuration
 * @param {string} options.matchingMode - 'email_only' (default), 'timestamp', or 'hybrid'
 */
export async function processMultiSdrPipeline(sdrConfigs, contactsCsv, options = {}) {
  const matchingMode = options.matchingMode || 'email_only';
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
  const aggregatedStrategyMatches = {
    email: 0,
    name_subject: 0,
    subject_only: 0,
    name_only: 0,
    fuzzy_subject: 0,
    domain_name: 0,
    date_range: 0,
    thread_id: 0,
    fuzzy_name: 0,
    date_proximity: 0,
  };

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

    const joinResult = joinSendAndOpen(
      sendValid,
      openValid,
      matchingMode
    );
    const { sendOpenSuccess, sendOpenFailures } = joinResult;
    
    // Aggregate strategy matches if available
    if (joinResult.strategyMatches) {
      Object.keys(aggregatedStrategyMatches).forEach(key => {
        aggregatedStrategyMatches[key] += (joinResult.strategyMatches[key] || 0);
      });
    }

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

  // Calculate matching rates
  const sendOpenMatchRate = totalSendRecords > 0 
    ? ((allSendOpenSuccess.length / totalSendRecords) * 100).toFixed(1)
    : 0;
  
  // Count Opens with actual tracking data (Views != NULL)
  const opensWithData = allSendOpenSuccess.filter(r => {
    const views = r.Views;
    return views != null && views !== ''; // Using != to check both null and undefined
  }).length;
  
  const opensMatchRate = totalSendRecords > 0
    ? ((opensWithData / totalSendRecords) * 100).toFixed(1)
    : 0;

  const stats = {
    total_send_records: totalSendRecords,
    total_open_records: totalOpenRecords,
    total_contact_records: contactsNorm.length,
    send_open_success: allSendOpenSuccess.length,
    send_open_failures: allSendOpenFailures.length,
    send_open_match_rate: parseFloat(sendOpenMatchRate),
    opens_with_tracking_data: opensWithData,
    opens_data_match_rate: parseFloat(opensMatchRate),
    contact_join_success: successful.length,
    contact_join_failures: contactFailures.length,
    contact_match_rate: allSendOpenSuccess.length > 0
      ? ((successful.length / allSendOpenSuccess.length) * 100).toFixed(1)
      : 0,
    strategy_matches: matchingMode === 'composite' ? aggregatedStrategyMatches : null,
  };

  return { successful, failed, stats, sdrStats, matchingMode };
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
  // Filter: Remove sends that were sent TO loopwork.co recipients (keep others)
  // We only drop when the recipient email domain is loopwork.co (or Domain suggests that).
  const filtered = rows.filter((row) => {
    const email = (row["Recipient Email"] || row.recipient_email || "").toString().toLowerCase();
    const domainFromEmail = email.includes("@") ? email.split("@")[1] : "";
    const domainField = (row.Domain || row.domain || "").toString().toLowerCase();

    const isLoopworkRecipient =
      (domainFromEmail && domainFromEmail.includes("loopwork.co")) ||
      (!domainFromEmail && domainField.includes("loopwork.co"));

    return !isLoopworkRecipient;
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

    // Normalized recipient name for name-based matching
    // Extract name part (before comma, and before < if email is included)
    let namePart = (out.recipient_name || "").split(",")[0].trim();
    // Remove email part if present (e.g., "Name <email@domain.com>" -> "Name")
    if (namePart.includes("<")) {
      namePart = namePart.split("<")[0].trim();
    }
    out.recipient_name_norm = namePart.toLowerCase();

    return out;
  });
}

function normalizeOpen(rows) {
  return rows.map((row) => {
    const out = { ...row };

    // PRESERVE original Recipient field for email extraction during matching
    if (row["Recipient"]) {
      out["_original_recipient"] = row["Recipient"];
    }

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

    // Normalized recipient name for name-based matching
    // Extract name part (before comma, and before < if email is included)
    let namePart = (out.recipient_name || "").split(",")[0].trim();
    // Remove email part if present (e.g., "Name <email@domain.com>" -> "Name")
    if (namePart.includes("<")) {
      namePart = namePart.split("<")[0].trim();
    }
    out.recipient_name_norm = namePart.toLowerCase();

    // Convert date format from "Jul 3, 2025, 02:14:21" or "2025-11-25 14:19:51" to "DD/MM/YYYY HH:MM:SS" (matching Python _apply_filtering_rules)
    // IMPORTANT: Use parseDateFlexible to ensure correct parsing of YYYY-MM-DD format before conversion
    if (out.sent_date) {
      try {
        // First try to parse using parseDateFlexible (handles YYYY-MM-DD format correctly)
        const parsed = parseDateFlexible(out.sent_date);
        if (parsed && !isNaN(parsed.getTime())) {
          // Convert to DD/MM/YYYY HH:MM:SS format
          const dd = String(parsed.getDate()).padStart(2, "0");
          const mm = String(parsed.getMonth() + 1).padStart(2, "0");
          const yyyy = parsed.getFullYear();
          const HH = String(parsed.getHours()).padStart(2, "0");
          const MM = String(parsed.getMinutes()).padStart(2, "0");
          const SS = String(parsed.getSeconds()).padStart(2, "0");
          out.sent_date = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
        } else {
          // Fallback to native Date parsing if parseDateFlexible fails
          const parsedNative = new Date(out.sent_date);
          if (!isNaN(parsedNative.getTime())) {
            const dd = String(parsedNative.getDate()).padStart(2, "0");
            const mm = String(parsedNative.getMonth() + 1).padStart(2, "0");
            const yyyy = parsedNative.getFullYear();
            const HH = String(parsedNative.getHours()).padStart(2, "0");
            const MM = String(parsedNative.getMinutes()).padStart(2, "0");
            const SS = String(parsedNative.getSeconds()).padStart(2, "0");
          out.sent_date = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
          }
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
 * Send-Open join with configurable matching strategy
 * @param {Array} sendRows - Send records
 * @param {Array} openRows - Opens records
 * @param {string} matchingMode - 'email_only' (default), 'timestamp', 'hybrid', 'relaxed', 'name_timestamp', or 'composite'
 * 
 * Matching Modes:
 * - email_only: Match by email address only (fastest, highest match rate)
 * - timestamp: Two-phase incremental datetime (0-60s, most precise but lower match rate)
 * - hybrid: Try timestamp first, fall back to email-only for failures (best of both)
 * - relaxed: timestamp 0-60s, then closest within +/-5 minutes (prefer after), then email fallback
 * - name_timestamp: timestamp 0-60s using normalized recipient_name (for name-only Opens)
 * - composite: Multi-strategy cascade (email → name+subject → subject → name) for maximum coverage ~85%
 * 
 * LEFT JOIN: All send records preserved, unmatched get NULL open fields
 */
function joinSendAndOpen(sendRows, openRows, matchingMode = 'email_only') {
  let phase1Success, phase1Failed, usedOpenIndices, phase2Success, finalFailed;

  if (matchingMode === 'timestamp') {
    // Original: Two-phase incremental datetime matching (0-11s, then 12-60s)
    const phase1Result = phase1MatchingTimestamp(sendRows, openRows);
    phase1Success = phase1Result.successful;
    phase1Failed = phase1Result.failed;
    usedOpenIndices = phase1Result.usedIndices;

    const phase2Result = phase2MatchingTimestamp(phase1Failed, openRows, usedOpenIndices);
    phase2Success = phase2Result.successful;
    finalFailed = phase2Result.failed;
  } else if (matchingMode === 'hybrid') {
    // Hybrid: Try timestamp first, then email-only for failures
    const phase1Result = phase1MatchingTimestamp(sendRows, openRows);
    phase1Success = phase1Result.successful;
    phase1Failed = phase1Result.failed;
    usedOpenIndices = phase1Result.usedIndices;

    const phase2Result = phase2MatchingTimestamp(phase1Failed, openRows, usedOpenIndices);
    phase2Success = phase2Result.successful;
    
    // Phase 3: Email-only for remaining failures
    const phase3Result = phase1Matching(phase2Result.failed, openRows);
    const phase3Success = phase3Result.successful;
    finalFailed = phase3Result.failed;
    
    phase2Success = [...phase2Success, ...phase3Success];
  } else if (matchingMode === 'relaxed') {
    // Relaxed: timestamp 0-60s, then closest within +/-5m, then email-only
    const ts1 = phase1MatchingTimestamp(sendRows, openRows);
    phase1Success = ts1.successful;
    phase1Failed = ts1.failed;
    usedOpenIndices = ts1.usedIndices;

    const ts2 = phase2MatchingTimestamp(phase1Failed, openRows, usedOpenIndices);
    phase2Success = ts2.successful;
    finalFailed = ts2.failed;
    // Update used indices
    ts2.successful.forEach((r) => {
      if (r._matched_index != null) usedOpenIndices.add(r._matched_index);
    });

    // Phase3: closest within +/-5 minutes on remaining failed, using unused opens
    const phase3 = closestWithinWindowMatching(finalFailed, openRows, usedOpenIndices, 300);
    const phase3Success = phase3.successful;
    finalFailed = phase3.failed;
    phase3Success.forEach((r) => {
      if (r._matched_index != null) usedOpenIndices.add(r._matched_index);
    });

    // Phase4: email-only fallback on remaining failed (unused opens only)
    const phase4 = emailFallbackUnusedOpens(finalFailed, openRows, usedOpenIndices);
    const phase4Success = phase4.successful;
    finalFailed = phase4.failed;

    phase2Success = [...phase2Success, ...phase3Success, ...phase4Success];
  } else if (matchingMode === 'name_timestamp') {
    // Timestamp by normalized recipient_name (for name-only opens)
    const nameTs1 = phase1MatchingTimestampByName(sendRows, openRows);
    phase1Success = nameTs1.successful;
    phase1Failed = nameTs1.failed;
    usedOpenIndices = nameTs1.usedIndices;

    const nameTs2 = phase2MatchingTimestampByName(phase1Failed, openRows, usedOpenIndices);
    phase2Success = nameTs2.successful;
    finalFailed = nameTs2.failed;
  } else if (matchingMode === 'composite') {
    // Multi-strategy cascade for maximum coverage (~85%)
    // Track matches per strategy for reporting
    const strategyMatches = {};
    
    // Strategy 1: Email match (highest confidence)
    const emailResult = phase1Matching(sendRows, openRows);
    phase1Success = emailResult.successful;
    usedOpenIndices = emailResult.usedIndices;
    strategyMatches['email'] = phase1Success.length;
    
    // Strategy 2: Name + Subject match (medium confidence)
    const nameSubjectResult = matchByNameAndSubject(emailResult.failed, openRows, usedOpenIndices);
    const nameSubjectSuccess = nameSubjectResult.successful;
    nameSubjectSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['name_subject'] = nameSubjectSuccess.length;
    
    // Strategy 3: Subject-only match (lower confidence)
    const subjectResult = matchBySubjectOnly(nameSubjectResult.failed, openRows, usedOpenIndices);
    const subjectSuccess = subjectResult.successful;
    subjectSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['subject_only'] = subjectSuccess.length;
    
    // Strategy 4: Name-only match (lowest confidence, optional)
    const nameResult = matchByNameOnly(subjectResult.failed, openRows, usedOpenIndices);
    const nameSuccess = nameResult.successful;
    nameSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['name_only'] = nameSuccess.length;
    
    // Strategy 5: Fuzzy subject matching (handle "Re:", "Fwd:", case variations)
    const fuzzySubjectResult = matchByFuzzySubject(nameResult.failed, openRows, usedOpenIndices);
    const fuzzySubjectSuccess = fuzzySubjectResult.successful;
    fuzzySubjectSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['fuzzy_subject'] = fuzzySubjectSuccess.length;
    
    // Strategy 6: Email domain + name matching (for cases where email domain matches but full email doesn't)
    const domainNameResult = matchByDomainAndName(fuzzySubjectResult.failed, openRows, usedOpenIndices);
    const domainNameSuccess = domainNameResult.successful;
    domainNameSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['domain_name'] = domainNameSuccess.length;
    
    // Strategy 7: Date range matching (match by date only, ignoring time, for same name/subject)
    const dateRangeResult = matchByDateRange(domainNameResult.failed, openRows, usedOpenIndices);
    const dateRangeSuccess = dateRangeResult.successful;
    dateRangeSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['date_range'] = dateRangeSuccess.length;
    
    // Strategy 8: Thread ID matching (if both have Thread ID, that's a strong signal)
    const threadIdResult = matchByThreadId(dateRangeResult.failed, openRows, usedOpenIndices);
    const threadIdSuccess = threadIdResult.successful;
    threadIdSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['thread_id'] = threadIdSuccess.length;
    
    // Strategy 9: Fuzzy name matching (handle name variations like "John Smith" vs "John A. Smith")
    const fuzzyNameResult = matchByFuzzyName(threadIdResult.failed, openRows, usedOpenIndices);
    const fuzzyNameSuccess = fuzzyNameResult.successful;
    fuzzyNameSuccess.forEach(r => { if (r._matched_index != null) usedOpenIndices.add(r._matched_index); });
    strategyMatches['fuzzy_name'] = fuzzyNameSuccess.length;
    
    // Strategy 10: Last resort - match by date proximity only (no name/subject requirement)
    const lastResortResult = matchByDateProximity(fuzzyNameResult.failed, openRows, usedOpenIndices);
    const lastResortSuccess = lastResortResult.successful;
    finalFailed = lastResortResult.failed;
    strategyMatches['date_proximity'] = lastResortSuccess.length;
    
    // Combine all successful matches
    phase2Success = [...nameSubjectSuccess, ...subjectSuccess, ...nameSuccess, ...fuzzySubjectSuccess, ...domainNameSuccess, ...dateRangeSuccess, ...threadIdSuccess, ...fuzzyNameSuccess, ...lastResortSuccess];
    
    // Store strategy matches in finalFailed for retrieval
    finalFailed._strategyMatches = strategyMatches;
  } else {
    // Default: Email-only matching (current optimized approach)
    const phase1Result = phase1Matching(sendRows, openRows);
    phase1Success = phase1Result.successful;
    phase1Failed = phase1Result.failed;
    usedOpenIndices = phase1Result.usedIndices;

    const phase2Result = phase2Matching(phase1Failed, openRows, usedOpenIndices);
    phase2Success = phase2Result.successful;
    finalFailed = phase2Result.failed;
  }

  // Combine successful matches
  const allSuccess = [...phase1Success, ...phase2Success];

  // LEFT JOIN: Add all failed records with NULL open fields
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

  // Get strategy matches from composite mode if available
  let strategyMatches = null;
  if (matchingMode === 'composite' && finalFailed && finalFailed._strategyMatches) {
    strategyMatches = finalFailed._strategyMatches;
    // Clean up - remove the temporary property
    delete finalFailed._strategyMatches;
  }

  return {
    sendOpenSuccess: allRecords,
    sendOpenFailures: [], // Empty because we include all in success with NULLs (LEFT JOIN)
    matchingMode, // Return which mode was used
    strategyMatches, // Strategy breakdown for composite mode
  };
}

/**
 * Phase 1: 0-11 second matching (matching Python _phase1_matching)
 */
function phase1Matching(sendRows, openRows) {
  const successful = [];
  const failed = [];
  const usedIndices = new Set();

  // Build email-based lookup - extract ALL emails from FULL Recipient string (before comma-split)
  const openByEmail = new Map();
  openRows.forEach((open, idx) => {
    // Use PRESERVED original Recipient field (before comma-split) to extract ALL emails
    // This handles cases like "Name1,Name2,email@domain.com" where email is in 2nd/3rd position
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    
    // Extract ALL emails from the full string
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map(m => m[1].toLowerCase());
    
    // Add this Opens record to all extracted emails
    for (const email of emails) {
      if (!openByEmail.has(email)) {
        openByEmail.set(email, []);
      }
      openByEmail.get(email).push({ ...open, _index: idx });
    }
  });

  // Also build name-based lookup as fallback (for Opens CSV with name-only Recipient field)
  const openByName = new Map();
  openRows.forEach((open, idx) => {
    const name = (open.recipient_name_norm || "").toLowerCase().trim();
    if (name) {
      if (!openByName.has(name)) {
        openByName.set(name, []);
      }
      openByName.get(name).push({ ...open, _index: idx });
    }
  });

  // Sort sends by date to process chronologically (helps with matching multiple sends to multiple opens)
  const sortedSends = [...sendRows].sort((a, b) => {
    const dateA = a.sent_date_parsed || new Date(0);
    const dateB = b.sent_date_parsed || new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  sortedSends.forEach((send) => {
    // Use 'Recipient Email' field for matching (more reliable than recipient_name)
    const email = (send["Recipient Email"] || send.recipient_email || send.recipient_name || "").toLowerCase().trim();
    
    // Get all opens for this email
    let emailOpens = openByEmail.get(email) || [];
    
    // If no email matches, try name-based matching as fallback
    if (emailOpens.length === 0) {
      const sendName = (send.recipient_name_norm || "").toLowerCase().trim();
      if (sendName) {
        emailOpens = openByName.get(sendName) || [];
      }
    }
    
    if (emailOpens.length === 0) {
      // No opens found for this email or name
      failed.push({ ...send, failure_reason: "no_opens_for_email_or_name" });
    } else if (emailOpens.length === 1) {
      // Single match - validate timestamp to ensure it's correct
      const matched = emailOpens[0];
      const sendDate = send.sent_date_parsed;
      const openDate = matched.sent_date_parsed;
      
      // Check if timestamps are within reasonable range (10 minutes for better coverage)
      // This ensures Send CSV sent_date matches Opens CSV "Sent" field
      // For email matching, we're more lenient since email is the primary identifier
      let timestampValid = true;
      if (sendDate && openDate) {
        const timeDiff = Math.abs(openDate.getTime() - sendDate.getTime());
        timestampValid = timeDiff <= 600000; // 10 minutes in milliseconds (increased for better coverage)
      }
      
      // Use the match even if timestamp is slightly off (for email matching, email is primary)
      // Email matching has highest confidence, so we accept matches even with wider time windows
      usedIndices.add(matched._index);
      successful.push({
        ...send,
        Views: matched.Views || 0,
        Clicks: matched.Clicks || 0,
        last_opened: matched.last_opened || matched.sent_date,
        _timestamp_valid: timestampValid, // Flag for debugging
      });
    } else {
      // Multiple opens for same email - match by closest timestamp
      // The Opens CSV "Sent" field indicates which send record it corresponds to
      const sendDate = send.sent_date_parsed;
      if (!sendDate) {
        failed.push({ ...send, failure_reason: "invalid_send_date" });
        return;
      }
      
      // Find the open record with the closest timestamp to this send record
      // Filter to only unused opens
      const unusedOpens = emailOpens.filter(open => !usedIndices.has(open._index));
      
      if (unusedOpens.length === 0) {
        // All opens for this email are already used - try to find closest match anyway
        // This handles cases where we need to match multiple sends to multiple opens
        const closest = emailOpens.reduce((best, current) => {
          if (!current.sent_date_parsed) return best;
          if (!best) return current;
          
          const sendTime = sendDate.getTime();
          const bestTime = best.sent_date_parsed.getTime();
          const currentTime = current.sent_date_parsed.getTime();
          
          const bestDiff = Math.abs(bestTime - sendTime);
          const currentDiff = Math.abs(currentTime - sendTime);
          
          return currentDiff < bestDiff ? current : best;
      }, null);
      
        if (closest) {
          usedIndices.add(closest._index);
        successful.push({
          ...send,
            Views: closest.Views || 0,
            Clicks: closest.Clicks || 0,
            last_opened: closest.last_opened || closest.sent_date,
        });
      } else {
        failed.push({ ...send, failure_reason: "multiple_matches_but_no_valid_date" });
        }
      } else {
        // Sort unused opens by their sent_date to help with chronological matching
        // This ensures Send 1 (earlier) matches with Open 1 (earlier), Send 2 (later) with Open 2 (later)
        const sortedUnusedOpens = unusedOpens
          .filter(open => open.sent_date_parsed)
          .sort((a, b) => a.sent_date_parsed.getTime() - b.sent_date_parsed.getTime());
        
        // Find closest unused open by timestamp
        // This ensures correct pairing: Send 1 -> Open 1, Send 2 -> Open 2 (by closest timestamp)
        const closest = sortedUnusedOpens.reduce((best, current) => {
          if (!current.sent_date_parsed) return best;
          if (!best) return current;
          
          const sendTime = sendDate.getTime();
          const bestTime = best.sent_date_parsed.getTime();
          const currentTime = current.sent_date_parsed.getTime();
          
          const bestDiff = Math.abs(bestTime - sendTime);
          const currentDiff = Math.abs(currentTime - sendTime);
          
          // Prefer the closest timestamp match
          return currentDiff < bestDiff ? current : best;
        }, null);
        
        if (closest) {
          usedIndices.add(closest._index);
          successful.push({
            ...send,
            Views: closest.Views || 0,
            Clicks: closest.Clicks || 0,
            last_opened: closest.last_opened || closest.sent_date,
          });
        } else {
          failed.push({ ...send, failure_reason: "multiple_matches_but_no_valid_date" });
        }
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

  // Build email-based lookup for unused opens - extract ALL emails from FULL Recipient string
  const unusedByEmail = new Map();
  unusedOpens.forEach((open) => {
    // Use PRESERVED original Recipient field to extract ALL emails
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    
    // Extract ALL emails from the full string
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map(m => m[1].toLowerCase());
    
    // Add this Opens record to all extracted emails
    for (const email of emails) {
      if (!unusedByEmail.has(email)) {
        unusedByEmail.set(email, []);
      }
      unusedByEmail.get(email).push(open);
    }
  });

  // Also build name-based lookup as fallback (for Opens CSV with name-only Recipient field)
  const unusedByName = new Map();
  unusedOpens.forEach((open) => {
    const name = (open.recipient_name_norm || "").toLowerCase().trim();
    if (name) {
      if (!unusedByName.has(name)) {
        unusedByName.set(name, []);
      }
      unusedByName.get(name).push(open);
    }
  });

  failedRecords.forEach((failed) => {
    // Use 'Recipient Email' field for matching (more reliable than recipient_name)
    const email = (failed["Recipient Email"] || failed.recipient_email || failed.recipient_name || "").toLowerCase().trim();
    
    // Get unused opens for this email
    let emailOpens = unusedByEmail.get(email) || [];
    
    // If no email matches, try name-based matching as fallback
    if (emailOpens.length === 0) {
      const sendName = (failed.recipient_name_norm || "").toLowerCase().trim();
      if (sendName) {
        emailOpens = unusedByName.get(sendName) || [];
      }
    }
    
    if (emailOpens.length > 0) {
      // Match by closest timestamp to this send record
      const sendDate = failed.sent_date_parsed;
      if (!sendDate) {
        finalFailed.push({ ...failed, failure_reason: "invalid_send_date" });
        return;
      }
      
      // Find the open record with the closest timestamp to this send record
      const closest = emailOpens.reduce((best, current) => {
        if (!current.sent_date_parsed) return best;
        if (!best) return current;
        
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed.getTime();
        const currentTime = current.sent_date_parsed.getTime();
        
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (closest) {
        successful.push({
          ...failed,
          Views: closest.Views || 0,
          Clicks: closest.Clicks || 0,
          last_opened: closest.last_opened || closest.sent_date,
        });
      } else {
        finalFailed.push({ ...failed, failure_reason: "no_valid_unused_open" });
      }
    } else {
      // No unused opens for this email or name
      finalFailed.push({ ...failed, failure_reason: "no_unused_opens_for_email_or_name" });
    }
  });

  return { successful, failed: finalFailed };
}

/* ---------------------- Timestamp-Based Matching (Original Algorithm) ---------------------- */

/**
 * Phase 1: Timestamp matching 0-11 seconds (Original Algorithm)
 * Matches by email AND timestamp with incremental time offsets
 */
function phase1MatchingTimestamp(sendRows, openRows) {
  const successful = [];
  const failed = [];
  const usedIndices = new Set();

  // Build email-based lookup
  const openByEmail = new Map();
  openRows.forEach((open, idx) => {
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map(m => m[1].toLowerCase());
    
    for (const email of emails) {
      if (!openByEmail.has(email)) {
        openByEmail.set(email, []);
      }
      openByEmail.get(email).push({ ...open, _index: idx });
    }
  });

  sendRows.forEach((send) => {
    const email = (send["Recipient Email"] || send.recipient_email || send.recipient_name || "").toLowerCase().trim();
    const baseDateTime = send.sent_date_parsed;

    if (!baseDateTime) {
      failed.push({ ...send, failure_reason: "invalid_send_date" });
      return;
    }

    const emailOpens = openByEmail.get(email) || [];
    
    if (emailOpens.length === 0) {
      failed.push({ ...send, failure_reason: "no_open_records_for_email" });
      return;
    }

    let matchFound = false;

    // Try incremental matching: 0, +1, +2, ..., +11 seconds
    for (let increment = 0; increment <= 11; increment++) {
      const searchTime = new Date(baseDateTime.getTime() + increment * 1000);
      
      const matches = emailOpens.filter((open) => {
        if (!open.sent_date_parsed) return false;
        return Math.abs(open.sent_date_parsed.getTime() - searchTime.getTime()) < 1000; // Within 1 second
      });

      if (matches.length === 1) {
        const matched = matches[0];
        usedIndices.add(matched._index);
        successful.push({
          ...send,
          Views: matched.Views || 0,
          Clicks: matched.Clicks || 0,
          last_opened: matched.last_opened || matched.sent_date,
          _matched_index: matched._index,
        });
        matchFound = true;
        break;
      } else if (matches.length > 1) {
        failed.push({
          ...send,
          failure_reason: `multiple_matches_at_plus_${increment}_seconds`,
          match_count: matches.length,
        });
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      failed.push({ ...send, failure_reason: "no_match_within_11_seconds" });
    }
  });

  return { successful, failed, usedIndices };
}

/**
 * Phase 2: Timestamp matching 12-60 seconds (Original Algorithm)
 * Matches failed records from Phase 1 with unused Opens records
 */
function phase2MatchingTimestamp(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];

  const unusedOpens = openRows
    .map((open, idx) => ({ ...open, _index: idx }))
    .filter((open) => !usedIndices.has(open._index));

  const unusedByEmail = new Map();
  unusedOpens.forEach((open) => {
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map(m => m[1].toLowerCase());
    
    for (const email of emails) {
      if (!unusedByEmail.has(email)) {
        unusedByEmail.set(email, []);
      }
      unusedByEmail.get(email).push(open);
    }
  });

  failedRecords.forEach((failed) => {
    const email = (failed["Recipient Email"] || failed.recipient_email || failed.recipient_name || "").toLowerCase().trim();
    const baseDateTime = failed.sent_date_parsed;

    if (!baseDateTime) {
      finalFailed.push({ ...failed, failure_reason: "invalid_send_date" });
      return;
    }

    const emailOpens = unusedByEmail.get(email) || [];
    
    if (emailOpens.length === 0) {
      finalFailed.push({ ...failed, failure_reason: "no_unused_opens_for_email" });
      return;
    }

    let matchFound = false;

    // Try incremental matching: +12, +13, ..., +60 seconds
    for (let increment = 12; increment <= 60; increment++) {
      const searchTime = new Date(baseDateTime.getTime() + increment * 1000);
      
      const matches = emailOpens.filter((open) => {
        if (!open.sent_date_parsed) return false;
        return Math.abs(open.sent_date_parsed.getTime() - searchTime.getTime()) < 1000;
      });

      if (matches.length === 1) {
        const matched = matches[0];
        successful.push({
          ...failed,
          Views: matched.Views || 0,
          Clicks: matched.Clicks || 0,
          last_opened: matched.last_opened || matched.sent_date,
          _matched_index: matched._index,
          failure_reason: undefined,
          match_count: undefined,
        });
        matchFound = true;
        break;
      } else if (matches.length > 1) {
        finalFailed.push({
          ...failed,
          failure_reason: `multiple_matches_at_plus_${increment}_seconds_phase2`,
          match_count: matches.length,
        });
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      finalFailed.push({ ...failed, failure_reason: "no_match_within_60_seconds" });
    }
  });

  return { successful, failed: finalFailed };
}

/* ---------------------- Name-based Timestamp Matching ---------------------- */

// Phase 1: name + timestamp (0-11s)
function phase1MatchingTimestampByName(sendRows, openRows) {
  const successful = [];
  const failed = [];
  const usedIndices = new Set();

  // Build name-based lookup
  const openByName = new Map();
  openRows.forEach((open, idx) => {
    const name = (open.recipient_name_norm || "").toLowerCase().trim();
    if (!name) return;
    if (!openByName.has(name)) openByName.set(name, []);
    openByName.get(name).push({ ...open, _index: idx });
  });

  sendRows.forEach((send) => {
    const name = (send.recipient_name_norm || "").toLowerCase().trim();
    const baseDateTime = send.sent_date_parsed;

    if (!name || !baseDateTime) {
      failed.push({ ...send, failure_reason: "invalid_name_or_date" });
      return;
    }

    const nameOpens = openByName.get(name) || [];
    if (nameOpens.length === 0) {
      failed.push({ ...send, failure_reason: "no_open_records_for_name" });
      return;
    }

    let matchFound = false;
    for (let increment = 0; increment <= 11; increment++) {
      const searchTime = new Date(baseDateTime.getTime() + increment * 1000);
      const matches = nameOpens.filter((open) => {
        if (!open.sent_date_parsed) return false;
        return Math.abs(open.sent_date_parsed.getTime() - searchTime.getTime()) < 1000;
      });

      if (matches.length === 1) {
        const matched = matches[0];
        usedIndices.add(matched._index);
        successful.push({
          ...send,
          Views: matched.Views || 0,
          Clicks: matched.Clicks || 0,
          last_opened: matched.last_opened || matched.sent_date,
          _matched_index: matched._index,
        });
        matchFound = true;
        break;
      } else if (matches.length > 1) {
        failed.push({
          ...send,
          failure_reason: `multiple_matches_at_plus_${increment}_seconds`,
          match_count: matches.length,
        });
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      failed.push({ ...send, failure_reason: "no_match_within_11_seconds" });
    }
  });

  return { successful, failed, usedIndices };
}

// Phase 2: name + timestamp (12-60s)
function phase2MatchingTimestampByName(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];

  const unusedOpens = openRows
    .map((open, idx) => ({ ...open, _index: idx }))
    .filter((open) => !usedIndices.has(open._index));

  const openByName = new Map();
  unusedOpens.forEach((open) => {
    const name = (open.recipient_name_norm || "").toLowerCase().trim();
    if (!name) return;
    if (!openByName.has(name)) openByName.set(name, []);
    openByName.get(name).push(open);
  });

  failedRecords.forEach((failed) => {
    const name = (failed.recipient_name_norm || "").toLowerCase().trim();
    const baseDateTime = failed.sent_date_parsed;

    if (!name || !baseDateTime) {
      finalFailed.push({ ...failed, failure_reason: "invalid_name_or_date" });
      return;
    }

    const nameOpens = openByName.get(name) || [];
    if (nameOpens.length === 0) {
      finalFailed.push({ ...failed, failure_reason: "no_unused_opens_for_name" });
      return;
    }

    let matchFound = false;
    for (let increment = 12; increment <= 60; increment++) {
      const searchTime = new Date(baseDateTime.getTime() + increment * 1000);
      const matches = nameOpens.filter((open) => {
        if (!open.sent_date_parsed) return false;
        return Math.abs(open.sent_date_parsed.getTime() - searchTime.getTime()) < 1000;
      });

      if (matches.length === 1) {
        const matched = matches[0];
        successful.push({
          ...failed,
          Views: matched.Views || 0,
          Clicks: matched.Clicks || 0,
          last_opened: matched.last_opened || matched.sent_date,
          _matched_index: matched._index,
          failure_reason: undefined,
          match_count: undefined,
        });
        matchFound = true;
        break;
      } else if (matches.length > 1) {
        finalFailed.push({
          ...failed,
          failure_reason: `multiple_matches_at_plus_${increment}_seconds_phase2`,
          match_count: matches.length,
        });
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      finalFailed.push({ ...failed, failure_reason: "no_match_within_60_seconds" });
    }
  });

  return { successful, failed: finalFailed };
}

/* ---------------------- Relaxed matching helpers ---------------------- */

function closestWithinWindowMatching(failedRecords, openRows, usedIndices, windowSeconds = 300) {
  const successful = [];
  const finalFailed = [];

  const unusedOpens = openRows
    .map((open, idx) => ({ ...open, _index: idx }))
    .filter((open) => !usedIndices.has(open._index));

  const opensByEmail = new Map();
  unusedOpens.forEach((open) => {
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map((m) => m[1].toLowerCase());
    for (const email of emails) {
      if (!opensByEmail.has(email)) opensByEmail.set(email, []);
      opensByEmail.get(email).push(open);
    }
  });

  failedRecords.forEach((failed) => {
    const email = (failed["Recipient Email"] || failed.recipient_email || failed.recipient_name || "").toLowerCase().trim();
    const base = failed.sent_date_parsed;
    if (!email || !base) {
      finalFailed.push(failed);
      return;
    }

    const emailOpens = opensByEmail.get(email) || [];
    if (!emailOpens.length) {
      finalFailed.push(failed);
      return;
    }

    // Filter within window
    const candidates = emailOpens.filter((open) => open.sent_date_parsed).map((open) => {
      const delta = Math.abs(open.sent_date_parsed.getTime() - base.getTime());
      const dir = open.sent_date_parsed.getTime() - base.getTime() >= 0 ? 1 : -1;
      return { open, delta, dir };
    }).filter((c) => c.delta <= windowSeconds * 1000);

    if (!candidates.length) {
      finalFailed.push(failed);
      return;
    }

    // Prefer after-send; then smallest delta
    const after = candidates.filter((c) => c.dir >= 0);
    const chosen = (after.length ? after : candidates).sort((a, b) => a.delta - b.delta)[0];

    successful.push({
      ...failed,
      Views: chosen.open.Views || 0,
      Clicks: chosen.open.Clicks || 0,
      last_opened: chosen.open.last_opened || chosen.open.sent_date,
      _matched_index: chosen.open._index,
    });
  });

  return { successful, failed: finalFailed };
}

function emailFallbackUnusedOpens(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];

  const unusedOpens = openRows
    .map((open, idx) => ({ ...open, _index: idx }))
    .filter((open) => !usedIndices.has(open._index));

  const latestByEmail = new Map();
  unusedOpens.forEach((open) => {
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map((m) => m[1].toLowerCase());
    for (const email of emails) {
      const existing = latestByEmail.get(email);
      if (!existing || ((open.sent_date_parsed || new Date(0)) > (existing.sent_date_parsed || new Date(0)))) {
        latestByEmail.set(email, open);
      }
    }
  });

  failedRecords.forEach((failed) => {
    const email = (failed["Recipient Email"] || failed.recipient_email || failed.recipient_name || "").toLowerCase().trim();
    if (!email) {
      finalFailed.push(failed);
      return;
    }
    const open = latestByEmail.get(email);
    if (open) {
      successful.push({
        ...failed,
        Views: open.Views || 0,
        Clicks: open.Clicks || 0,
        last_opened: open.last_opened || open.sent_date,
        _matched_index: open._index,
      });
    } else {
      finalFailed.push(failed);
    }
  });

  return { successful, failed: finalFailed };
}
/* ---------------------- Composite Matching Strategies ---------------------- */

/**
 * Match by normalized name AND subject (medium confidence ~0.8)
 * Good for cases where Opens has name but no email
 */
function matchByNameAndSubject(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Build lookup: (normalized_name, lowercase_subject) -> opens
  const opensByNameSubject = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const name = (open.recipient_name_norm || "").trim();
    const subject = (open.Subject || "").toLowerCase().trim();
    
    if (name && subject) {
      const key = `${name}|||${subject}`;
      if (!opensByNameSubject.has(key)) {
        opensByNameSubject.set(key, []);
      }
      opensByNameSubject.get(key).push({ ...open, _index: idx });
    }
  });
  
  failedRecords.forEach((failed) => {
    const name = (failed.recipient_name_norm || "").trim();
    const subject = (failed.Subject || "").toLowerCase().trim();
    
    if (!name || !subject) {
      finalFailed.push(failed);
      return;
    }
    
    const key = `${name}|||${subject}`;
    const matches = opensByNameSubject.get(key) || [];
    
    if (matches.length > 0) {
      // Validate timestamp: Send CSV sent_date should match Opens CSV "Sent" field (within 60 seconds)
      const sendDate = failed.sent_date_parsed;
      if (!sendDate) {
        finalFailed.push(failed);
        return;
      }
      
      // Filter matches by timestamp proximity (within 10 minutes for better coverage)
      // Increased to 10 minutes to catch more matches
      const timestampMatches = matches.filter(open => {
        const openDate = open.sent_date_parsed;
        if (!openDate) return false;
        const timeDiff = Math.abs(openDate.getTime() - sendDate.getTime());
        return timeDiff <= 600000; // 10 minutes in milliseconds (600000ms)
      });
      
      // Filter to only unused opens to prevent mixing matches
      const unusedMatches = matches.filter(open => !usedIndices.has(open._index));
      const unusedTimestampMatches = timestampMatches.filter(open => !usedIndices.has(open._index));
      
      let bestMatch = null;
      if (unusedTimestampMatches.length > 0) {
        // If we have timestamp-validated unused matches, use the closest one
        // Sort by timestamp to ensure chronological matching (Send 1 -> Open 1, Send 2 -> Open 2)
        const sortedTimestampMatches = unusedTimestampMatches
          .sort((a, b) => a.sent_date_parsed.getTime() - b.sent_date_parsed.getTime());
        
        bestMatch = sortedTimestampMatches.reduce((closest, current) => {
          if (!closest) return current;
          const sendTime = sendDate.getTime();
          const closestTime = closest.sent_date_parsed.getTime();
          const currentTime = current.sent_date_parsed.getTime();
          const closestDiff = Math.abs(closestTime - sendTime);
          const currentDiff = Math.abs(currentTime - sendTime);
          return currentDiff < closestDiff ? current : closest;
      }, null);
      } else if (unusedMatches.length === 1) {
        // If only one unused match, use it (but lower confidence)
        bestMatch = unusedMatches[0];
      } else if (unusedMatches.length > 1) {
        // Multiple unused matches but none within timestamp window - take closest anyway
        // Sort chronologically to ensure proper pairing
        const sortedUnused = unusedMatches
          .filter(m => m.sent_date_parsed)
          .sort((a, b) => a.sent_date_parsed.getTime() - b.sent_date_parsed.getTime());
        
        bestMatch = sortedUnused.reduce((closest, current) => {
          if (!closest) return current;
          const sendTime = sendDate.getTime();
          const closestTime = closest.sent_date_parsed?.getTime() || 0;
          const currentTime = current.sent_date_parsed?.getTime() || 0;
          const closestDiff = Math.abs(closestTime - sendTime);
          const currentDiff = Math.abs(currentTime - sendTime);
          return currentDiff < closestDiff ? current : closest;
        }, null);
      } else if (matches.length === 1 && !usedIndices.has(matches[0]._index)) {
        // Only one match total and it's unused
        bestMatch = matches[0];
      }
      
      if (bestMatch) {
        const hasTimestampMatch = timestampMatches.length > 0;
        successful.push({
          ...failed,
          Views: bestMatch.Views || 0,
          Clicks: bestMatch.Clicks || 0,
          last_opened: bestMatch.last_opened || bestMatch.sent_date,
          _matched_index: bestMatch._index,
          _match_method: 'name_subject',
          _match_confidence: hasTimestampMatch ? 0.8 : 0.6, // Lower confidence if no timestamp match
        });
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Match by subject only (lower confidence ~0.5)
 * Risk: Same subject might be used for different recipients
 */
function matchBySubjectOnly(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Build lookup: lowercase_subject -> opens (store all matches, not just most recent)
  // This allows us to match multiple sends with multiple opens by the same subject
  const opensBySubject = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const subject = (open.Subject || "").toLowerCase().trim();
    if (!subject) return;
    
    if (!opensBySubject.has(subject)) {
      opensBySubject.set(subject, []);
    }
    opensBySubject.get(subject).push({ ...open, _index: idx });
  });
  
  failedRecords.forEach((failed) => {
    const subject = (failed.Subject || "").toLowerCase().trim();
    
    if (!subject) {
      finalFailed.push(failed);
      return;
    }
    
    const matches = opensBySubject.get(subject) || [];
    
    // Filter to unused matches and find best by timestamp
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      const sendDate = failed.sent_date_parsed;
      
      // Find best match by timestamp (closest to send date)
      const match = unusedMatches.reduce((best, current) => {
        if (!best) return current;
        if (!sendDate || !current.sent_date_parsed) return best;
        
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed?.getTime() || 0;
        const currentTime = current.sent_date_parsed.getTime();
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (match) {
        // Validate timestamp: Send CSV sent_date should match Opens CSV "Sent" field (within 60 seconds)
        const sendDate = failed.sent_date_parsed;
        const openDate = match.sent_date_parsed;
        
        let timestampValid = false;
        let confidence = 0.5;
        
        if (sendDate && openDate) {
          const timeDiff = Math.abs(openDate.getTime() - sendDate.getTime());
          timestampValid = timeDiff <= 600000; // 10 minutes in milliseconds (increased for better coverage)
          confidence = timestampValid ? 0.5 : 0.3; // Lower confidence if timestamp doesn't match
        }
        
      successful.push({
        ...failed,
        Views: match.Views || 0,
        Clicks: match.Clicks || 0,
        last_opened: match.last_opened || match.sent_date,
        _matched_index: match._index,
        _match_method: 'subject_only',
          _match_confidence: confidence,
      });
        usedIndices.add(match._index); // Mark as used to prevent mixing
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Match by name only (lowest confidence ~0.4)
 * Risk: Names are not unique, "Rob Anderson" could match multiple people
 */
function matchByNameOnly(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Build lookup: normalized_name -> opens (store all matches, not just most recent)
  // This allows us to match multiple sends with multiple opens by the same name
  const opensByName = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const name = (open.recipient_name_norm || "").trim();
    if (!name || name.length < 3) return;
    
    if (!opensByName.has(name)) {
      opensByName.set(name, []);
    }
    opensByName.get(name).push({ ...open, _index: idx });
  });
  
  failedRecords.forEach((failed) => {
    const name = (failed.recipient_name_norm || "").trim();
    
    if (!name || name.length < 3) {
      finalFailed.push(failed);
      return;
    }
    
    const matches = opensByName.get(name) || [];
    
    // Filter to unused matches and find best by timestamp
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      const sendDate = failed.sent_date_parsed;
      
      // Find best match by timestamp (closest to send date)
      const match = unusedMatches.reduce((best, current) => {
        if (!best) return current;
        if (!sendDate || !current.sent_date_parsed) return best;
        
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed?.getTime() || 0;
        const currentTime = current.sent_date_parsed.getTime();
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (match) {
        // Validate timestamp: Send CSV sent_date should match Opens CSV "Sent" field (within 60 seconds)
        const openDate = match.sent_date_parsed;
        
        let timestampValid = false;
        let confidence = 0.4;
        
        if (sendDate && openDate) {
          const timeDiff = Math.abs(openDate.getTime() - sendDate.getTime());
          timestampValid = timeDiff <= 600000; // 10 minutes in milliseconds (increased for better coverage)
          confidence = timestampValid ? 0.4 : 0.2; // Lower confidence if timestamp doesn't match
        }
        
      successful.push({
        ...failed,
        Views: match.Views || 0,
        Clicks: match.Clicks || 0,
        last_opened: match.last_opened || match.sent_date,
        _matched_index: match._index,
        _match_method: 'name_only',
          _match_confidence: confidence,
        });
        usedIndices.add(match._index); // Mark as used to prevent mixing
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/* ---------------------- Enhanced Composite Matching Strategies ---------------------- */

/**
 * Match by fuzzy subject (handles "Re:", "Fwd:", case variations, whitespace)
 * Lower confidence but catches more matches
 */
function matchByFuzzySubject(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Normalize subject: remove "Re:", "Fwd:", trim, lowercase
  const normalizeSubject = (subject) => {
    if (!subject) return "";
    return String(subject)
      .replace(/^(re|fwd|fw):\s*/i, "") // Remove Re:/Fwd: prefix
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .toLowerCase();
  };
  
  // Build lookup: normalized_subject -> opens
  const opensByFuzzySubject = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const subject = normalizeSubject(open.Subject);
    if (!subject || subject.length < 3) return;
    
    if (!opensByFuzzySubject.has(subject)) {
      opensByFuzzySubject.set(subject, []);
    }
    opensByFuzzySubject.get(subject).push({ ...open, _index: idx });
  });
  
  failedRecords.forEach((failed) => {
    const subject = normalizeSubject(failed.Subject);
    
    if (!subject || subject.length < 3) {
      finalFailed.push(failed);
      return;
    }
    
    const matches = opensByFuzzySubject.get(subject) || [];
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      const sendDate = failed.sent_date_parsed;
      const match = unusedMatches.reduce((best, current) => {
        if (!best) return current;
        if (!sendDate || !current.sent_date_parsed) return best;
        
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed?.getTime() || 0;
        const currentTime = current.sent_date_parsed.getTime();
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (match) {
        successful.push({
          ...failed,
          Views: match.Views || 0,
          Clicks: match.Clicks || 0,
          last_opened: match.last_opened || match.sent_date,
          _matched_index: match._index,
          _match_method: 'fuzzy_subject',
          _match_confidence: 0.3,
        });
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Match by email domain + name (for cases where full email doesn't match but domain does)
 */
function matchByDomainAndName(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Extract domain from email
  const getDomain = (email) => {
    if (!email || !email.includes("@")) return null;
    return email.split("@")[1]?.toLowerCase().trim();
  };
  
  // Build lookup: (domain, normalized_name) -> opens
  const opensByDomainName = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    // Try to extract email from Recipient field
    const originalRecipient = open._original_recipient || open.Recipient || open.recipient_name || "";
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = [...originalRecipient.matchAll(emailRegex)].map(m => m[1].toLowerCase());
    
    const name = (open.recipient_name_norm || "").trim();
    if (!name || name.length < 3) return;
    
    for (const email of emails) {
      const domain = getDomain(email);
      if (domain) {
        const key = `${domain}|||${name}`;
        if (!opensByDomainName.has(key)) {
          opensByDomainName.set(key, []);
        }
        opensByDomainName.get(key).push({ ...open, _index: idx });
        break; // Only add once per open
      }
    }
  });
  
  failedRecords.forEach((failed) => {
    const email = (failed["Recipient Email"] || "").toLowerCase().trim();
    const domain = getDomain(email);
    const name = (failed.recipient_name_norm || "").trim();
    
    if (!domain || !name || name.length < 3) {
      finalFailed.push(failed);
      return;
    }
    
    const key = `${domain}|||${name}`;
    const matches = opensByDomainName.get(key) || [];
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      const sendDate = failed.sent_date_parsed;
      const match = unusedMatches.reduce((best, current) => {
        if (!best) return current;
        if (!sendDate || !current.sent_date_parsed) return best;
        
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed?.getTime() || 0;
        const currentTime = current.sent_date_parsed.getTime();
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (match) {
        successful.push({
          ...failed,
          Views: match.Views || 0,
          Clicks: match.Clicks || 0,
          last_opened: match.last_opened || match.sent_date,
          _matched_index: match._index,
          _match_method: 'domain_name',
          _match_confidence: 0.25,
        });
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Match by date range (same day) + name/subject (ignores time, matches by date only)
 * Very low confidence but catches cases where timestamps are off
 */
function matchByDateRange(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Get date only (ignore time)
  const getDateOnly = (date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };
  
  // Build lookup: (date_only, normalized_name, normalized_subject) -> opens
  const opensByDateNameSubject = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const dateOnly = getDateOnly(open.sent_date_parsed);
    const name = (open.recipient_name_norm || "").trim();
    const subject = ((open.Subject || "").toLowerCase().trim()).substring(0, 50); // First 50 chars
    
    if (!dateOnly || !name || name.length < 3) return;
    
    const key = `${dateOnly.getTime()}|||${name}|||${subject}`;
    if (!opensByDateNameSubject.has(key)) {
      opensByDateNameSubject.set(key, []);
    }
    opensByDateNameSubject.get(key).push({ ...open, _index: idx });
  });
  
  failedRecords.forEach((failed) => {
    const dateOnly = getDateOnly(failed.sent_date_parsed);
    const name = (failed.recipient_name_norm || "").trim();
    const subject = ((failed.Subject || "").toLowerCase().trim()).substring(0, 50);
    
    if (!dateOnly || !name || name.length < 3) {
      finalFailed.push(failed);
      return;
    }
    
    const key = `${dateOnly.getTime()}|||${name}|||${subject}`;
    const matches = opensByDateNameSubject.get(key) || [];
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      // Take first unused match (they're all same day)
      const match = unusedMatches[0];
      
      successful.push({
        ...failed,
        Views: match.Views || 0,
        Clicks: match.Clicks || 0,
        last_opened: match.last_opened || match.sent_date,
        _matched_index: match._index,
        _match_method: 'date_range',
        _match_confidence: 0.2,
      });
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Match by Thread ID (if available, this is a very strong signal)
 */
function matchByThreadId(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Build lookup: thread_id -> opens
  const opensByThreadId = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const threadId = (open["Thread ID"] || open.thread_id || open.ThreadID || "").toString().trim();
    if (!threadId || threadId === "" || threadId === "undefined" || threadId === "null") return;
    
    if (!opensByThreadId.has(threadId)) {
      opensByThreadId.set(threadId, []);
    }
    opensByThreadId.get(threadId).push({ ...open, _index: idx });
  });
  
  failedRecords.forEach((failed) => {
    const threadId = (failed["Thread ID"] || failed.thread_id || failed.ThreadID || "").toString().trim();
    
    if (!threadId || threadId === "" || threadId === "undefined" || threadId === "null") {
      finalFailed.push(failed);
      return;
    }
    
    const matches = opensByThreadId.get(threadId) || [];
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      // Thread ID is a strong signal, take the first unused match
      const match = unusedMatches[0];
      
      successful.push({
        ...failed,
        Views: match.Views || 0,
        Clicks: match.Clicks || 0,
        last_opened: match.last_opened || match.sent_date,
        _matched_index: match._index,
        _match_method: 'thread_id',
        _match_confidence: 0.9, // High confidence for Thread ID matches
      });
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Match by fuzzy name (handle variations like "John Smith" vs "John A. Smith", "J. Smith")
 */
function matchByFuzzyName(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Normalize name for fuzzy matching: remove middle initials, normalize whitespace
  const normalizeNameForFuzzy = (name) => {
    if (!name) return "";
    return String(name)
      .toLowerCase()
      .replace(/\b[a-z]\.\s*/g, "") // Remove single letter initials like "J. "
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  };
  
  // Build lookup: normalized_fuzzy_name -> opens
  const opensByFuzzyName = new Map();
  openRows.forEach((open, idx) => {
    if (usedIndices.has(idx)) return;
    
    const fuzzyName = normalizeNameForFuzzy(open.recipient_name_norm || open.recipient_name);
    if (!fuzzyName || fuzzyName.length < 3) return;
    
    if (!opensByFuzzyName.has(fuzzyName)) {
      opensByFuzzyName.set(fuzzyName, []);
    }
    opensByFuzzyName.get(fuzzyName).push({ ...open, _index: idx });
  });
  
  failedRecords.forEach((failed) => {
    const fuzzyName = normalizeNameForFuzzy(failed.recipient_name_norm || failed.recipient_name);
    
    if (!fuzzyName || fuzzyName.length < 3) {
      finalFailed.push(failed);
      return;
    }
    
    const matches = opensByFuzzyName.get(fuzzyName) || [];
    const unusedMatches = matches.filter(m => !usedIndices.has(m._index));
    
    if (unusedMatches.length > 0) {
      const sendDate = failed.sent_date_parsed;
      const match = unusedMatches.reduce((best, current) => {
        if (!best) return current;
        if (!sendDate || !current.sent_date_parsed) return best;
        
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed?.getTime() || 0;
        const currentTime = current.sent_date_parsed.getTime();
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (match) {
        successful.push({
          ...failed,
          Views: match.Views || 0,
          Clicks: match.Clicks || 0,
          last_opened: match.last_opened || match.sent_date,
          _matched_index: match._index,
          _match_method: 'fuzzy_name',
          _match_confidence: 0.3,
        });
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
    }
  });
  
  return { successful, failed: finalFailed };
}

/**
 * Last resort: Match by date proximity only (within 1 hour, no name/subject requirement)
 * Very low confidence but catches remaining unmatched records
 */
function matchByDateProximity(failedRecords, openRows, usedIndices) {
  const successful = [];
  const finalFailed = [];
  
  // Get unused opens
  const unusedOpens = openRows
    .map((open, idx) => ({ ...open, _index: idx }))
    .filter((open) => !usedIndices.has(open._index) && open.sent_date_parsed);
  
  if (unusedOpens.length === 0) {
    return { successful: [], failed: failedRecords };
  }
  
  failedRecords.forEach((failed) => {
    const sendDate = failed.sent_date_parsed;
    if (!sendDate) {
      finalFailed.push(failed);
      return;
    }
    
    // Find opens within 1 hour (3600000ms)
    const nearbyOpens = unusedOpens.filter(open => {
      if (!open.sent_date_parsed) return false;
      const timeDiff = Math.abs(open.sent_date_parsed.getTime() - sendDate.getTime());
      return timeDiff <= 3600000; // 1 hour
    });
    
    if (nearbyOpens.length > 0) {
      // Find closest by timestamp
      const closest = nearbyOpens.reduce((best, current) => {
        if (!best) return current;
        const sendTime = sendDate.getTime();
        const bestTime = best.sent_date_parsed.getTime();
        const currentTime = current.sent_date_parsed.getTime();
        const bestDiff = Math.abs(bestTime - sendTime);
        const currentDiff = Math.abs(currentTime - sendTime);
        return currentDiff < bestDiff ? current : best;
      }, null);
      
      if (closest) {
        successful.push({
          ...failed,
          Views: closest.Views || 0,
          Clicks: closest.Clicks || 0,
          last_opened: closest.last_opened || closest.sent_date,
          _matched_index: closest._index,
          _match_method: 'date_proximity',
          _match_confidence: 0.15, // Very low confidence - last resort
        });
        usedIndices.add(closest._index);
      } else {
        finalFailed.push(failed);
      }
    } else {
      finalFailed.push(failed);
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
