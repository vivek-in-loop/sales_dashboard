/**
 * Example usage of the Data Checker Script
 * 
 * This file demonstrates how to use the data validation checker
 * to verify that total send data from all SDRs is correct.
 */

import { 
  validateSdrSendData, 
  compareRawVsProcessed, 
  runDataValidation,
  formatValidationReport 
} from './dataChecker';

/**
 * Example 1: Basic validation of processed email data
 */
async function exampleBasicValidation(emailData) {
  const results = await validateSdrSendData(emailData);
  
  if (results.passed) {
    console.log('✅ All validations passed!');
    console.log('Summary:', results.summary);
  } else {
    console.error('❌ Validation failed!');
    console.error('Errors:', results.errors);
    console.warn('Warnings:', results.warnings);
  }
  
  return results;
}

/**
 * Example 2: Compare raw files with processed data
 */
async function exampleCompareRawVsProcessed(sdrConfigs, emailData) {
  const results = await compareRawVsProcessed(sdrConfigs, emailData);
  
  if (results.passed) {
    console.log('✅ Raw and processed data match!');
  } else {
    console.error('❌ Mismatch found!');
    console.error('Comparison:', results.comparison);
    console.error('Errors:', results.errors);
  }
  
  return results;
}

/**
 * Example 3: Run comprehensive validation
 */
async function exampleComprehensiveValidation(emailData, sdrConfigs) {
  const report = await runDataValidation(emailData, sdrConfigs);
  
  // Print formatted report
  console.log(formatValidationReport(report));
  
  // Check overall status
  if (report.overallPassed) {
    console.log('✅ All checks passed!');
  } else {
    console.error('❌ Some checks failed!');
    console.error('Total errors:', report.summary.totalErrors);
    console.error('Total warnings:', report.summary.totalWarnings);
  }
  
  return report;
}

/**
 * Example 4: Validate after processing
 */
async function exampleValidateAfterProcessing() {
  // After processing email data
  const emailData = {
    successful: [...], // processed successful records
    failed: [...],     // failed records
    stats: {
      total_send_records: 1000,
      send_open_success: 950,
      send_open_failed: 50,
      contact_join_success: 900,
    },
    sdrStats: [
      {
        name: 'SDR1',
        total_send_records: 500,
        matched: 475,
        failures: 25,
      },
      {
        name: 'SDR2',
        total_send_records: 500,
        matched: 475,
        failures: 25,
      },
    ],
  };
  
  const sdrConfigs = [
    { name: 'SDR1', sendCsv: '...', openCsv: '...' },
    { name: 'SDR2', sendCsv: '...', openCsv: '...' },
  ];
  
  // Run validation
  const report = await runDataValidation(emailData, sdrConfigs);
  
  // Check results
  if (report.overallPassed) {
    console.log('✅ Data is valid!');
  } else {
    console.error('❌ Data validation issues found:');
    report.checks.basicValidation?.errors.forEach(err => {
      console.error('  -', err);
    });
  }
  
  return report;
}

export {
  exampleBasicValidation,
  exampleCompareRawVsProcessed,
  exampleComprehensiveValidation,
  exampleValidateAfterProcessing,
};

