// Utility Functions
function normalizeCompany(value) {
  return value ? String(value).trim().toLowerCase() : "";
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function parseDate(dateStr, format = "DD/MM/YYYY HH:MM:SS") {
  try {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatDate(date, format = "%d/%m/%Y %H:%M:%S") {
  if (!date || !(date instanceof Date)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const mins = pad(date.getMinutes());
  const secs = pad(date.getSeconds());
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}

function isValidEmail(email) {
  return email && String(email).includes("@");
}

// Logger utility
const logger = {
  info: (msg) => console.log(`ℹ️ [INFO] ${msg}`),
  error: (msg) => console.error(`❌ [ERROR] ${msg}`),
  warn: (msg) => console.warn(`⚠️ [WARN] ${msg}`),
};

// ============================================================================
// NAMED EXPORTS - Your Original Functions
// ============================================================================

/**
 * Build combined records by joining email rows with call data
 * @param {Array} emailRows - Email/send data
 * @param {Array} callRows - Call data
 * @returns {Object} { records, stats }
 */
export function buildCombinedRecords(emailRows, callRows) {
  const callIndex = new Map();

  callRows.forEach((call) => {
    const companyKey = normalizeCompany(
      call["Company / Account"] || call.Company || call.Account
    );
    if (!companyKey) return;

    if (!callIndex.has(companyKey)) {
      callIndex.set(companyKey, {
        totalCalls: 0,
        connectedCalls: 0,
        totalCallDuration: 0,
        latestCallDate: null,
        companyLabel: call["Company / Account"] || call.Company || "Unknown",
      });
    }

    const agg = callIndex.get(companyKey);
    agg.totalCalls += 1;
    const disposition = (call["Call Disposition"] || "").toLowerCase();
    if (disposition.includes("connect")) agg.connectedCalls += 1;
    agg.totalCallDuration += safeNumber(call["Call Duration"]);
    const d = parseDate(call.Date);
    if (d && (!agg.latestCallDate || d > agg.latestCallDate)) {
      agg.latestCallDate = d;
    }
  });

  const combined = emailRows.map((email) => {
    const companyKey =
      normalizeCompany(
        email.Company ||
          email["Company Name"] ||
          email["Company / Account"] ||
          email.CompanyURL ||
          email.company
      ) ||
      normalizeCompany(email["Account Name"]);

    const callAgg = companyKey ? callIndex.get(companyKey) : null;
    return {
      ...email,
      total_calls: callAgg?.totalCalls || 0,
      connected_calls: callAgg?.connectedCalls || 0,
      total_call_duration: callAgg?.totalCallDuration || 0,
      latest_call_date: callAgg?.latestCallDate
        ? callAgg.latestCallDate.toISOString().split("T")[0]
        : null,
      _companyLabel: callAgg?.companyLabel || email.Company || "N/A",
    };
  });

  const matched = combined.filter((row) => row.total_calls > 0);

  const stats = {
    totalEmailRecords: emailRows.length,
    emailCallMatches: matched.length,
    emailOnlyCount: emailRows.length - matched.length,
    joinSuccessRate: emailRows.length
      ? (matched.length / emailRows.length) * 100
      : 0,
    totalCalls: callRows.length,
  };

  return { records: combined, stats };
}

/**
 * Group records by company
 * @param {Array} records - Combined records
 * @returns {Array} Array of company groups
 */
export function groupByCompany(records) {
  const map = new Map();

  records.forEach((record) => {
    const key = record._companyLabel || record.Company || "Unknown";
    if (!map.has(key)) {
      map.set(key, {
        company: key,
        emails: [],
        totalViews: 0,
        totalClicks: 0,
        totalCalls: 0,
        connectedCalls: 0,
      });
    }
    const agg = map.get(key);
    agg.emails.push(record);
    agg.totalViews += Number(record.Views) || 0;
    agg.totalClicks += Number(record.Clicks) || 0;
    agg.totalCalls += record.total_calls || 0;
    agg.connectedCalls += record.connected_calls || 0;
  });

  return [...map.values()].sort(
    (a, b) =>
      b.totalViews - a.totalViews || b.totalCalls - a.totalCalls
  );
}

// ============================================================================
// MAIN CLASS EXPORT - DataProcessor
// ============================================================================

class DataProcessor {
  constructor() {
    this.requiredSendColumns = ["recipient_name", "sent_date", "Recipient Email"];
    this.requiredOpenColumns = ["recipient_name", "sent_date", "Views", "Clicks"];
    this.requiredContactsColumns = ["Email"];

    this.columnMappings = {
      send_mails: {
        "Recipient Name": "recipient_name",
        Date: "sent_date",
        recipient_email: "Recipient Email",
        recipient_name: "recipient_name",
        sent_date: "sent_date",
        "Recipient Email": "Recipient Email",
      },
      open_mails: {
        Recipient: "recipient_name",
        Sent: "sent_date",
        Opens: "Views",
        Clicks: "Clicks",
        "Last Opened": "last_opened",
      },
      contacts: {
        Email: "Email",
      },
    };
  }

  /**
   * Validate and map columns for uploaded files
   */
  sheetsValidator(files) {
    const errorMessages = [];
    const mappedDataframes = {};

    logger.info("Starting comprehensive sheets validation...");

    const fileDefinitions = {
      send_mails: {
        displayName: "Send Mails CSV",
        requiredColumns: this.requiredSendColumns,
        mapping: this.columnMappings.send_mails,
      },
      open_mails: {
        displayName: "Open Mails CSV",
        requiredColumns: this.requiredOpenColumns,
        mapping: this.columnMappings.open_mails,
      },
      contacts: {
        displayName: "Contacts CSV",
        requiredColumns: this.requiredContactsColumns,
        mapping: this.columnMappings.contacts,
      },
    };

    // Validate each file
    for (const [fileKey, fileObj] of Object.entries(files)) {
      if (!fileObj) {
        const displayName = fileDefinitions[fileKey]?.displayName || fileKey;
        errorMessages.push(
          `❌ **Missing File**: ${displayName} is required but not uploaded.`
        );
        continue;
      }

      if (!fileDefinitions[fileKey]) continue;

      const fileDef = fileDefinitions[fileKey];

      try {
        // Parse CSV
        const df = this._parseCSV(fileObj);

        logger.info(
          `Validating ${fileDef.displayName}: ${df.length} rows, ${df[0] ? Object.keys(df[0]).length : 0} columns`
        );

        // Validation Rule 1: Check if file is empty
        if (df.length === 0) {
          errorMessages.push(
            `❌ **Empty File**: ${fileDef.displayName} contains no data rows.`
          );
          continue;
        }

        // Validation Rule 2: Check available columns
        const availableColumns = Object.keys(df[0] || {});
        logger.info(
          `Available columns in ${fileDef.displayName}: ${availableColumns.join(", ")}`
        );

        // Validation Rule 3: Apply column mapping
        const mappedColumns = {};
        for (const [userCol, sysCol] of Object.entries(fileDef.mapping)) {
          if (availableColumns.includes(userCol)) {
            mappedColumns[userCol] = sysCol;
            logger.info(`✅ Mapped '${userCol}' → '${sysCol}'`);
          } else if (availableColumns.includes(sysCol)) {
            mappedColumns[sysCol] = sysCol;
            logger.info(`✅ Found direct match '${sysCol}'`);
          }
        }

        // Validation Rule 4: Rename columns
        let dfMapped = df.map((row) => {
          const newRow = {};
          for (const [key, value] of Object.entries(row)) {
            const newKey = mappedColumns[key] || key;
            newRow[newKey] = value;
          }
          return newRow;
        });

        // Validation Rule 5: Check for required columns
        const finalColumns = Object.keys(dfMapped[0] || {});
        const missingRequired = fileDef.requiredColumns.filter(
          (col) => !finalColumns.includes(col)
        );

        if (missingRequired.length > 0) {
          errorMessages.push(
            `❌ **Missing Required Columns** in ${fileDef.displayName}: ${missingRequired.join(", ")}`
          );
          errorMessages.push(
            `📋 **Available columns after mapping**: ${finalColumns.join(", ")}`
          );
          continue;
        }

        // Validation Rule 6: Data type validation
        const validationResult = this._validateDataContent(
          dfMapped,
          fileKey,
          fileDef.displayName
        );
        if (!validationResult.isValid) {
          errorMessages.push(...validationResult.errors);
          continue;
        }

        // Validation Rule 7: Apply filtering rules
        const { df: dfFiltered, info: filterInfo } =
          this._applyFilteringRules(dfMapped, fileKey, fileDef.displayName);

        if (filterInfo.filteredCount > 0) {
          logger.info(
            `📝 ${fileDef.displayName}: ${filterInfo.message}`
          );
        }

        mappedDataframes[fileKey] = dfFiltered;
        logger.info(`✅ ${fileDef.displayName} validation passed`);
      } catch (error) {
        errorMessages.push(
          `❌ **File Processing Error** in ${fileDef.displayName}: ${error.message}`
        );
        logger.error(`Error processing ${fileDef.displayName}: ${error.message}`);
      }
    }

    const requiredFiles = ["send_mails", "open_mails", "contacts"];
    const validatedFiles = Object.keys(mappedDataframes);
    const isValid =
      errorMessages.length === 0 &&
      requiredFiles.every((f) => validatedFiles.includes(f));

    if (isValid) {
      logger.info("🎉 All sheets validation passed successfully!");
    } else {
      logger.error(`❌ Sheets validation failed with ${errorMessages.length} errors`);
    }

    return { isValid, errorMessages, mappedDataframes };
  }

  /**
   * Parse CSV string or file to array of objects
   */
  _parseCSV(csvInput) {
    let csvText = csvInput;

    // If it's a File object, we'd need to read it async
    // For this example, assuming it's already a string
    if (csvInput instanceof File) {
      throw new Error(
        "File objects must be read asynchronously. Use FileReader or fetch."
      );
    }

    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Validate data content
   */
  _validateDataContent(df, fileKey, displayName) {
    const errors = [];

    try {
      // Email validation
      if (fileKey === "send_mails" && df.length > 0 && "Recipient Email" in df[0]) {
        let invalidEmails = 0;
        for (let i = 0; i < Math.min(10, df.length); i++) {
          if (!isValidEmail(df[i]["Recipient Email"])) {
            invalidEmails++;
          }
        }
        if (invalidEmails > 0) {
          errors.push(
            `❌ **Email Format Error** in ${displayName}: ${invalidEmails} rows have invalid email format`
          );
        }
      }

      // Contact email validation
      if (fileKey === "contacts" && df.length > 0 && "Email" in df[0]) {
        let invalidEmails = 0;
        for (let i = 0; i < Math.min(10, df.length); i++) {
          if (!isValidEmail(df[i]["Email"])) {
            invalidEmails++;
          }
        }
        if (invalidEmails > 0) {
          errors.push(
            `❌ **Email Format Error** in ${displayName}: ${invalidEmails} rows have invalid email format`
          );
        }
      }

      // Numeric validation
      if (fileKey === "open_mails") {
        for (const col of ["Views", "Clicks"]) {
          if (df.length > 0 && col in df[0]) {
            let nonNumeric = 0;
            for (let i = 0; i < Math.min(10, df.length); i++) {
              if (df[i][col] && isNaN(Number(df[i][col]))) {
                nonNumeric++;
              }
            }
            if (nonNumeric > 0) {
              errors.push(
                `❌ **Numeric Format Error** in ${displayName}: ${nonNumeric} rows have non-numeric values in '${col}'`
              );
            }
          }
        }
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `❌ **Data Validation Error** in ${displayName}: ${error.message}`,
        ],
      };
    }
  }

  /**
   * Apply filtering and cleaning rules
   */
  _applyFilteringRules(df, fileKey, displayName) {
    const originalCount = df.length;
    let filtered = [...df];
    const filterMessages = [];

    try {
      if (fileKey === "send_mails") {
        // Rule 1: Remove loopwork.co records
        if (df[0] && "Domain" in df[0]) {
          const before = filtered.length;
          filtered = filtered.filter(
            (row) =>
              !normalizeCompany(row.Domain).includes("loopwork.co")
          );
          const loopworkFiltered = before - filtered.length;

          if (loopworkFiltered > 0) {
            filterMessages.push(
              `Removed ${loopworkFiltered} records with 'loopwork.co' domain`
            );
            logger.info(
              `📝 ${displayName}: Filtered out ${loopworkFiltered} 'loopwork.co' records`
            );
          }
        }

        // Rule 2: Validate sent_date
        if (df[0] && "sent_date" in df[0]) {
          filtered = filtered.map((row) => ({
            ...row,
            sent_date: parseDate(row.sent_date),
          }));
          filterMessages.push(
            `Validated ${filtered.filter((r) => r.sent_date).length} sent_date values`
          );
        }

        // Rule 3: Clean recipient_name
        if (df[0] && "recipient_name" in df[0]) {
          filtered = filtered.map((row) => ({
            ...row,
            recipient_name: row.recipient_name ? String(row.recipient_name).trim() : "",
          }));
        }
      } else if (fileKey === "open_mails") {
        // Rule 1: Split recipient_name by comma
        if (df[0] && "recipient_name" in df[0]) {
          filtered = filtered.map((row) => ({
            ...row,
            recipient_name: row.recipient_name
              ? String(row.recipient_name).split(",")[0].trim()
              : "",
          }));
          filterMessages.push(
            `Split and extracted first names from ${filtered.length} recipient_name values`
          );
        }

        // Rule 2: Convert date format
        if (df[0] && "sent_date" in df[0]) {
          filtered = filtered.map((row) => {
            const parsed = parseDate(row.sent_date);
            return {
              ...row,
              sent_date: parsed ? formatDate(parsed) : row.sent_date,
            };
          });
          filterMessages.push(
            `Converted ${filtered.length} sent_date values to DD/MM/YYYY HH:MM:SS format`
          );
        }

        // Rule 3: Convert empty Views/Clicks to 0
        for (const col of ["Views", "Clicks"]) {
          if (df[0] && col in df[0]) {
            const before = filtered.filter((r) => !r[col]).length;
            filtered = filtered.map((row) => ({
              ...row,
              [col]: row[col] ? safeNumber(row[col]) : 0,
            }));
            if (before > 0) {
              filterMessages.push(
                `Converted ${before} empty '${col}' values to 0`
              );
            }
          }
        }
      }

      const totalFiltered = originalCount - filtered.length;
      const message =
        totalFiltered > 0
          ? `Filtered out ${totalFiltered} records. Details: ${filterMessages.join("; ")}`
          : "No records filtered";

      return {
        df: filtered,
        info: {
          originalCount,
          finalCount: filtered.length,
          filteredCount: totalFiltered,
          message,
          details: filterMessages,
        },
      };
    } catch (error) {
      logger.error(`Error applying filtering rules: ${error.message}`);
      return {
        df: filtered,
        info: {
          originalCount,
          finalCount: filtered.length,
          filteredCount: 0,
          message: `Filtering failed: ${error.message}`,
          details: [],
        },
      };
    }
  }

  /**
   * Diagnose join issues
   */
  diagnosticReport(sendDf, openDf) {
    console.log("\n=== DIAGNOSTIC REPORT ===\n");
    
    // Data volume
    console.log(`📊 Data Volume:`);
    console.log(`  Sends: ${sendDf.length}`);
    console.log(`  Opens: ${openDf.length}`);
    
    // Sample data
    console.log(`\n📋 Sample Send Record:`);
    if (sendDf.length > 0) {
      console.log(`  `, JSON.stringify(sendDf[0], null, 2));
    }
    
    console.log(`\n📋 Sample Open Record:`);
    if (openDf.length > 0) {
      console.log(`  `, JSON.stringify(openDf[0], null, 2));
    }
    
    // Column check
    console.log(`\n🔍 Column Names:`);
    console.log(`  Send columns: ${Object.keys(sendDf[0] || {}).join(", ")}`);
    console.log(`  Open columns: ${Object.keys(openDf[0] || {}).join(", ")}`);
    
    // Email matching check
    console.log(`\n📧 Email Matching:`);
    const sendEmails = new Set(sendDf.map(r => String(r.recipient_name || "").trim().toLowerCase()).filter(e => e));
    const openEmails = new Set(openDf.map(r => String(r.recipient_name || "").trim().toLowerCase()).filter(e => e));
    const commonEmails = [...sendEmails].filter(e => openEmails.has(e));
    
    console.log(`  Unique send emails: ${sendEmails.size}`);
    console.log(`  Unique open emails: ${openEmails.size}`);
    console.log(`  Common emails: ${commonEmails.length}`);
    console.log(`  Overlap: ${(commonEmails.length / sendEmails.size * 100).toFixed(1)}%`);
    
    // Date format check
    console.log(`\n📅 Date Format:`);
    if (sendDf.length > 0) {
      const sendDate = sendDf[0].sent_date;
      console.log(`  Send date sample: "${sendDate}" (type: ${typeof sendDate})`);
    }
    if (openDf.length > 0) {
      const openDate = openDf[0].sent_date;
      console.log(`  Open date sample: "${openDate}" (type: ${typeof openDate})`);
    }
    
    // Views column check
    console.log(`\n👁️ Views Column:`);
    if (openDf.length > 0 && "Views" in openDf[0]) {
      const viewSample = openDf.slice(0, 5).map(r => r.Views);
      console.log(`  Sample values: ${viewSample.join(", ")}`);
    } else {
      console.log(`  ⚠️ Views column not found in opens!`);
    }
    
    console.log(`\n=== END DIAGNOSTIC ===\n`);
  }
  processFiles(files) {
    try {
      // Step 1: Validate
      const { isValid, errorMessages, mappedDataframes } =
        this.sheetsValidator(files);

      if (!isValid) {
        logger.error("Files validation failed");
        return {
          successDf: null,
          failedDf: null,
          errors: errorMessages,
          originalSendCount: 0,
        };
      }

      // Step 2: Extract validated dataframes
      const sendDf = mappedDataframes.send_mails;
      const openDf = mappedDataframes.open_mails;
      const contactsDf = mappedDataframes.contacts;

      const originalSendCount = sendDf.length;
      logger.info(`Original Send Mails count: ${originalSendCount}`);

      // Step 3: Clean data
      const cleanSendDf = this._cleanData(sendDf, "send");
      const cleanOpenDf = this._cleanData(openDf, "open");
      const cleanContactsDf = this._cleanData(contactsDf, "contacts");

      // Step 4: Join send + open
      const { successful: sendOpenSuccess, failed: sendOpenFailed } =
        this._joinSendOpen(cleanSendDf, cleanOpenDf);

      if (!sendOpenSuccess) {
        return {
          successDf: null,
          failedDf: null,
          errors: ["Failed to join Send and Open data"],
          originalSendCount,
        };
      }

      // Step 5: Join with contacts
      const contactsResult = this._joinWithContacts(
        sendOpenSuccess,
        cleanContactsDf
      );

      if (contactsResult.error) {
        return {
          successDf: null,
          failedDf: null,
          errors: [contactsResult.error],
          originalSendCount,
        };
      }

      const allFailed = [
        ...sendOpenFailed,
        ...contactsResult.failed,
      ];

      logger.info(
        `Successfully processed files: ${contactsResult.successful.length} successful, ${allFailed.length} failed`
      );

      return {
        successDf: contactsResult.successful,
        failedDf: allFailed,
        errors: [],
        originalSendCount,
      };
    } catch (error) {
      logger.error(`Error processing files: ${error.message}`);
      return {
        successDf: null,
        failedDf: null,
        errors: [`Processing Error: ${error.message}`],
        originalSendCount: 0,
      };
    }
  }

  /**
   * Clean and standardize data
   */
  _cleanData(df, fileType) {
    return df.map((row) => {
      const cleaned = { ...row };

      // Parse dates
      if ("sent_date" in cleaned) {
        cleaned.sent_date = parseDate(cleaned.sent_date);
      }

      // Clean strings
      if ("recipient_name" in cleaned) {
        cleaned.recipient_name = cleaned.recipient_name
          ? String(cleaned.recipient_name).trim()
          : "";
      }

      if ("Company URL" in cleaned) {
        cleaned["Company URL"] = normalizeCompany(cleaned["Company URL"]);
      }

      if ("Email" in cleaned) {
        cleaned.Email = cleaned.Email ? String(cleaned.Email).trim() : "";
      }

      // Convert numbers
      if (fileType === "open") {
        if ("Views" in cleaned) cleaned.Views = safeNumber(cleaned.Views);
        if ("Clicks" in cleaned) cleaned.Clicks = safeNumber(cleaned.Clicks);
      }

      return cleaned;
    });
  }

  /**
   * Join send and open data
   */
  _joinSendOpen(sendDf, openDf) {
    logger.info("Starting Send-Open join");
    const { successful, failed } = this._incrementalDatetimeJoin(
      sendDf,
      openDf
    );
    return { successful, failed };
  }

  /**
   * Two-phase incremental datetime matching
   */
  _incrementalDatetimeJoin(sendDf, openDf) {
    const successful = [];
    const failed = [];

    logger.info(`Starting Send-Open join: ${sendDf.length} sends, ${openDf.length} opens`);
    
    // Debug: Check data types and sample values
    if (sendDf.length > 0) {
      logger.info(`Sample send record:`, sendDf[0]);
      logger.info(`Sample send date type: ${typeof sendDf[0].sent_date}, value: ${sendDf[0].sent_date}`);
    }
    if (openDf.length > 0) {
      logger.info(`Sample open record:`, openDf[0]);
      logger.info(`Sample open date type: ${typeof openDf[0].sent_date}, value: ${openDf[0].sent_date}`);
    }

    const openByEmail = new Map();
    openDf.forEach((row) => {
      const email = String(row.recipient_name || "").trim().toLowerCase();
      if (!email) return;
      
      if (!openByEmail.has(email)) {
        openByEmail.set(email, []);
      }
      openByEmail.get(email).push(row);
    });

    logger.info(`Indexed ${openByEmail.size} unique emails from opens`);

    let matchStats = {
      exact: 0,
      withinWindow: 0,
      noMatch: 0,
      emailMismatch: 0,
    };

    sendDf.forEach((sendRow) => {
      const email = String(sendRow.recipient_name || "").trim().toLowerCase();
      if (!email) {
        failed.push({ ...sendRow, failure_reason: "empty_recipient_name" });
        return;
      }

      const opens = openByEmail.get(email) || [];

      if (opens.length === 0) {
        matchStats.emailMismatch++;
        // LEFT JOIN: keep send with NULL open fields
        const openFields = Object.keys(openDf[0] || {}).filter(
          (k) => !["recipient_name", "sent_date"].includes(k)
        );
        const rowWithNulls = { ...sendRow };
        openFields.forEach((field) => {
          rowWithNulls[field] = null;
        });
        successful.push(rowWithNulls);
        return;
      }

      let matched = false;

      // Ensure dates are Date objects
      const sendDate = new Date(sendRow.sent_date);
      if (isNaN(sendDate.getTime())) {
        matchStats.noMatch++;
        const openFields = Object.keys(openDf[0] || {}).filter(
          (k) => !["recipient_name", "sent_date"].includes(k)
        );
        const rowWithNulls = { ...sendRow };
        openFields.forEach((field) => {
          rowWithNulls[field] = null;
        });
        successful.push(rowWithNulls);
        return;
      }

      // Try matching with 0-60 second increments
      for (let increment = 0; increment <= 60; increment++) {
        const searchTime = new Date(sendDate.getTime() + increment * 1000);

        const matches = opens.filter((o) => {
          const openTime = new Date(o.sent_date);
          if (isNaN(openTime.getTime())) return false;

          return (
            openTime.getFullYear() === searchTime.getFullYear() &&
            openTime.getMonth() === searchTime.getMonth() &&
            openTime.getDate() === searchTime.getDate() &&
            openTime.getHours() === searchTime.getHours() &&
            openTime.getMinutes() === searchTime.getMinutes() &&
            openTime.getSeconds() === searchTime.getSeconds()
          );
        });

        if (matches.length === 1) {
          successful.push({ ...sendRow, ...matches[0] });
          if (increment === 0) matchStats.exact++;
          else matchStats.withinWindow++;
          matched = true;
          break;
        } else if (matches.length > 1) {
          // Multiple matches: use first one
          successful.push({ ...sendRow, ...matches[0] });
          matchStats.withinWindow++;
          matched = true;
          break;
        }
      }

      if (!matched) {
        matchStats.noMatch++;
        // LEFT JOIN: keep send with NULL open fields
        const openFields = Object.keys(openDf[0] || {}).filter(
          (k) => !["recipient_name", "sent_date"].includes(k)
        );
        const rowWithNulls = { ...sendRow };
        openFields.forEach((field) => {
          rowWithNulls[field] = null;
        });
        successful.push(rowWithNulls);
      }
    });

    const matchRate = ((matchStats.exact + matchStats.withinWindow) / sendDf.length * 100).toFixed(1);
    logger.info(
      `Send-Open join complete: ${matchStats.exact} exact matches, ${matchStats.withinWindow} within 60s, ${matchStats.emailMismatch} email mismatch, ${matchStats.noMatch} no match | Match rate: ${matchRate}%`
    );

    return { successful, failed };
  }

  /**
   * Join with contacts
   */
  _joinWithContacts(sendOpenDf, contactsDf) {
    logger.info(
      `Joining ${sendOpenDf.length} send-open records with contacts`
    );

    const contactsLookup = new Map();
    contactsDf.forEach((contact) => {
      const email = contact.Email;
      if (email && !contactsLookup.has(email)) {
        contactsLookup.set(email, contact);
      }
    });

    logger.info(`Created contacts lookup with ${contactsLookup.size} unique emails`);

    const successful = [];
    const failed = [];

    sendOpenDf.forEach((sendRecord) => {
      const recipientEmail = sendRecord["Recipient Email"];

      if (recipientEmail && contactsLookup.has(recipientEmail)) {
        const contact = contactsLookup.get(recipientEmail);
        successful.push({ ...sendRecord, ...contact });
      } else {
        failed.push({
          ...sendRecord,
          failure_reason: "Send email not found in contacts",
        });
      }
    });

    if (successful.length === 0) {
      return {
        successful: null,
        failed: null,
        error: "❌ No records matched with contacts sheet",
      };
    }

    logger.info(
      `Contacts join: ${successful.length} successful, ${failed.length} failed`
    );

    return { successful, failed, error: null };
  }
}

export default DataProcessor;