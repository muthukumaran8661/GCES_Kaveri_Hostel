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
  if (/^(1|1st|i)(\s*year)?$/i.test(s)) return 'I Year';
  if (/^(2|2nd|ii)(\s*year)?$/i.test(s)) return 'II Year';
  if (/^(3|3rd|iii)(\s*year)?$/i.test(s)) return 'III Year';
  if (/^(4|4th|iv)(\s*year)?$/i.test(s)) return 'IV Year';
  if (/^(all|all\s*years)$/i.test(s)) return 'All Years';
  
  const upper = s.toUpperCase();
  if (upper.includes('I YEAR') && !upper.includes('II') && !upper.includes('III')) return 'I Year';
  if (upper.includes('II YEAR')) return 'II Year';
  if (upper.includes('III YEAR')) return 'III Year';
  if (upper.includes('IV YEAR')) return 'IV Year';
  if (upper.includes('ALL')) return 'All Years';

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
