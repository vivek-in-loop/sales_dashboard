/**
 * Data Validation Checker Script
 * Validates total send data from all SDRs and verifies data processing accuracy
 */

/**
 * Check if total send data from all SDRs is correct
 * @param {Object} emailData - Processed email data from emailProcessor
 * @param {Array} sdrConfigs - Original SDR configurations used for processing
 * @returns {Object} Validation results with pass/fail status and details
 */
export async function validateSdrSendData(emailData, sdrConfigs = []) {
  const results = {
    passed: true,
    errors: [],
    warnings: [],
    summary: {},
    details: {},
  };

  try {
    // 1. Validate emailData structure
    if (!emailData || !emailData.successful || !Array.isArray(emailData.successful)) {
      results.passed = false;
      results.errors.push("Invalid emailData structure: missing 'successful' array");
      return results;
    }

    // 2. Calculate total sends from processed data
    const processedTotalSends = emailData.successful.length;
    const processedFailed = emailData.failed?.length || 0;
    const processedTotalRecords = processedTotalSends + processedFailed;

    // 3. Calculate total sends from stats (if available)
    const statsTotalSends = emailData.stats?.total_send_records || 0;
    const statsSendOpenSuccess = emailData.stats?.send_open_success || 0;
    const statsSendOpenFailed = emailData.stats?.send_open_failed || 0;

    // 4. Validate stats consistency
    if (statsTotalSends > 0) {
      const statsCalculatedTotal = statsSendOpenSuccess + statsSendOpenFailed;
      if (statsTotalSends !== statsCalculatedTotal) {
        results.passed = false;
        results.errors.push(
          `Stats inconsistency: total_send_records (${statsTotalSends}) != send_open_success (${statsSendOpenSuccess}) + send_open_failed (${statsSendOpenFailed}) = ${statsCalculatedTotal}`
        );
      }
    }

    // 5. Validate processed data matches stats
    if (statsTotalSends > 0 && processedTotalRecords !== statsTotalSends) {
      results.passed = false;
      results.errors.push(
        `Data mismatch: Processed records (${processedTotalRecords}) != Stats total_send_records (${statsTotalSends})`
      );
    }

    // 6. Check SDR-specific data if sdrStats available
    if (emailData.sdrStats && Array.isArray(emailData.sdrStats)) {
      let sdrStatsTotalSends = 0;
      let sdrStatsMatched = 0;
      let sdrStatsFailed = 0;

      emailData.sdrStats.forEach((sdrStat) => {
        sdrStatsTotalSends += sdrStat.total_send_records || 0;
        sdrStatsMatched += sdrStat.matched || 0;
        sdrStatsFailed += sdrStat.failures || 0;
      });

      // Validate SDR stats sum matches overall stats
      if (statsTotalSends > 0 && sdrStatsTotalSends !== statsTotalSends) {
        results.passed = false;
        results.errors.push(
          `SDR stats sum mismatch: Sum of SDR total_send_records (${sdrStatsTotalSends}) != Overall total_send_records (${statsTotalSends})`
        );
      }

      if (statsSendOpenSuccess > 0 && sdrStatsMatched !== statsSendOpenSuccess) {
        results.passed = false;
        results.errors.push(
          `SDR matched sum mismatch: Sum of SDR matched (${sdrStatsMatched}) != Overall send_open_success (${statsSendOpenSuccess})`
        );
      }

      if (statsSendOpenFailed > 0 && sdrStatsFailed !== statsSendOpenFailed) {
        results.passed = false;
        results.errors.push(
          `SDR failures sum mismatch: Sum of SDR failures (${sdrStatsFailed}) != Overall send_open_failed (${statsSendOpenFailed})`
        );
      }

      // Store SDR breakdown
      results.details.sdrBreakdown = emailData.sdrStats.map((stat) => ({
        name: stat.name,
        total_send_records: stat.total_send_records,
        matched: stat.matched,
        failures: stat.failures,
        matchRate: stat.total_send_records > 0
          ? ((stat.matched / stat.total_send_records) * 100).toFixed(2) + "%"
          : "0%",
      }));
    }

    // 7. Validate unique recipient emails
    const uniqueRecipients = new Set(
      emailData.successful
        .map((r) => r["Recipient Email"] || r.Email)
        .filter(Boolean)
    ).size;

    // 8. Validate SDR_Name distribution
    const sdrDistribution = {};
    emailData.successful.forEach((row) => {
      const sdrName = row.SDR_Name || row["Account Owner"] || "Unassigned";
      sdrDistribution[sdrName] = (sdrDistribution[sdrName] || 0) + 1;
    });

    // 9. Check for data quality issues
    const recordsWithoutEmail = emailData.successful.filter(
      (r) => !r["Recipient Email"] && !r.Email
    ).length;

    if (recordsWithoutEmail > 0) {
      results.warnings.push(
        `${recordsWithoutEmail} records missing recipient email addresses`
      );
    }

    const recordsWithoutViews = emailData.successful.filter(
      (r) => !r.Views || r.Views === "" || Number(r.Views) === 0
    ).length;

    // 10. Build summary
    results.summary = {
      processedTotalSends,
      processedFailed,
      processedTotalRecords,
      statsTotalSends,
      statsSendOpenSuccess,
      statsSendOpenFailed,
      uniqueRecipients,
      recordsWithoutEmail,
      recordsWithoutViews,
      sdrCount: Object.keys(sdrDistribution).length,
      sdrDistribution,
    };

    // 11. Final validation check
    if (results.errors.length === 0) {
      results.passed = true;
      results.summary.status = "✅ All validations passed";
    } else {
      results.passed = false;
      results.summary.status = `❌ ${results.errors.length} validation error(s) found`;
    }

    return results;
  } catch (error) {
    results.passed = false;
    results.errors.push(`Validation error: ${error.message}`);
    return results;
  }
}

/**
 * Compare raw SDR files with processed data
 * @param {Array} sdrConfigs - SDR configurations with file references
 * @param {Object} emailData - Processed email data
 * @returns {Promise<Object>} Comparison results
 */
export async function compareRawVsProcessed(sdrConfigs, emailData) {
  const results = {
    passed: true,
    errors: [],
    warnings: [],
    comparison: {},
  };

  try {
    const Papa = (await import("papaparse")).default;

    let totalRawSends = 0;
    const sdrRawCounts = {};

    // Load and count raw send files
    for (const config of sdrConfigs) {
      try {
        const sendFile = config.sendCsv;
        let sendText;

        if (sendFile instanceof File) {
          sendText = await sendFile.text();
        } else if (typeof sendFile === "string") {
          sendText = sendFile;
        } else {
          continue;
        }

        const parsed = Papa.parse(sendText, {
          header: true,
          skipEmptyLines: true,
        });

        const sendRows = parsed.data || [];
        const sdrName = config.name || "Unknown";
        sdrRawCounts[sdrName] = sendRows.length;
        totalRawSends += sendRows.length;
      } catch (error) {
        results.warnings.push(
          `Could not read raw send file for ${config.name}: ${error.message}`
        );
      }
    }

    // Compare with processed data
    const processedTotal = emailData.successful.length + (emailData.failed?.length || 0);
    const statsTotal = emailData.stats?.total_send_records || 0;

    results.comparison = {
      totalRawSends,
      processedTotal,
      statsTotal,
      difference: totalRawSends - processedTotal,
      match: totalRawSends === processedTotal,
    };

    if (totalRawSends !== processedTotal) {
      results.passed = false;
      results.errors.push(
        `Raw sends (${totalRawSends}) != Processed total (${processedTotal}). Difference: ${totalRawSends - processedTotal}`
      );
    }

    if (statsTotal > 0 && totalRawSends !== statsTotal) {
      results.passed = false;
      results.errors.push(
        `Raw sends (${totalRawSends}) != Stats total (${statsTotal}). Difference: ${totalRawSends - statsTotal}`
      );
    }

    // Compare per-SDR if stats available
    if (emailData.sdrStats && Array.isArray(emailData.sdrStats)) {
      const sdrComparisons = {};
      emailData.sdrStats.forEach((stat) => {
        const rawCount = sdrRawCounts[stat.name] || 0;
        const processedCount = stat.total_send_records || 0;
        sdrComparisons[stat.name] = {
          raw: rawCount,
          processed: processedCount,
          match: rawCount === processedCount,
          difference: rawCount - processedCount,
        };

        if (rawCount !== processedCount) {
          results.passed = false;
          results.errors.push(
            `SDR ${stat.name}: Raw (${rawCount}) != Processed (${processedCount})`
          );
        }
      });
      results.comparison.sdrBreakdown = sdrComparisons;
    }

    return results;
  } catch (error) {
    results.passed = false;
    results.errors.push(`Comparison error: ${error.message}`);
    return results;
  }
}

/**
 * Comprehensive data validation checker
 * Runs all validation checks and returns detailed report
 * @param {Object} emailData - Processed email data
 * @param {Array} sdrConfigs - Original SDR configurations (optional)
 * @returns {Promise<Object>} Complete validation report
 */
export async function runDataValidation(emailData, sdrConfigs = []) {
  const report = {
    timestamp: new Date().toISOString(),
    overallPassed: true,
    checks: {},
    summary: {},
  };

  // Run basic validation
  const basicValidation = await validateSdrSendData(emailData, sdrConfigs);
  report.checks.basicValidation = basicValidation;
  report.overallPassed = report.overallPassed && basicValidation.passed;

  // Run comparison if SDR configs provided
  if (sdrConfigs && sdrConfigs.length > 0) {
    const comparison = await compareRawVsProcessed(sdrConfigs, emailData);
    report.checks.rawVsProcessed = comparison;
    report.overallPassed = report.overallPassed && comparison.passed;
  }

  // Build summary
  report.summary = {
    totalErrors: [
      ...(basicValidation.errors || []),
      ...(report.checks.rawVsProcessed?.errors || []),
    ].length,
    totalWarnings: [
      ...(basicValidation.warnings || []),
      ...(report.checks.rawVsProcessed?.warnings || []),
    ].length,
    status: report.overallPassed ? "✅ All checks passed" : "❌ Validation failed",
  };

  return report;
}

/**
 * Format validation report for console display
 * @param {Object} report - Validation report
 * @returns {string} Formatted report string
 */
export function formatValidationReport(report) {
  let output = "\n" + "=".repeat(60) + "\n";
  output += "DATA VALIDATION REPORT\n";
  output += "=".repeat(60) + "\n";
  output += `Timestamp: ${report.timestamp}\n`;
  output += `Overall Status: ${report.summary.status}\n\n`;

  // Basic Validation
  if (report.checks.basicValidation) {
    const check = report.checks.basicValidation;
    output += "BASIC VALIDATION:\n";
    output += `  Status: ${check.passed ? "✅ PASSED" : "❌ FAILED"}\n`;

    if (check.summary) {
      output += `  Total Sends (Processed): ${check.summary.processedTotalSends}\n`;
      output += `  Total Sends (Stats): ${check.summary.statsTotalSends}\n`;
      output += `  Unique Recipients: ${check.summary.uniqueRecipients}\n`;
      output += `  SDR Count: ${check.summary.sdrCount}\n`;
    }

    if (check.errors.length > 0) {
      output += `  Errors (${check.errors.length}):\n`;
      check.errors.forEach((err) => {
        output += `    - ${err}\n`;
      });
    }

    if (check.warnings.length > 0) {
      output += `  Warnings (${check.warnings.length}):\n`;
      check.warnings.forEach((warn) => {
        output += `    - ${warn}\n`;
      });
    }

    if (check.details.sdrBreakdown) {
      output += "\n  SDR Breakdown:\n";
      check.details.sdrBreakdown.forEach((sdr) => {
        output += `    ${sdr.name}: ${sdr.total_send_records} sends, ${sdr.matched} matched (${sdr.matchRate})\n`;
      });
    }
    output += "\n";
  }

  // Raw vs Processed Comparison
  if (report.checks.rawVsProcessed) {
    const check = report.checks.rawVsProcessed;
    output += "RAW VS PROCESSED COMPARISON:\n";
    output += `  Status: ${check.passed ? "✅ PASSED" : "❌ FAILED"}\n`;

    if (check.comparison) {
      output += `  Raw Total Sends: ${check.comparison.totalRawSends}\n`;
      output += `  Processed Total: ${check.comparison.processedTotal}\n`;
      output += `  Stats Total: ${check.comparison.statsTotal}\n`;
      output += `  Match: ${check.comparison.match ? "✅" : "❌"}\n`;
    }

    if (check.errors.length > 0) {
      output += `  Errors (${check.errors.length}):\n`;
      check.errors.forEach((err) => {
        output += `    - ${err}\n`;
      });
    }
    output += "\n";
  }

  output += "=".repeat(60) + "\n";
  return output;
}

