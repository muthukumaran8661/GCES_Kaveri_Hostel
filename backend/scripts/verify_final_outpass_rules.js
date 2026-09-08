// Automated test for FINAL OUTPASS TIMING & REQUEST SUBMISSION RULES
const assert = require('assert');

// 1. SUBMISSION WINDOW VALIDATION
function validateSubmissionWindow(currentDay, currentMins) {
  if (currentDay < 1 || currentDay > 5 || currentMins < 570 || currentMins > 990) {
    return {
      isValid: false,
      message: 'Out Pass requests can be submitted only Monday to Friday between 9:30 AM and 4:30 PM.'
    };
  }
  return { isValid: true };
}

// 2. REQUEST TYPE + OUT DATE + OUT TIME VALIDATION
function validateOutPass(dayOfWeek, outMinutes, type) {
  const invalidTypeMessage = 'Selected outpass type is not valid for the selected date and time.';

  // 1. Weekend Out Pass: Friday 4:31 PM (991 mins) → Friday 6:30 PM (1110 mins) ONLY
  if (type === 'weekend') {
    if (dayOfWeek !== 5 || outMinutes < 991 || outMinutes > 1110) {
      return { isValid: false, message: invalidTypeMessage };
    }
  }
  // 2. Weekday / Emergency Out Pass: Monday - Friday 5:00 AM (300 mins) → 4:30 PM (990 mins)
  else if (type === 'weekday') {
    if (dayOfWeek < 1 || dayOfWeek > 5 || outMinutes < 300 || outMinutes > 990) {
      return { isValid: false, message: invalidTypeMessage };
    }
  }
  // 3. Weekday / Government Holiday Out Pass: Monday - Friday 5:00 AM (300 mins) → 6:30 PM (1110 mins)
  else if (type === 'weekday_govt') {
    if (dayOfWeek < 1 || dayOfWeek > 5 || outMinutes < 300 || outMinutes > 1110) {
      return { isValid: false, message: invalidTypeMessage };
    }
  } else {
    return { isValid: false, message: invalidTypeMessage };
  }

  return { isValid: true };
}

console.log('=== TESTING SUBMISSION WINDOW (Monday-Friday 9:30 AM → 4:30 PM) ===');
const windowTests = [
  { name: 'Monday 9:29 AM Submission', day: 1, time: 9 * 60 + 29, expected: false },
  { name: 'Monday 9:30 AM Submission', day: 1, time: 9 * 60 + 30, expected: true },
  { name: 'Tuesday 11:00 AM Submission', day: 2, time: 11 * 60 + 0, expected: true },
  { name: 'Wednesday 2:00 PM Submission', day: 3, time: 14 * 60 + 0, expected: true },
  { name: 'Thursday 4:30 PM Submission', day: 4, time: 16 * 60 + 30, expected: true },
  { name: 'Thursday 4:31 PM Submission', day: 4, time: 16 * 60 + 31, expected: false },
  { name: 'Friday 9:30 AM Submission', day: 5, time: 9 * 60 + 30, expected: true },
  { name: 'Friday 4:30 PM Submission', day: 5, time: 16 * 60 + 30, expected: true },
  { name: 'Friday 4:31 PM Submission', day: 5, time: 16 * 60 + 31, expected: false },
  { name: 'Saturday 11:00 AM Submission', day: 6, time: 11 * 60 + 0, expected: false },
  { name: 'Sunday 11:00 AM Submission', day: 0, time: 11 * 60 + 0, expected: false },
];

let failed = 0;
for (const t of windowTests) {
  const res = validateSubmissionWindow(t.day, t.time);
  if (res.isValid !== t.expected) {
    console.error(`FAILED: ${t.name} -> Expected ${t.expected}, Got ${res.isValid}`);
    failed++;
  } else {
    console.log(`PASSED: ${t.name} -> ${res.isValid ? 'VALID ✅' : 'INVALID ❌'}`);
  }
}

console.log('\n=== TESTING OUT DATE + OUT TIME + REQUEST TYPE ===');
const tests = [
  // 1. WEEKEND OUT PASS (Friday 4:31 PM → 6:30 PM)
  { name: 'Friday 4:30 PM Weekend', day: 5, time: 16 * 60 + 30, type: 'weekend', expected: false },
  { name: 'Friday 4:31 PM Weekend', day: 5, time: 16 * 60 + 31, type: 'weekend', expected: true },
  { name: 'Friday 5:00 PM Weekend', day: 5, time: 17 * 60 + 0, type: 'weekend', expected: true },
  { name: 'Friday 6:00 PM Weekend', day: 5, time: 18 * 60 + 0, type: 'weekend', expected: true },
  { name: 'Friday 6:30 PM Weekend', day: 5, time: 18 * 60 + 30, type: 'weekend', expected: true },
  { name: 'Friday 6:31 PM Weekend', day: 5, time: 18 * 60 + 31, type: 'weekend', expected: false },
  { name: 'Saturday 5:00 PM Weekend', day: 6, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Sunday 5:00 PM Weekend', day: 0, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Monday 5:00 PM Weekend', day: 1, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Tuesday 5:00 PM Weekend', day: 2, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Wednesday 5:00 PM Weekend', day: 3, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Thursday 5:00 PM Weekend', day: 4, time: 17 * 60 + 0, type: 'weekend', expected: false },

  // 2. WEEKDAY / EMERGENCY OUT PASS (Mon-Fri 5:00 AM → 4:30 PM)
  { name: 'Monday 4:59 AM Emergency', day: 1, time: 4 * 60 + 59, type: 'weekday', expected: false },
  { name: 'Monday 5:00 AM Emergency', day: 1, time: 5 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Monday 2:00 PM Emergency', day: 1, time: 14 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Monday 4:30 PM Emergency', day: 1, time: 16 * 60 + 30, type: 'weekday', expected: true },
  { name: 'Monday 4:31 PM Emergency', day: 1, time: 16 * 60 + 31, type: 'weekday', expected: false },
  { name: 'Tuesday 5:00 PM Emergency', day: 2, time: 17 * 60 + 0, type: 'weekday', expected: false },
  { name: 'Wednesday 10:00 AM Emergency', day: 3, time: 10 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Thursday 10:00 AM Emergency', day: 4, time: 10 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Friday 5:00 AM Emergency', day: 5, time: 5 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Friday 4:30 PM Emergency', day: 5, time: 16 * 60 + 30, type: 'weekday', expected: true },
  { name: 'Friday 4:31 PM Emergency', day: 5, time: 16 * 60 + 31, type: 'weekday', expected: false },
  { name: 'Saturday 10:00 AM Emergency', day: 6, time: 10 * 60 + 0, type: 'weekday', expected: false },
  { name: 'Sunday 10:00 AM Emergency', day: 0, time: 10 * 60 + 0, type: 'weekday', expected: false },

  // 3. WEEKDAY / GOVERNMENT HOLIDAY OUT PASS (Mon-Fri 5:00 AM → 6:30 PM)
  { name: 'Monday 4:59 AM Govt Holiday', day: 1, time: 4 * 60 + 59, type: 'weekday_govt', expected: false },
  { name: 'Monday 5:00 AM Govt Holiday', day: 1, time: 5 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Monday 5:00 PM Govt Holiday', day: 1, time: 17 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Monday 6:30 PM Govt Holiday', day: 1, time: 18 * 60 + 30, type: 'weekday_govt', expected: true },
  { name: 'Monday 6:31 PM Govt Holiday', day: 1, time: 18 * 60 + 31, type: 'weekday_govt', expected: false },
  { name: 'Tuesday 5:00 PM Govt Holiday', day: 2, time: 17 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Friday 5:00 AM Govt Holiday', day: 5, time: 5 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Friday 6:30 PM Govt Holiday', day: 5, time: 18 * 60 + 30, type: 'weekday_govt', expected: true },
  { name: 'Friday 6:31 PM Govt Holiday', day: 5, time: 18 * 60 + 31, type: 'weekday_govt', expected: false },
  { name: 'Saturday 10:00 AM Govt Holiday', day: 6, time: 10 * 60 + 0, type: 'weekday_govt', expected: false },
  { name: 'Sunday 10:00 AM Govt Holiday', day: 0, time: 10 * 60 + 0, type: 'weekday_govt', expected: false },
];

// 3. EXPECTED RETURN DATE & TIME VALIDATION
function getMaxReturnDateStr(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 7);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validateReturnDateTime(fromDatePart, fromTimePart, toDatePart, toTimePart) {
  const returnErrorMsg = 'Please select a valid return date and time. Return date must be within 7 days and return time must be between 5:00 AM and 6:30 PM.';

  const maxReturnDateStr = getMaxReturnDateStr(fromDatePart);

  // Return date cannot be before Out Date
  if (toDatePart < fromDatePart) {
    return { isValid: false, message: returnErrorMsg };
  }

  // Maximum return date is 7 days from Out Date
  if (toDatePart > maxReturnDateStr) {
    return { isValid: false, message: returnErrorMsg };
  }

  // Return time must be between 5:00 AM (05:00) and 6:30 PM (18:30)
  if (toTimePart < '05:00' || toTimePart > '18:30') {
    return { isValid: false, message: returnErrorMsg };
  }

  // Expected Return must be strictly after Out Date & Time
  const fromTimeMs = new Date(`${fromDatePart}T${fromTimePart}`).getTime();
  const toTimeMs = new Date(`${toDatePart}T${toTimePart}`).getTime();
  if (isNaN(fromTimeMs) || isNaN(toTimeMs) || toTimeMs <= fromTimeMs) {
    return { isValid: false, message: returnErrorMsg };
  }

  return { isValid: true };
}

for (const t of tests) {
  const res = validateOutPass(t.day, t.time, t.type);
  if (res.isValid !== t.expected) {
    console.error(`FAILED: ${t.name} -> Expected ${t.expected}, Got ${res.isValid}`);
    failed++;
  } else {
    console.log(`PASSED: ${t.name} -> ${res.isValid ? 'VALID ✅' : 'INVALID ❌'}`);
  }
}

console.log('\n=== TESTING EXPECTED RETURN DATE & TIME RULES ===');
// Assume Out Date = 2026-09-11 (Friday, 17:00 / 5:00 PM)
const returnTests = [
  // Before out date
  { name: 'Return before Out Date (2026-09-10)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-10', retTime: '18:00', expected: false },
  // Same day before out time
  { name: 'Same Day Return before Out Time', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-11', retTime: '16:30', expected: false },
  // Same day after out time within 6:30 PM
  { name: 'Same Day Return 6:00 PM (Friday)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-11', retTime: '18:00', expected: true },
  { name: 'Same Day Return 6:30 PM (Friday)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-11', retTime: '18:30', expected: true },
  { name: 'Same Day Return 6:31 PM (Friday)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-11', retTime: '18:31', expected: false },
  // Any day of the week allowed (Mon - Sun)
  { name: 'Return Saturday (1 day after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-12', retTime: '10:00', expected: true },
  { name: 'Return Sunday (2 days after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-13', retTime: '17:00', expected: true },
  { name: 'Return Monday (3 days after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-14', retTime: '09:00', expected: true },
  { name: 'Return Tuesday (4 days after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-15', retTime: '12:00', expected: true },
  { name: 'Return Wednesday (5 days after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-16', retTime: '15:00', expected: true },
  { name: 'Return Thursday (6 days after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-17', retTime: '16:00', expected: true },
  { name: 'Return Friday (Exactly 7 days after)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-18', retTime: '18:30', expected: true },
  { name: 'Return Saturday (8 days after - Exceeds 7 days)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-19', retTime: '10:00', expected: false },
  // Return time boundaries
  { name: 'Return Time 4:59 AM (Before 5:00 AM)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-14', retTime: '04:59', expected: false },
  { name: 'Return Time 5:00 AM (Valid)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-14', retTime: '05:00', expected: true },
  { name: 'Return Time 6:30 PM (Valid)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-14', retTime: '18:30', expected: true },
  { name: 'Return Time 6:31 PM (After 6:30 PM)', outDate: '2026-09-11', outTime: '17:00', retDate: '2026-09-14', retTime: '18:31', expected: false },
];

for (const t of returnTests) {
  const res = validateReturnDateTime(t.outDate, t.outTime, t.retDate, t.retTime);
  if (res.isValid !== t.expected) {
    console.error(`FAILED: ${t.name} -> Expected ${t.expected}, Got ${res.isValid}`);
    failed++;
  } else {
    console.log(`PASSED: ${t.name} -> ${res.isValid ? 'VALID ✅' : 'INVALID ❌'}`);
  }
}

if (failed === 0) {
  console.log(`\nAll ${windowTests.length + tests.length + returnTests.length} tests PASSED successfully!`);
} else {
  console.error(`\n${failed} test(s) FAILED!`);
  process.exit(1);
}
