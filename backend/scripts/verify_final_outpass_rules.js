// Automated test for FINAL OUTPASS TIMING RULES
const assert = require('assert');

function validateOutPass(dayOfWeek, outMinutes, type) {
  const invalidTypeMessage = 'Selected outpass type is not valid for the selected date and time.';

  // 1. Weekend Out Pass (Warden Approval): Friday 4:31 PM (991 mins) → Friday 6:00 PM (1080 mins) ONLY
  if (type === 'weekend') {
    if (dayOfWeek !== 5 || outMinutes < 991 || outMinutes > 1080) {
      return { isValid: false, message: invalidTypeMessage };
    }
  }
  // 2. Weekday / Emergency Out Pass (Faculty & Warden Approval): Monday - Friday 6:00 AM (360 mins) → 4:30 PM (990 mins)
  else if (type === 'weekday') {
    if (dayOfWeek < 1 || dayOfWeek > 5 || outMinutes < 360 || outMinutes > 990) {
      return { isValid: false, message: invalidTypeMessage };
    }
  }
  // 3. Weekday / Government Holiday Out Pass (Warden Approval): Monday - Friday 6:00 AM (360 mins) → 6:00 PM (1080 mins)
  else if (type === 'weekday_govt') {
    if (dayOfWeek < 1 || dayOfWeek > 5 || outMinutes < 360 || outMinutes > 1080) {
      return { isValid: false, message: invalidTypeMessage };
    }
  } else {
    return { isValid: false, message: invalidTypeMessage };
  }

  return { isValid: true };
}

const tests = [
  // 1. WEEKEND OUT PASS
  { name: 'Friday 4:30 PM Weekend', day: 5, time: 16 * 60 + 30, type: 'weekend', expected: false },
  { name: 'Friday 4:31 PM Weekend', day: 5, time: 16 * 60 + 31, type: 'weekend', expected: true },
  { name: 'Friday 5:00 PM Weekend', day: 5, time: 17 * 60 + 0, type: 'weekend', expected: true },
  { name: 'Friday 6:00 PM Weekend', day: 5, time: 18 * 60 + 0, type: 'weekend', expected: true },
  { name: 'Friday 6:01 PM Weekend', day: 5, time: 18 * 60 + 1, type: 'weekend', expected: false },
  { name: 'Saturday 5:00 PM Weekend', day: 6, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Sunday 5:00 PM Weekend', day: 0, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Monday 5:00 PM Weekend', day: 1, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Tuesday 5:00 PM Weekend', day: 2, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Wednesday 5:00 PM Weekend', day: 3, time: 17 * 60 + 0, type: 'weekend', expected: false },
  { name: 'Thursday 5:00 PM Weekend', day: 4, time: 17 * 60 + 0, type: 'weekend', expected: false },

  // 2. WEEKDAY / EMERGENCY OUT PASS
  { name: 'Monday 5:59 AM Emergency', day: 1, time: 5 * 60 + 59, type: 'weekday', expected: false },
  { name: 'Monday 6:00 AM Emergency', day: 1, time: 6 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Monday 4:30 PM Emergency', day: 1, time: 16 * 60 + 30, type: 'weekday', expected: true },
  { name: 'Monday 4:31 PM Emergency', day: 1, time: 16 * 60 + 31, type: 'weekday', expected: false },
  { name: 'Tuesday 10:00 AM Emergency', day: 2, time: 10 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Wednesday 10:00 AM Emergency', day: 3, time: 10 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Thursday 10:00 AM Emergency', day: 4, time: 10 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Friday 6:00 AM Emergency', day: 5, time: 6 * 60 + 0, type: 'weekday', expected: true },
  { name: 'Friday 4:30 PM Emergency', day: 5, time: 16 * 60 + 30, type: 'weekday', expected: true },
  { name: 'Friday 4:31 PM Emergency', day: 5, time: 16 * 60 + 31, type: 'weekday', expected: false },
  { name: 'Saturday 10:00 AM Emergency', day: 6, time: 10 * 60 + 0, type: 'weekday', expected: false },
  { name: 'Sunday 10:00 AM Emergency', day: 0, time: 10 * 60 + 0, type: 'weekday', expected: false },

  // 3. WEEKDAY / GOVERNMENT HOLIDAY OUT PASS
  { name: 'Monday 5:59 AM Govt Holiday', day: 1, time: 5 * 60 + 59, type: 'weekday_govt', expected: false },
  { name: 'Monday 6:00 AM Govt Holiday', day: 1, time: 6 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Monday 4:31 PM Govt Holiday', day: 1, time: 16 * 60 + 31, type: 'weekday_govt', expected: true },
  { name: 'Monday 6:00 PM Govt Holiday', day: 1, time: 18 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Monday 6:01 PM Govt Holiday', day: 1, time: 18 * 60 + 1, type: 'weekday_govt', expected: false },
  { name: 'Tuesday 5:00 PM Govt Holiday', day: 2, time: 17 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Friday 6:00 AM Govt Holiday', day: 5, time: 6 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Friday 6:00 PM Govt Holiday', day: 5, time: 18 * 60 + 0, type: 'weekday_govt', expected: true },
  { name: 'Friday 6:01 PM Govt Holiday', day: 5, time: 18 * 60 + 1, type: 'weekday_govt', expected: false },
  { name: 'Saturday 10:00 AM Govt Holiday', day: 6, time: 10 * 60 + 0, type: 'weekday_govt', expected: false },
  { name: 'Sunday 10:00 AM Govt Holiday', day: 0, time: 10 * 60 + 0, type: 'weekday_govt', expected: false },
];

let failed = 0;
for (const t of tests) {
  const res = validateOutPass(t.day, t.time, t.type);
  if (res.isValid !== t.expected) {
    console.error(`FAILED: ${t.name} -> Expected ${t.expected}, Got ${res.isValid}`);
    failed++;
  } else {
    console.log(`PASSED: ${t.name} -> ${res.isValid ? 'VALID ✅' : 'INVALID ❌'}`);
  }
}

if (failed === 0) {
  console.log('\nAll 30 boundary tests PASSED successfully!');
} else {
  console.error(`\n${failed} test(s) FAILED!`);
  process.exit(1);
}
