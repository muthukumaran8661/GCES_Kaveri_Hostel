import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import logo from './../assets/logo.png';

function getLogoBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Canvas toDataURL failed:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function normalizeYear(y) {
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

function formatStatus(status) {
  switch (status) {
    case 'pending_faculty': return 'Pending Faculty';
    case 'pending_staff': return 'Pending Warden';
    case 'notifying_parent': return 'Calling Parent';
    case 'approved_final': return 'Outpass Ready';
    case 'returned': return 'Returned Safe';
    case 'faculty_rejected': return 'Faculty Declined';
    case 'staff_rejected': return 'Warden Declined';
    case 'parent_rejected': return 'Parent Declined';
    default: return status || '—';
  }
}

function getStatusCategory(status) {
  if (['approved_final', 'returned'].includes(status)) return 'approved';
  if (['pending_faculty', 'pending_staff', 'notifying_parent'].includes(status)) return 'pending';
  if (['faculty_rejected', 'staff_rejected', 'parent_rejected'].includes(status)) return 'rejected';
  return 'other';
}

function getStatusBadgeStyle(status) {
  const cat = getStatusCategory(status);
  if (cat === 'approved') return { bg: '#E6F4EA', color: '#137333', border: '#CEEAD6' };
  if (cat === 'pending') return { bg: '#FEF7E0', color: '#B06000', border: '#FCE8B2' };
  if (cat === 'rejected') return { bg: '#FCE8E6', color: '#C5221F', border: '#FAD2CF' };
  return { bg: '#F1F3F4', color: '#3C4043', border: '#DADCE0' };
}

function getApprovalHistory(r) {
  const isWeekday = r.type === 'weekday';
  
  let facultyStatus = r.type === 'weekday_govt' ? 'N/A (Warden Approval)' : 'N/A (Weekend Pass)';
  let wardenStatus = 'Pending';
  let finalStatus = 'Pending Approval';
  let rejectionReason = r.rejectionReason || '';

  if (!rejectionReason && r.log && Array.isArray(r.log)) {
    const rejLog = r.log.find(l => l.toLowerCase().includes('declined') || l.toLowerCase().includes('rejected'));
    if (rejLog) rejectionReason = rejLog;
  }

  if (isWeekday) {
    if (r.status === 'pending_faculty') {
      facultyStatus = 'Pending';
      wardenStatus = 'Pending';
      finalStatus = 'Awaiting Faculty Advisor';
    } else if (r.status === 'faculty_rejected') {
      facultyStatus = 'Declined' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'N/A';
      finalStatus = 'Faculty Declined';
    } else if (r.status === 'pending_staff') {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'Pending';
      finalStatus = 'Awaiting Warden';
    } else if (r.status === 'staff_rejected') {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'Declined' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Warden Declined';
    } else if (r.status === 'notifying_parent') {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Calling Parent';
    } else if (r.status === 'parent_rejected') {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Parent Declined';
    } else if (r.status === 'approved_final') {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Approved — Out';
    } else if (r.status === 'returned') {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Returned Safe';
    }
  } else {
    facultyStatus = r.type === 'weekday_govt' ? 'N/A (Warden Approval)' : 'N/A (Weekend Pass)';
    if (r.status === 'pending_staff' || r.status === 'pending_faculty') {
      wardenStatus = 'Pending';
      finalStatus = 'Awaiting Warden';
    } else if (r.status === 'staff_rejected' || r.status === 'faculty_rejected') {
      wardenStatus = 'Declined' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Warden Declined';
    } else if (r.status === 'notifying_parent') {
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Calling Parent';
    } else if (r.status === 'parent_rejected') {
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Parent Declined';
    } else if (r.status === 'approved_final') {
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Approved — Out';
    } else if (r.status === 'returned') {
      wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
      finalStatus = 'Returned Safe';
    }
  }

  return { facultyStatus, wardenStatus, finalStatus, rejectionReason: rejectionReason || '—' };
}

export function exportRequestsToExcel(records) {
  const exportData = records.map((r, index) => {
    const history = getApprovalHistory(r);
    const reqDate = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '—';
    const parentMobileVal = r.parentPhone || r.parentMobile || '—';
    const actualOut = r.actualOutTime ? new Date(r.actualOutTime).toLocaleString('en-IN') : '—';
    const actualRet = r.actualReturnTime ? new Date(r.actualReturnTime).toLocaleString('en-IN') : '—';
    const lateVal = r.lateReturn ? `YES (${r.lateReturnDuration || 'Late'})` : 'NO';

    return {
      '#': index + 1,
      'Student Name': r.name || '—',
      'Register Number': r.reg || r.studentId || '—',
      'PARENT MOBILE': parentMobileVal,
      'Department': r.department || '—',
      'Year': normalizeYear(r.year),
      'Hostel / Room No.': r.room || '—',
      'Destination / Home Address': r.dest || '—',
      'Out Date & Time': r.fromDate || '—',
      'Expected Return': r.toDate || '—',
      'Actual Out Time': actualOut,
      'Actual Return Time': actualRet,
      'Late Return': lateVal,
      'QR Status': r.qrStatus || 'ACTIVE',
      'Successful Scans': `${r.scanCount || 0}/2`,
      'Invalid Scan Attempts': r.invalidScanAttemptsCount || 0,
      'Request Date': reqDate,
      'Request ID': r.requestId || r.id || '—',
      'Faculty Advisor Status': history.facultyStatus,
      'Warden Status': history.wardenStatus,
      'Final Status': history.finalStatus,
      'Rejection Reason (if applicable)': history.rejectionReason
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  worksheet['!cols'] = [
    { wch: 6 },   // #
    { wch: 22 },  // Student Name
    { wch: 18 },  // Register Number
    { wch: 18 },  // PARENT MOBILE
    { wch: 16 },  // Department
    { wch: 12 },  // Year
    { wch: 18 },  // Hostel / Room No.
    { wch: 32 },  // Destination / Home Address
    { wch: 20 },  // Out Date & Time
    { wch: 20 },  // Expected Return
    { wch: 22 },  // Actual Out Time
    { wch: 22 },  // Actual Return Time
    { wch: 16 },  // Late Return
    { wch: 14 },  // QR Status
    { wch: 16 },  // Successful Scans
    { wch: 20 },  // Invalid Scan Attempts
    { wch: 22 },  // Request Date
    { wch: 14 },  // Request ID
    { wch: 24 },  // Faculty Advisor Status
    { wch: 24 },  // Warden Status
    { wch: 24 },  // Final Status
    { wch: 30 }   // Rejection Reason
  ];

  worksheet['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, activePane: 'bottomLeft', topLeftCell: 'A2' }];

  if (exportData.length > 0) {
    worksheet['!autofilter'] = { ref: `A1:P${exportData.length + 1}` };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Out Pass Report');

  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = `GCES_Student_Outpass_Report_${todayStr}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export default function StudentRequestReport({ session, requests = [], onClose, onRefresh }) {
  const isFaculty = session && session.role === 'faculty';
  const facDept = session?.department || 'CSE';
  const facYear = session?.year ? normalizeYear(session.year) : 'All Years';

  const [filterDept, setFilterDept] = useState(isFaculty ? facDept : 'ALL');
  const [filterYear, setFilterYear] = useState(isFaculty ? (facYear === 'All Years' ? 'ALL' : facYear) : 'ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('detailed');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResultFilter, setAuditResultFilter] = useState('ALL');

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, auditResultFilter, searchQuery]);

  async function fetchAuditLogs() {
    try {
      setAuditLoading(true);
      const token = localStorage.getItem('gkof_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/qr/audit-logs?scanResult=${auditResultFilter}&searchQuery=${encodeURIComponent(searchQuery)}`, { headers });
      const data = await res.json();
      if (data && data.logs) {
        setAuditLogs(data.logs);
      }
    } catch (e) {
      console.error('Fetch audit logs error:', e);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (isFaculty) {
        if ((r.department || '').trim().toLowerCase() !== facDept.trim().toLowerCase()) return false;
      } else if (filterDept !== 'ALL') {
        if ((r.department || '').trim().toLowerCase() !== filterDept.trim().toLowerCase()) return false;
      }
      if (isFaculty && facYear !== 'All Years') {
        if (normalizeYear(r.year) !== facYear) return false;
      } else if (filterYear !== 'ALL') {
        if (normalizeYear(r.year) !== filterYear) return false;
      }
      if (filterStatus === 'APPROVED') {
        if (!['approved_final', 'returned'].includes(r.status)) return false;
      } else if (filterStatus === 'PENDING') {
        if (!['pending_faculty', 'pending_staff', 'notifying_parent'].includes(r.status)) return false;
      } else if (filterStatus === 'REJECTED') {
        if (!['faculty_rejected', 'staff_rejected', 'parent_rejected'].includes(r.status)) return false;
      } else if (filterStatus === 'RETURNED') {
        if (r.status !== 'returned') return false;
      }
      if (filterDate) {
        const fromD = r.fromDate || '';
        const createdD = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
        if (!fromD.includes(filterDate) && !createdD.includes(filterDate)) {
          return false;
        }
      }
      if (fromDateFilter || toDateFilter) {
        const reqDateStr = r.fromDate ? r.fromDate.split('T')[0] : (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '');
        if (fromDateFilter && reqDateStr < fromDateFilter) return false;
        if (toDateFilter && reqDateStr > toDateFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (r.name || '').toLowerCase().includes(q);
        const regMatch = (r.reg || r.studentId || '').toLowerCase().includes(q);
        const idMatch = (r.requestId || r.id || '').toLowerCase().includes(q);
        const destMatch = (r.dest || '').toLowerCase().includes(q);
        const parentPhoneMatch = (r.parentPhone || r.parentMobile || '').toLowerCase().includes(q);
        if (!nameMatch && !regMatch && !idMatch && !destMatch && !parentPhoneMatch) return false;
      }
      return true;
    });
  }, [requests, isFaculty, facDept, facYear, filterDept, filterYear, filterStatus, filterDate, fromDateFilter, toDateFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const approved = filteredRequests.filter(r => ['approved_final', 'returned'].includes(r.status)).length;
    const pending = filteredRequests.filter(r => ['pending_faculty', 'pending_staff', 'notifying_parent'].includes(r.status)).length;
    const rejected = filteredRequests.filter(r => ['faculty_rejected', 'staff_rejected', 'parent_rejected'].includes(r.status)).length;
    return { total, approved, pending, rejected };
  }, [filteredRequests]);

  const studentWiseStats = useMemo(() => {
    const map = new Map();
    filteredRequests.forEach((r) => {
      const regKey = (r.reg || r.studentId || r.name || 'UNKNOWN').trim().toUpperCase();
      if (!map.has(regKey)) {
        map.set(regKey, {
          name: r.name || 'N/A',
          reg: r.reg || r.studentId || '—',
          phone: r.parentPhone || r.parentMobile || '—',
          department: r.department || '—',
          year: normalizeYear(r.year),
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0
        });
      }
      const item = map.get(regKey);
      if (item.phone === '—' && (r.parentPhone || r.parentMobile)) {
        item.phone = r.parentPhone || r.parentMobile;
      }
      item.total += 1;
      const cat = getStatusCategory(r.status);
      if (cat === 'approved') item.approved += 1;
      else if (cat === 'pending') item.pending += 1;
      else if (cat === 'rejected') item.rejected += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRequests]);

  const totalStudents = studentWiseStats.length;

  async function generatePDF() {
    try {
      setIsGeneratingPDF(true);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const maroon = [158, 27, 50];
      const gold = [217, 164, 65];
      const ink = [42, 33, 64];
      const inkSoft = [100, 100, 115];
      const logoData = await getLogoBase64(logo);
      function drawHeader(pageNum) {
        doc.setFillColor(...maroon);
        doc.rect(0, 0, pageW, 72, 'F');
        let textX = 35;
        if (logoData) {
          doc.setFillColor(255, 255, 255);
          doc.circle(50, 36, 22, 'F');
          doc.addImage(logoData, 'PNG', 32, 18, 36, 36);
          textX = 82;
        }
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Government College of Engineering, Srirangam', textX, 30);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(243, 220, 166);
        doc.text('GCES Kaveri Girls Hostel — Report', textX, 47);
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`Official Document | Page ${pageNum}`, pageW - 35, 30, { align: 'right' });
      }
      let currentPage = 1;
      drawHeader(currentPage);
      let y = 90;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...ink);
      doc.text('Report', 35, y);
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...inkSoft);
      doc.text(`Generated: ${nowStr}`, pageW - 35, y, { align: 'right' });
      y += 16;
      const deptLabel = isFaculty ? facDept : (filterDept === 'ALL' ? 'All Depts' : filterDept);
      const yearLabel = isFaculty ? facYear : (filterYear === 'ALL' ? 'All Years' : filterYear);
      const statusLabel = filterStatus === 'ALL' ? 'All Statuses' : filterStatus;
      const dateLabel = filterDate ? filterDate : 'All Dates';
      doc.setFontSize(8.5);
      doc.setTextColor(...inkSoft);
      doc.text(`Filters: Dept: ${deptLabel} | Year: ${yearLabel} | Status: ${statusLabel} | Date: ${dateLabel}`, 35, y);
      y += 18;
      doc.setFillColor(250, 248, 242);
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.8);
      doc.roundedRect(35, y, pageW - 70, 36, 4, 4, 'FD');
      const colW = (pageW - 70) / 5;
      const boxY = y + 22;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(42, 33, 64);
      doc.text(`Total Students: ${totalStudents}`, 35 + colW * 0.5, boxY, { align: 'center' });
      doc.text(`Total Requests: ${stats.total}`, 35 + colW * 1.5, boxY, { align: 'center' });
      doc.setTextColor(19, 115, 51);
      doc.text(`Approved: ${stats.approved}`, 35 + colW * 2.5, boxY, { align: 'center' });
      doc.setTextColor(176, 96, 0);
      doc.text(`Pending: ${stats.pending}`, 35 + colW * 3.5, boxY, { align: 'center' });
      doc.setTextColor(197, 34, 31);
      doc.text(`Rejected: ${stats.rejected}`, 35 + colW * 4.5, boxY, { align: 'center' });
      y += 50;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...ink);
      doc.text('Detailed Student Out Pass Request & Approval Records', 35, y);
      y += 14;
      const logHeaders = [
        { name: '#', width: 20 },
        { name: 'Student Name & Reg No.', width: 95 },
        { name: 'PARENT MOBILE', width: 70 },
        { name: 'Dept / Year', width: 60 },
        { name: 'Out Time', width: 75 },
        { name: 'Return Time', width: 75 },
        { name: 'Destination', width: 75 },
        { name: 'Status', width: 55 }
      ];
      function drawLogTableHeader(curY) {
        doc.setFillColor(42, 33, 64);
        doc.rect(35, curY, pageW - 70, 20, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        let x = 40;
        logHeaders.forEach(h => {
          doc.text(h.name, x, curY + 13);
          x += h.width;
        });
        return curY + 20;
      }
      y = drawLogTableHeader(y);
      if (filteredRequests.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...inkSoft);
        doc.text('No student request records match the selected criteria.', 35 + (pageW - 70) / 2, y + 25, { align: 'center' });
      } else {
        filteredRequests.forEach((r, idx) => {
          const nameReg = `${r.name || 'N/A'}\nReg: ${r.reg || '—'}`;
          const phoneStr = r.parentPhone || r.parentMobile || '—';
          const deptYr = `${r.department || '—'}\n${normalizeYear(r.year)}`;
          const outTime = r.fromDate || '—';
          const retTime = r.toDate || '—';
          const destReason = `${r.dest || '—'}${r.reason ? ` (${r.reason})` : ''}`;
          const statusText = formatStatus(r.status);
          const linesName = doc.splitTextToSize(nameReg, logHeaders[1].width - 6);
          const linesDest = doc.splitTextToSize(destReason, logHeaders[6].width - 6);
          const linesOut = doc.splitTextToSize(outTime, logHeaders[4].width - 6);
          const linesRet = doc.splitTextToSize(retTime, logHeaders[5].width - 6);
          const maxLines = Math.max(linesName.length, linesDest.length, linesOut.length, linesRet.length, 1);
          const rowH = Math.max(22, maxLines * 11 + 8);
          if (y + rowH > pageH - 45) {
            currentPage++;
            doc.addPage();
            drawHeader(currentPage);
            y = 85;
            y = drawLogTableHeader(y);
          }
          if (idx % 2 === 1) {
            doc.setFillColor(248, 246, 240);
            doc.rect(35, y, pageW - 70, rowH, 'F');
          }
          doc.setDrawColor(230, 226, 215);
          doc.setLineWidth(0.5);
          doc.line(35, y + rowH, pageW - 35, y + rowH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...ink);
          let curX = 40;
          doc.text(String(idx + 1), curX, y + 13); curX += logHeaders[0].width;
          doc.text(linesName, curX, y + 11); curX += logHeaders[1].width;
          doc.text(phoneStr, curX, y + 11); curX += logHeaders[2].width;
          const linesDept = doc.splitTextToSize(deptYr, logHeaders[3].width - 6);
          doc.text(linesDept, curX, y + 11); curX += logHeaders[3].width;
          doc.text(linesOut, curX, y + 11); curX += logHeaders[4].width;
          doc.text(linesRet, curX, y + 11); curX += logHeaders[5].width;
          doc.text(linesDest, curX, y + 11); curX += logHeaders[6].width;
          const badgeCat = getStatusCategory(r.status);
          if (badgeCat === 'approved') doc.setTextColor(19, 115, 51);
          else if (badgeCat === 'pending') doc.setTextColor(176, 96, 0);
          else if (badgeCat === 'rejected') doc.setTextColor(197, 34, 31);
          else doc.setTextColor(60, 64, 67);
          doc.setFont('helvetica', 'bold');
          const linesStatus = doc.splitTextToSize(statusText, logHeaders[7].width - 4);
          doc.text(linesStatus, curX, y + 11);
          y += rowH;
        });
      }
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(217, 164, 65);
        doc.setLineWidth(0.8);
        doc.line(35, pageH - 32, pageW - 35, pageH - 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 130);
        doc.text('Government College of Engineering, Srirangam — Kaveri Girls Hostel Management System', 35, pageH - 18);
        doc.text(`Page ${p} of ${totalPages}`, pageW - 35, pageH - 18, { align: 'right' });
      }
      doc.save(`Student_OutPass_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleExportExcel = () => {
    exportRequestsToExcel(filteredRequests);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden touch-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="fixed top-2 left-1/2 -translate-x-1/2 w-[calc(100vw-16px)] max-w-[100vw] h-[calc(100vh-16px)] max-h-[calc(100vh-16px)] md:relative md:top-auto md:left-auto md:translate-x-0 md:w-full md:max-w-6xl md:h-[92vh] md:max-h-[92vh] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-[var(--gold-soft)] overflow-hidden flex flex-col text-slate-800 m-0"
      >
        {/* SECTION 1: Modal Fixed Header */}
        <div className="bg-[#9E1B32] text-white p-3.5 sm:p-4 px-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0 relative border-b border-rose-900/30">
          <div className="flex items-start justify-between w-full md:w-auto">
            <div className="flex items-center gap-2.5 sm:gap-3 pr-2">
              <span className="text-xl sm:text-2xl flex-shrink-0">📊</span>
              <div>
                <h2 className="font-serif text-base sm:text-lg font-bold leading-tight">Report</h2>
                <p className="hidden md:block text-xs text-[var(--gold-soft)] opacity-90">
                  {isFaculty
                    ? `Authorized Scope: ${facDept} - ${facYear} Faculty Advisor`
                    : 'Hostel Out Pass Portal — View, filter and export student out pass request and approval data'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg leading-none transition-colors cursor-pointer flex-shrink-0 -mr-1 -mt-1"
              aria-label="Close Modal"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 md:flex-none min-h-[34px] whitespace-nowrap"
            >
              <span>📊</span> <span>Export Excel</span>
            </button>
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 md:flex-none min-h-[34px] whitespace-nowrap"
            >
              <span>📥</span> <span>PDF</span>
            </button>
            <button
              onClick={onClose}
              className="hidden md:flex p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg leading-none transition-colors cursor-pointer items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SECTION 2: ONLY THIS SCROLLS (flex-1 min-h-0 overflow-y-auto) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 px-3 sm:px-6 pb-8 flex flex-col gap-3.5"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          {/* Filters Bar */}
          <div className="p-3 sm:p-3.5 px-4 sm:px-6 bg-[var(--cream-soft)] border border-[var(--line)] rounded-xl flex flex-col gap-2.5 sm:gap-3 text-xs shadow-xs">
            <div className="grid grid-cols-1 md:flex md:flex-wrap md:items-center gap-2.5 sm:gap-3 text-xs">
              {isFaculty ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg font-medium w-full md:w-auto">
                  <span>🔒 Scope Locked:</span>
                  <b>{facDept} ({facYear})</b>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:w-auto">
                    <label className="font-semibold text-gray-700 text-xs">Department</label>
                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full md:w-auto px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border">
                      <option value="ALL">All Departments</option>
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="EEE">EEE</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Civil">Civil</option>
                      <option value="Mechatronics">Mechatronics</option>
                      <option value="Chemistry">Chemistry</option>
                    </select>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:w-auto">
                    <label className="font-semibold text-gray-700 text-xs">Year</label>
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full md:w-auto px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border">
                      <option value="ALL">All Years</option>
                      <option value="I Year">I Year</option>
                      <option value="II Year">II Year</option>
                      <option value="III Year">III Year</option>
                      <option value="IV Year">IV Year</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:w-auto">
                <label className="font-semibold text-gray-700 text-xs">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full md:w-auto px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border">
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved / Out</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="RETURNED">Returned</option>
                </select>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:w-auto">
                <label className="font-semibold text-gray-700 text-xs">Date</label>
                <div className="flex items-center gap-1.5 w-full md:w-auto">
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full md:w-auto px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border" />
                  {filterDate && <button onClick={() => setFilterDate('')} className="text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer">✕</button>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:flex md:flex-wrap md:items-center gap-2.5 sm:gap-3 text-xs">
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:w-auto">
                <label className="font-semibold text-gray-700 text-xs">From Date</label>
                <input type="date" value={fromDateFilter} onChange={e => setFromDateFilter(e.target.value)} className="w-full md:w-auto px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:w-auto">
                <label className="font-semibold text-gray-700 text-xs">To Date</label>
                <div className="flex items-center gap-1.5 w-full md:w-auto">
                  <input type="date" value={toDateFilter} onChange={e => setToDateFilter(e.target.value)} className="w-full md:w-auto px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border" />
                  {(fromDateFilter || toDateFilter) && <button onClick={() => { setFromDateFilter(''); setToDateFilter(''); }} className="text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer">✕</button>}
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 w-full md:flex-1 md:min-w-[220px]">
                <label className="font-semibold text-gray-700 text-xs">Search</label>
                <div className="relative w-full flex items-center">
                  <input
                    type="text"
                    placeholder="Search Name, Reg No, Parent Mob..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none box-border pr-7"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
                      title="Clear Search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5 Summary Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3 bg-white">
            <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-center shadow-xs">
              <div className="text-lg sm:text-xl font-bold text-indigo-800">{totalStudents}</div>
              <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mt-0.5">Total Students</div>
            </div>
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-center shadow-xs">
              <div className="text-lg sm:text-xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Total Requests</div>
            </div>
            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-center shadow-xs">
              <div className="text-lg sm:text-xl font-bold text-emerald-700">{stats.approved}</div>
              <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Approved</div>
            </div>
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-center shadow-xs">
              <div className="text-lg sm:text-xl font-bold text-amber-700">{stats.pending}</div>
              <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">Pending</div>
            </div>
            <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl text-center shadow-xs col-span-2 md:col-span-1">
              <div className="text-lg sm:text-xl font-bold text-rose-700">{stats.rejected}</div>
              <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider mt-0.5">Rejected</div>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="border-b border-gray-200 bg-gray-50/50 rounded-t-xl px-4 sm:px-6 flex flex-wrap gap-2 sm:gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('detailed')}
              className={`py-2 sm:py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs whitespace-nowrap ${activeTab === 'detailed' ? 'border-[var(--maroon)] text-[var(--maroon)] font-bold' : 'border-transparent text-gray-500'}`}
            >
              <span>📋</span> Detailed Approval Report ({filteredRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-2 sm:py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs whitespace-nowrap ${activeTab === 'summary' ? 'border-[var(--maroon)] text-[var(--maroon)] font-bold' : 'border-transparent text-gray-500'}`}
            >
              <span>👥</span> Student Summary ({studentWiseStats.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-2 sm:py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs whitespace-nowrap ${activeTab === 'audit' ? 'border-[var(--maroon)] text-[var(--maroon)] font-bold' : 'border-transparent text-gray-500'}`}
            >
              <span>🔍</span> QR Scan Audit Log ({auditLogs.length})
            </button>
          </div>

          {/* Main Content Area */}
          <div className="overflow-x-hidden max-w-full">
            {activeTab === 'detailed' ? (
              filteredRequests.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <span className="text-3xl block mb-2">📋</span>
                  <p className="font-semibold text-sm">No student out pass request records match your filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-w-full">
                  <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
                    <thead>
                      <tr className="bg-[#2A2140] text-white font-serif uppercase tracking-wider text-[10px]">
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Student Name</th>
                        <th className="p-2.5">Register No.</th>
                        <th className="p-2.5">PARENT MOBILE</th>
                        <th className="p-2.5">Dept</th>
                        <th className="p-2.5">Year</th>
                        <th className="p-2.5">Room</th>
                        <th className="p-2.5">Destination / Address</th>
                        <th className="p-2.5">Out Time</th>
                        <th className="p-2.5">Expected Return</th>
                        <th className="p-2.5">Request ID</th>
                        <th className="p-2.5">Faculty Status</th>
                        <th className="p-2.5">Warden Status</th>
                        <th className="p-2.5">Final Status</th>
                        <th className="p-2.5">Rejection Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredRequests.map((r, i) => {
                        const bStyle = getStatusBadgeStyle(r.status);
                        const history = getApprovalHistory(r);
                        const parentMobileVal = r.parentPhone || r.parentMobile || '—';
                        return (
                          <tr key={r.requestId || r.id || r._id || i} className="hover:bg-amber-50/40 transition-colors">
                            <td className="p-2.5 font-semibold text-gray-400">{i + 1}</td>
                            <td className="p-2.5 font-bold text-gray-900">{r.name || '—'}</td>
                            <td className="p-2.5 font-mono text-gray-600">{r.reg || '—'}</td>
                            <td className="p-2.5 text-gray-900 font-mono font-semibold">{parentMobileVal}</td>
                            <td className="p-2.5 text-gray-700">{r.department || '—'}</td>
                            <td className="p-2.5 text-gray-700 font-semibold">{normalizeYear(r.year)}</td>
                            <td className="p-2.5 text-gray-700">{r.room || '—'}</td>
                            <td className="p-2.5 text-gray-700 max-w-[180px] truncate" title={r.dest}>{r.dest || '—'}</td>
                            <td className="p-2.5 text-gray-600 whitespace-nowrap">{r.fromDate || '—'}</td>
                            <td className="p-2.5 text-gray-600 whitespace-nowrap">{r.toDate || '—'}</td>
                            <td className="p-2.5 font-mono text-xs font-semibold text-indigo-700">{r.requestId || r.id || '—'}</td>
                            <td className="p-2.5 text-gray-700 font-medium">{history.facultyStatus}</td>
                            <td className="p-2.5 text-gray-700 font-medium">{history.wardenStatus}</td>
                            <td className="p-2.5">
                              <span
                                className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                                style={{ backgroundColor: bStyle.bg, color: bStyle.color, borderColor: bStyle.border }}
                              >
                                {formatStatus(r.status)}
                              </span>
                            </td>
                            <td className="p-2.5 text-rose-700 text-[11px] max-w-[160px] truncate" title={history.rejectionReason}>
                              {history.rejectionReason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeTab === 'summary' ? (
              /* Tab 2: Student-Wise Aggregated Statistics Table */
              studentWiseStats.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <span className="text-3xl block mb-2">🎓</span>
                  <p className="font-semibold text-sm">No student statistics match your selected filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-w-full">
                  <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-[#2A2140] text-white font-serif uppercase tracking-wider text-[10.5px]">
                        <th className="p-3">#</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Register Number</th>
                        <th className="p-3">PARENT MOBILE</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Year</th>
                        <th className="p-3 text-center">Total Requests</th>
                        <th className="p-3 text-center">Approved</th>
                        <th className="p-3 text-center">Pending</th>
                        <th className="p-3 text-center">Rejected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {studentWiseStats.map((st, i) => (
                        <tr key={st.reg + i} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-3 font-semibold text-gray-400">{i + 1}</td>
                          <td className="p-3 font-bold text-gray-900">{st.name}</td>
                          <td className="p-3 font-mono text-gray-600">{st.reg}</td>
                          <td className="p-3 text-gray-900 font-mono font-semibold">{st.phone || '—'}</td>
                          <td className="p-3 text-gray-700">{st.department}</td>
                          <td className="p-3 text-gray-700 font-semibold">{st.year}</td>
                          <td className="p-3 text-center font-bold text-gray-800 bg-gray-50">{st.total}</td>
                          <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">{st.approved}</td>
                          <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/50">{st.pending}</td>
                          <td className="p-3 text-center font-bold text-rose-700 bg-rose-50/50">{st.rejected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* Tab 3: QR Scan Audit Log Table */
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-gray-700">Filter Result:</label>
                    <select
                      value={auditResultFilter}
                      onChange={e => setAuditResultFilter(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-medium outline-none"
                    >
                      <option value="ALL">All Results</option>
                      <option value="VALID_OUT">VALID OUT</option>
                      <option value="VALID_BACK">VALID BACK</option>
                      <option value="INVALID_ALREADY_USED">INVALID ALREADY USED</option>
                      <option value="INVALID_TOKEN">INVALID TOKEN</option>
                      <option value="INVALID_STATUS">INVALID STATUS</option>
                    </select>
                  </div>
                  <button
                    onClick={fetchAuditLogs}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                  >
                    🔄 Refresh Audit Logs
                  </button>
                </div>

                {auditLoading ? (
                  <div className="py-12 text-center text-gray-500">Loading QR Scan Audit Logs…</div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <span className="text-3xl block mb-2">🔍</span>
                    <p className="font-semibold text-sm">No QR scan audit log entries recorded yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-w-full">
                    <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-[#2A2140] text-white font-serif uppercase tracking-wider text-[10.5px]">
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Scan Timestamp</th>
                          <th className="p-2.5">Scan Result</th>
                          <th className="p-2.5">Action Attempted</th>
                          <th className="p-2.5">Student Name &amp; Reg</th>
                          <th className="p-2.5">Scanned By (Role)</th>
                          <th className="p-2.5">Request ID</th>
                          <th className="p-2.5">Prev Status</th>
                          <th className="p-2.5">Details / Failure Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {auditLogs.map((log, i) => {
                          const isSuccess = log.scanResult === 'VALID_OUT' || log.scanResult === 'VALID_BACK';
                          return (
                            <tr key={log._id || i} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-semibold text-gray-400">{i + 1}</td>
                              <td className="p-2.5 font-mono text-gray-600 whitespace-nowrap">
                                {new Date(log.scanTimestamp).toLocaleString('en-IN')}
                              </td>
                              <td className="p-2.5">
                                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${isSuccess ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
                                  {log.scanResult}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-gray-800">{log.actionAttempted || 'VERIFY'}</td>
                              <td className="p-2.5">
                                <b className="text-gray-900 block">{log.studentName || '—'}</b>
                                <span className="font-mono text-gray-500 text-[11px]">{log.regNumber || log.studentId || '—'}</span>
                              </td>
                              <td className="p-2.5 font-medium text-gray-700">
                                {log.scannedBy || 'Gate Staff'} <span className="text-gray-400 font-mono text-[10px]">({log.scannerRole || 'staff'})</span>
                              </td>
                              <td className="p-2.5 font-mono text-indigo-700 font-semibold">{log.requestId || '—'}</td>
                              <td className="p-2.5 font-semibold text-gray-600">{log.previousQrStatus || 'NONE'}</td>
                              <td className="p-2.5 text-rose-700 text-[11px] max-w-[200px] truncate" title={log.failureReason || ''}>
                                {log.failureReason || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Modal Fixed Footer */}
        <div className="p-3 px-4 sm:px-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 flex-shrink-0 shadow-md">
          <div className="text-center sm:text-left text-[11px] sm:text-xs">
            Showing <b>{studentWiseStats.length}</b> unique students | <b>{filteredRequests.length}</b> out pass requests
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
            <button onClick={handleExportExcel} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-none min-h-[34px] text-xs">
              <span>📊</span> <span>Export Excel (.xlsx)</span>
            </button>
            <button onClick={onClose} className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 active:scale-95 text-gray-700 font-semibold rounded-lg transition-all cursor-pointer flex-1 sm:flex-none justify-center min-h-[34px] text-xs">
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
