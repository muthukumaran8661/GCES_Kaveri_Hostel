/**
 * Normalization utilities for Department and Academic Year
 * Ensures strict, unambiguous matching across the GCES Hostel system.
 */

const DEPT_ALIASES = {
  'MECH': 'MECHANICAL',
  'MECHANICAL': 'MECHANICAL',
  'MECHANICAL ENGINEERING': 'MECHANICAL',
  'CSE': 'CSE',
  'CS': 'CSE',
  'COMPUTER SCIENCE': 'CSE',
  'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
  'COMPUTER SCIENCE & ENGINEERING': 'CSE',
  'ECE': 'ECE',
  'ELECTRONICS': 'ECE',
  'ELECTRONICS AND COMMUNICATION': 'ECE',
  'ELECTRONICS & COMMUNICATION': 'ECE',
  'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
  'ELECTRONICS & COMMUNICATION ENGINEERING': 'ECE',
  'EEE': 'EEE',
  'ELECTRICAL': 'EEE',
  'ELECTRICAL AND ELECTRONICS': 'EEE',
  'ELECTRICAL & ELECTRONICS': 'EEE',
  'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
  'ELECTRICAL & ELECTRONICS ENGINEERING': 'EEE',
  'CIVIL': 'CIVIL',
  'CIVIL ENGINEERING': 'CIVIL',
  'MECHATRONICS': 'MECHATRONICS',
  'MECHATRONICS ENGINEERING': 'MECHATRONICS',
  'MATHS': 'MATHS',
  'MATHEMATICS': 'MATHS',
  'PHYSICS': 'PHYSICS',
  'ENGLISH': 'ENGLISH',
  'CHEMISTRY': 'CHEMISTRY',
  'HOSTEL': 'HOSTEL ADMINISTRATION',
  'HOSTEL ADMIN': 'HOSTEL ADMINISTRATION',
  'HOSTEL ADMINISTRATION': 'HOSTEL ADMINISTRATION',
  'ALL': 'ALL DEPARTMENTS',
  'ALL DEPT': 'ALL DEPARTMENTS',
  'ALL DEPTS': 'ALL DEPARTMENTS',
  'ALL DEPARTMENTS': 'ALL DEPARTMENTS'
};

function normalizeDepartment(raw) {
  if (!raw) return '';
  const cleaned = String(raw).trim().toUpperCase();
  return DEPT_ALIASES[cleaned] || cleaned;
}

function normalizeYear(raw) {
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

function matchesDepartment(deptA, deptB) {
  const normA = normalizeDepartment(deptA);
  const normB = normalizeDepartment(deptB);
  if (!normA || !normB) return false;
  if (normA === 'ALL DEPARTMENTS' || normB === 'ALL DEPARTMENTS') return true;
  return normA === normB;
}

function matchesYear(assignedYear, studentYear) {
  const normAssigned = normalizeYear(assignedYear);
  const normStudent = normalizeYear(studentYear);
  if (normAssigned === 'All Years') return true;
  if (!normAssigned || !normStudent) return false;
  return normAssigned === normStudent;
}

/**
 * Finds matching active Faculty Advisors for a student's Department & Year.
 * Returns array of matches.
 */
function findMatchingFacultyAdvisors(allFaculty, studentDept, studentYear) {
  const normStudentDept = normalizeDepartment(studentDept);
  const normStudentYear = normalizeYear(studentYear);

  const activeFaculty = (allFaculty || []).filter(u => {
    const isInactive = u.status === 'inactive' || u.isActive === false;
    return !isInactive;
  });

  // Priority 1: Exact Department + Exact Year
  const p1 = activeFaculty.filter(f => {
    const fDept = normalizeDepartment(f.department);
    const fYear = normalizeYear(f.assignedYear || f.year);
    return fDept === normStudentDept && fYear === normStudentYear;
  });
  if (p1.length > 0) return p1;

  // Priority 2: Exact Department + All Years
  const p2 = activeFaculty.filter(f => {
    const fDept = normalizeDepartment(f.department);
    const fYear = normalizeYear(f.assignedYear || f.year);
    return fDept === normStudentDept && fYear === 'All Years';
  });
  if (p2.length > 0) return p2;

  return [];
}

/**
 * Finds matching active Wardens for a student's Department & Year with fallback priority:
 * 1. Exact Department + Exact Year
 * 2. Exact Department + All Years
 * 3. General Dept (Hostel Admin / All Depts / Empty) + Exact Year
 * 4. General Dept (Hostel Admin / All Depts / Empty) + All Years
 * 5. Exact Year across hostel
 * 6. All Years / General across hostel
 * 7. Any active Warden
 */
function findMatchingWardens(allWardens, studentDept, studentYear) {
  const normStudentDept = normalizeDepartment(studentDept);
  const normStudentYear = normalizeYear(studentYear);

  const activeWardens = (allWardens || []).filter(u => {
    const isInactive = u.status === 'inactive' || u.isActive === false;
    return !isInactive;
  });

  if (activeWardens.length === 0) return [];

  // 1. Exact Department + Exact Year
  const p1 = activeWardens.filter(w => {
    const wDept = normalizeDepartment(w.department);
    const wYear = normalizeYear(w.assignedYear || w.year);
    return wDept === normStudentDept && wYear === normStudentYear;
  });
  if (p1.length > 0) return p1;

  // 2. Exact Department + All Years
  const p2 = activeWardens.filter(w => {
    const wDept = normalizeDepartment(w.department);
    const wYear = normalizeYear(w.assignedYear || w.year);
    return wDept === normStudentDept && wYear === 'All Years';
  });
  if (p2.length > 0) return p2;

  // 3. General Dept (Hostel Admin / All Depts / Empty) + Exact Year
  const p3 = activeWardens.filter(w => {
    const wDept = normalizeDepartment(w.department);
    const wYear = normalizeYear(w.assignedYear || w.year);
    const isGeneralDept = !wDept || wDept === 'HOSTEL ADMINISTRATION' || wDept === 'ALL DEPARTMENTS';
    return isGeneralDept && wYear === normStudentYear;
  });
  if (p3.length > 0) return p3;

  // 4. General Dept (Hostel Admin / All Depts / Empty) + All Years
  const p4 = activeWardens.filter(w => {
    const wDept = normalizeDepartment(w.department);
    const wYear = normalizeYear(w.assignedYear || w.year);
    const isGeneralDept = !wDept || wDept === 'HOSTEL ADMINISTRATION' || wDept === 'ALL DEPARTMENTS';
    return isGeneralDept && wYear === 'All Years';
  });
  if (p4.length > 0) return p4;

  // 5. Any active Warden matching student's Year
  const p5 = activeWardens.filter(w => {
    const wYear = normalizeYear(w.assignedYear || w.year);
    return wYear === normStudentYear;
  });
  if (p5.length > 0) return p5;

  // 6. Any active Warden assigned to All Years
  const p6 = activeWardens.filter(w => {
    const wYear = normalizeYear(w.assignedYear || w.year);
    return wYear === 'All Years' || !wYear;
  });
  if (p6.length > 0) return p6;

  // 7. Fallback to any active Warden
  return activeWardens;
}

module.exports = {
  normalizeDepartment,
  normalizeYear,
  matchesDepartment,
  matchesYear,
  findMatchingFacultyAdvisors,
  findMatchingWardens,
  DEPT_ALIASES
};
