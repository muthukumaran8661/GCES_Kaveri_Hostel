/**
 * Normalization utilities for Department and Academic Year
 * Ensures strict, unambiguous matching across the GCES Hostel frontend.
 */

export const DEPT_ALIASES = {
  'MECH': 'MECHANICAL',
  'MECHANICAL': 'MECHANICAL',
  'CSE': 'CSE',
  'COMPUTER SCIENCE': 'CSE',
  'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
  'ECE': 'ECE',
  'ELECTRONICS AND COMMUNICATION': 'ECE',
  'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
  'EEE': 'EEE',
  'ELECTRICAL AND ELECTRONICS': 'EEE',
  'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
  'CIVIL': 'CIVIL',
  'CIVIL ENGINEERING': 'CIVIL',
  'MECHATRONICS': 'MECHATRONICS',
  'MECHATRONICS ENGINEERING': 'MECHATRONICS',
  'MATHS': 'MATHS',
  'MATHEMATICS': 'MATHS',
  'PHYSICS': 'PHYSICS',
  'ENGLISH': 'ENGLISH',
  'CHEMISTRY': 'CHEMISTRY',
  'HOSTEL ADMINISTRATION': 'HOSTEL ADMINISTRATION'
};

export function normalizeDepartment(raw) {
  if (!raw) return '';
  const cleaned = String(raw).trim().toUpperCase();
  return DEPT_ALIASES[cleaned] || cleaned;
}

export function normalizeYear(raw) {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();

  // All Years checks
  if (/^(all|all\s*years|all\s*year|year\s*all|any|every)$/i.test(s)) {
    return 'All Years';
  }

  // 1st / I Year checks
  if (/^(1|1st|i|year\s*1|year\s*1st|year\s*i|year-1|year-i)(\s*year)?$/i.test(s)) {
    return 'I Year';
  }
  // 2nd / II Year checks
  if (/^(2|2nd|ii|year\s*2|year\s*2nd|year\s*ii|year-2|year-ii)(\s*year)?$/i.test(s)) {
    return 'II Year';
  }
  // 3rd / III Year checks
  if (/^(3|3rd|iii|year\s*3|year\s*3rd|year\s*iii|year-3|year-iii)(\s*year)?$/i.test(s)) {
    return 'III Year';
  }
  // 4th / IV Year checks
  if (/^(4|4th|iv|year\s*4|year\s*4th|year\s*iv|year-4|year-iv)(\s*year)?$/i.test(s)) {
    return 'IV Year';
  }

  // Substring checks
  const upper = s.toUpperCase();
  if (upper.includes('ALL')) return 'All Years';
  if (upper.includes('IV YEAR') || upper.includes('4TH YEAR') || upper.includes('YEAR 4')) return 'IV Year';
  if (upper.includes('III YEAR') || upper.includes('3RD YEAR') || upper.includes('YEAR 3')) return 'III Year';
  if (upper.includes('II YEAR') || upper.includes('2ND YEAR') || upper.includes('YEAR 2')) return 'II Year';
  if (upper.includes('I YEAR') || upper.includes('1ST YEAR') || upper.includes('YEAR 1')) return 'I Year';

  return String(raw).trim();
}

export function matchesDepartment(deptA, deptB) {
  const normA = normalizeDepartment(deptA);
  const normB = normalizeDepartment(deptB);
  if (!normA || !normB) return false;
  return normA === normB;
}

export function matchesYear(assignedYear, studentYear) {
  const normAssigned = normalizeYear(assignedYear);
  const normStudent = normalizeYear(studentYear);
  if (normAssigned === 'All Years') return true;
  if (!normAssigned || !normStudent) return false;
  return normAssigned === normStudent;
}
