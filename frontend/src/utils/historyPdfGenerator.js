import { jsPDF } from 'jspdf';
import logo from '../assets/logo.png';

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
  if (!y) return 'I Year';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

function fmtDateTime(d) {
  if (!d) return '—';
  if (typeof d === 'string' && d.includes('T')) {
    const parts = d.split('T');
    const dateParts = parts[0].split('-');
    const timeParts = parts[1].replace('Z', '').split(':');

    if (dateParts.length === 3 && timeParts.length >= 2) {
      const year = parseInt(dateParts[0], 10);
      const monthIdx = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const hour24 = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);

      if (!isNaN(year) && !isNaN(monthIdx) && !isNaN(day) && !isNaN(hour24) && !isNaN(minute)) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthStr = months[monthIdx] || dateParts[1];
        const dayStr = String(day).padStart(2, '0');

        const period = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const hourStr = String(hour12).padStart(2, '0');
        const minStr = String(minute).padStart(2, '0');

        return `${dayStr} ${monthStr} ${year}, ${hourStr}:${minStr} ${period}`;
      }
    }
  }

  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatRequestType(type) {
  if (type === 'weekday') return 'Weekday (Pass)';
  if (type === 'weekday_govt') return 'Govt Holiday';
  if (type === 'weekend') return 'Weekend Pass';
  return type || 'Outpass';
}

function getDetailedStatuses(r) {
  const isWeekday = r.type === 'weekday';

  let facultyStatus = r.type === 'weekday_govt' ? 'N/A (Warden)' : 'N/A (Weekend)';
  let wardenStatus = 'Pending';
  let parentStatus = 'Pending';
  let finalStatus = 'Pending';

  // 1. Faculty Advisor Status
  if (isWeekday) {
    if (r.status === 'pending_faculty') {
      facultyStatus = 'Pending';
    } else if (r.status === 'faculty_rejected') {
      facultyStatus = 'Declined' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
    } else {
      facultyStatus = 'Approved' + (r.facultyActionBy ? ` (${r.facultyActionBy})` : '');
    }
  }

  // 2. Warden Status
  if (r.status === 'pending_faculty') {
    wardenStatus = 'Awaiting Faculty';
  } else if (r.status === 'faculty_rejected') {
    wardenStatus = 'N/A (Declined)';
  } else if (r.status === 'pending_staff') {
    wardenStatus = 'Pending';
  } else if (r.status === 'staff_rejected') {
    wardenStatus = 'Declined' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
  } else {
    wardenStatus = 'Approved' + (r.wardenActionBy ? ` (${r.wardenActionBy})` : '');
  }

  // 3. Parent Status
  if (['pending_faculty', 'faculty_rejected', 'pending_staff', 'staff_rejected'].includes(r.status)) {
    parentStatus = 'Awaiting Approvals';
  } else if (r.status === 'notifying_parent') {
    parentStatus = 'Calling Parent';
  } else if (r.status === 'parent_rejected') {
    parentStatus = 'Declined';
  } else {
    parentStatus = 'Confirmed / OK';
  }

  // 4. Final Outpass Status
  if (r.status === 'approved_final') {
    finalStatus = r.qrStatus === 'OUT' ? 'Outpass Ready (OUT)' : 'Outpass Ready';
  } else if (r.status === 'returned') {
    finalStatus = 'Returned Safe';
  } else if (r.status === 'faculty_rejected') {
    finalStatus = 'Faculty Declined';
  } else if (r.status === 'staff_rejected') {
    finalStatus = 'Warden Declined';
  } else if (r.status === 'parent_rejected') {
    finalStatus = 'Parent Declined';
  } else if (r.status === 'pending_faculty') {
    finalStatus = 'Pending Faculty';
  } else if (r.status === 'pending_staff') {
    finalStatus = 'Pending Warden';
  } else if (r.status === 'notifying_parent') {
    finalStatus = 'Calling Parent';
  } else {
    finalStatus = r.status || 'Pending';
  }

  return { facultyStatus, wardenStatus, parentStatus, finalStatus };
}

/**
 * Generate and download PDF report of history records for Student, Faculty Advisor, or Warden.
 * 
 * @param {Object} options
 * @param {'student'|'faculty'|'warden'} options.role - Active user role
 * @param {Object} options.session - Active user session object
 * @param {Array} options.records - Array of outpass request records
 */
export async function generateHistoryPdf({ role, session, records = [] }) {
  try {
    // Landscape A4: width = 841.89 pt, height = 595.28 pt
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Theme color palette
    const maroon = [158, 27, 50];       // #9E1B32
    const gold = [217, 164, 65];        // #D9A441
    const ink = [42, 33, 64];           // #2A2140
    const inkSoft = [100, 100, 115];
    const borderGold = [217, 164, 65];

    // Determine Role Title
    let reportTitle = 'Student Outpass History';
    let filePrefix = 'Student_Outpass_History';

    if (role === 'faculty') {
      reportTitle = 'Faculty Advisor Approval History';
      filePrefix = 'Faculty_Advisor_Approval_History';
    } else if (role === 'warden' || role === 'staff') {
      reportTitle = 'Warden Outpass History';
      filePrefix = 'Warden_Outpass_History';
    }

    const logoData = await getLogoBase64(logo);

    const marginLeft = 28;
    const marginRight = 28;
    const usableWidth = pageW - marginLeft - marginRight; // 841.89 - 56 = 785.89 pt

    function drawHeader(pageNum) {
      // Maroon banner
      doc.setFillColor(...maroon);
      doc.rect(0, 0, pageW, 58, 'F');

      let textX = marginLeft;
      if (logoData) {
        doc.setFillColor(255, 255, 255);
        doc.circle(marginLeft + 18, 29, 20, 'F');
        doc.addImage(logoData, 'PNG', marginLeft + 2, 13, 32, 32);
        textX = marginLeft + 46;
      }

      // Title text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Government College of Engineering, Srirangam', textX, 24);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(243, 220, 166);
      doc.text('GCES Kaveri Girls Hostel Outpass System', textX, 40);

      // Top right banner label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(reportTitle, pageW - marginRight, 25, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(243, 220, 166);
      doc.text(`Official Record · Page ${pageNum}`, pageW - marginRight, 40, { align: 'right' });
    }

    let currentPage = 1;
    drawHeader(currentPage);

    let y = 72;

    // Subheader section: User & Generation Details
    const nowStr = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    let userInfoText = '';
    if (role === 'student') {
      const sName = session?.name || 'Student';
      const sReg = session?.reg || session?.username || '—';
      const sDept = session?.department || '—';
      const sYear = normalizeYear(session?.year);
      const sRoom = session?.room || '—';
      userInfoText = `Student: ${sName} | Reg No: ${sReg} | Dept & Year: ${sDept} (${sYear}) | Room: ${sRoom}`;
    } else if (role === 'faculty') {
      const fName = session?.name || session?.username || 'Faculty Advisor';
      const fDept = session?.department || 'CSE';
      const fYear = session?.year ? normalizeYear(session.year) : 'All Years';
      userInfoText = `Faculty Advisor: ${fName} | Dept Scope: ${fDept} | Year Scope: ${fYear}`;
    } else {
      const wName = session?.name || session?.username || 'Warden';
      const wScope = session?.year ? normalizeYear(session.year) : 'All Years';
      userInfoText = `Warden: ${wName} | Assigned Scope: ${wScope} Hostel Students`;
    }

    // Top Meta Strip
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(userInfoText, marginLeft, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...inkSoft);
    doc.text(`Generated: ${nowStr}`, pageW - marginRight, y, { align: 'right' });

    y += 12;

    // Summary Statistics Box
    const totalCount = records.length;
    const readyCount = records.filter(r => r.status === 'approved_final' || r.qrStatus === 'OUT').length;
    const returnedCount = records.filter(r => r.status === 'returned').length;
    const declinedCount = records.filter(r => ['faculty_rejected', 'staff_rejected', 'parent_rejected'].includes(r.status)).length;
    const pendingCount = totalCount - readyCount - returnedCount - declinedCount;

    doc.setFillColor(250, 248, 242);
    doc.setDrawColor(...borderGold);
    doc.setLineWidth(0.8);
    doc.roundedRect(marginLeft, y, usableWidth, 24, 3, 3, 'FD');

    const statColW = usableWidth / 5;
    const statTextY = y + 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);

    doc.setTextColor(42, 33, 64);
    doc.text(`Total Records: ${totalCount}`, marginLeft + statColW * 0.5, statTextY, { align: 'center' });

    doc.setTextColor(19, 115, 51);
    doc.text(`Outpass Ready: ${readyCount}`, marginLeft + statColW * 1.5, statTextY, { align: 'center' });

    doc.setTextColor(60, 64, 67);
    doc.text(`Returned Safe: ${returnedCount}`, marginLeft + statColW * 2.5, statTextY, { align: 'center' });

    doc.setTextColor(197, 34, 31);
    doc.text(`Declined: ${declinedCount}`, marginLeft + statColW * 3.5, statTextY, { align: 'center' });

    doc.setTextColor(176, 96, 0);
    doc.text(`Pending / In-Review: ${pendingCount > 0 ? pendingCount : 0}`, marginLeft + statColW * 4.5, statTextY, { align: 'center' });

    y += 34;

    // Table Column Definitions (Total = usableWidth = 785.89 pt)
    const tableColumns = [
      { id: 'idx', name: '#', width: 20 },
      { id: 'name', name: 'Student Name', width: 66 },
      { id: 'reg', name: 'Reg No.', width: 56 },
      { id: 'deptYear', name: 'Dept & Yr', width: 50 },
      { id: 'room', name: 'Room', width: 32 },
      { id: 'dest', name: 'Destination', width: 68 },
      { id: 'outTime', name: 'Out Date & Time', width: 68 },
      { id: 'retTime', name: 'Expected Return', width: 68 },
      { id: 'type', name: 'Type', width: 48 },
      { id: 'reason', name: 'Reason', width: 68 },
      { id: 'facStatus', name: 'Faculty Advisor', width: 65 },
      { id: 'wardenStatus', name: 'Warden Status', width: 65 },
      { id: 'parentStatus', name: 'Parent Status', width: 56 },
      { id: 'finalStatus', name: 'Final Status', width: 55 }
    ];

    // Verify width alignment: sum of column widths
    const sumColWidths = tableColumns.reduce((acc, col) => acc + col.width, 0);
    // If discrepancy, adjust the last column to match usableWidth exactly
    if (sumColWidths < usableWidth) {
      tableColumns[tableColumns.length - 1].width += (usableWidth - sumColWidths);
    }

    function drawTableHeader(curY) {
      doc.setFillColor(...ink);
      doc.rect(marginLeft, curY, usableWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);

      let curX = marginLeft + 3;
      tableColumns.forEach(col => {
        doc.text(col.name, curX, curY + 13);
        curX += col.width;
      });

      return curY + 20;
    }

    y = drawTableHeader(y);

    if (records.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...inkSoft);
      doc.text('No completed or archived history records found.', marginLeft + usableWidth / 2, y + 26, { align: 'center' });
    } else {
      records.forEach((r, idx) => {
        const statuses = getDetailedStatuses(r);

        const nameVal = r.name || '—';
        const regVal = r.reg || r.studentId || '—';
        const deptYearVal = `${r.department || '—'}\n${normalizeYear(r.year)}`;
        const roomVal = r.room || '—';
        const destVal = r.dest || '—';
        const outTimeVal = fmtDateTime(r.fromDate);
        const retTimeVal = fmtDateTime(r.toDate);
        const typeVal = formatRequestType(r.type);
        const reasonVal = r.reason || '—';

        // Prepare line wrapping for text cells
        const linesName = doc.splitTextToSize(nameVal, tableColumns[1].width - 5);
        const linesReg = doc.splitTextToSize(regVal, tableColumns[2].width - 4);
        const linesDeptYr = doc.splitTextToSize(deptYearVal, tableColumns[3].width - 4);
        const linesRoom = doc.splitTextToSize(roomVal, tableColumns[4].width - 4);
        const linesDest = doc.splitTextToSize(destVal, tableColumns[5].width - 5);
        const linesOut = doc.splitTextToSize(outTimeVal, tableColumns[6].width - 4);
        const linesRet = doc.splitTextToSize(retTimeVal, tableColumns[7].width - 4);
        const linesType = doc.splitTextToSize(typeVal, tableColumns[8].width - 4);
        const linesReason = doc.splitTextToSize(reasonVal, tableColumns[9].width - 5);
        const linesFac = doc.splitTextToSize(statuses.facultyStatus, tableColumns[10].width - 4);
        const linesWarden = doc.splitTextToSize(statuses.wardenStatus, tableColumns[11].width - 4);
        const linesParent = doc.splitTextToSize(statuses.parentStatus, tableColumns[12].width - 4);
        const linesFinal = doc.splitTextToSize(statuses.finalStatus, tableColumns[13].width - 4);

        const maxLines = Math.max(
          linesName.length,
          linesReg.length,
          linesDeptYr.length,
          linesRoom.length,
          linesDest.length,
          linesOut.length,
          linesRet.length,
          linesType.length,
          linesReason.length,
          linesFac.length,
          linesWarden.length,
          linesParent.length,
          linesFinal.length,
          1
        );

        const rowHeight = Math.max(22, maxLines * 9.5 + 8);

        // Check page boundary
        if (y + rowHeight > pageH - 42) {
          currentPage++;
          doc.addPage();
          drawHeader(currentPage);
          y = 70;
          y = drawTableHeader(y);
        }

        // Alternating row background
        if (idx % 2 === 1) {
          doc.setFillColor(249, 248, 244);
          doc.rect(marginLeft, y, usableWidth, rowHeight, 'F');
        }

        // Row border
        doc.setDrawColor(228, 224, 212);
        doc.setLineWidth(0.5);
        doc.line(marginLeft, y + rowHeight, pageW - marginRight, y + rowHeight);

        // Print cell content
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...ink);

        let curX = marginLeft + 3;

        // 1. Index
        doc.text(String(idx + 1), curX, y + 11);
        curX += tableColumns[0].width;

        // 2. Name
        doc.setFont('helvetica', 'bold');
        doc.text(linesName, curX, y + 11);
        doc.setFont('helvetica', 'normal');
        curX += tableColumns[1].width;

        // 3. Reg No
        doc.text(linesReg, curX, y + 11);
        curX += tableColumns[2].width;

        // 4. Dept & Year
        doc.text(linesDeptYr, curX, y + 11);
        curX += tableColumns[3].width;

        // 5. Room
        doc.text(linesRoom, curX, y + 11);
        curX += tableColumns[4].width;

        // 6. Destination
        doc.text(linesDest, curX, y + 11);
        curX += tableColumns[5].width;

        // 7. Out Date & Time
        doc.text(linesOut, curX, y + 11);
        curX += tableColumns[6].width;

        // 8. Expected Return
        doc.text(linesRet, curX, y + 11);
        curX += tableColumns[7].width;

        // 9. Request Type
        doc.text(linesType, curX, y + 11);
        curX += tableColumns[8].width;

        // 10. Reason
        doc.text(linesReason, curX, y + 11);
        curX += tableColumns[9].width;

        // 11. Faculty Advisor Status
        if (statuses.facultyStatus.startsWith('Approved')) doc.setTextColor(19, 115, 51);
        else if (statuses.facultyStatus.startsWith('Declined')) doc.setTextColor(197, 34, 31);
        else doc.setTextColor(90, 90, 100);
        doc.text(linesFac, curX, y + 11);
        curX += tableColumns[10].width;

        // 12. Warden Status
        if (statuses.wardenStatus.startsWith('Approved')) doc.setTextColor(19, 115, 51);
        else if (statuses.wardenStatus.startsWith('Declined')) doc.setTextColor(197, 34, 31);
        else doc.setTextColor(90, 90, 100);
        doc.text(linesWarden, curX, y + 11);
        curX += tableColumns[11].width;

        // 13. Parent Status
        if (statuses.parentStatus.includes('Confirmed') || statuses.parentStatus.includes('OK')) doc.setTextColor(19, 115, 51);
        else if (statuses.parentStatus.includes('Declined')) doc.setTextColor(197, 34, 31);
        else doc.setTextColor(176, 96, 0);
        doc.text(linesParent, curX, y + 11);
        curX += tableColumns[12].width;

        // 14. Final Outpass Status
        doc.setFont('helvetica', 'bold');
        if (statuses.finalStatus.includes('Ready') || statuses.finalStatus.includes('Safe')) doc.setTextColor(19, 115, 51);
        else if (statuses.finalStatus.includes('Declined')) doc.setTextColor(197, 34, 31);
        else doc.setTextColor(176, 96, 0);
        doc.text(linesFinal, curX, y + 11);

        y += rowHeight;
      });
    }

    // Footers for all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.8);
      doc.line(marginLeft, pageH - 26, pageW - marginRight, pageH - 26);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 130);
      doc.text('Government College of Engineering, Srirangam — GCES Kaveri Girls Hostel Outpass System', marginLeft, pageH - 14);
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginRight, pageH - 14, { align: 'right' });
    }

    // Generate clean filename
    const dateStr = new Date().toISOString().slice(0, 10);
    const identifier = role === 'student'
      ? (session?.reg || session?.username || 'Student')
      : (session?.department || session?.username || 'Staff');
    const filename = `${filePrefix}_${identifier}_${dateStr}.pdf`;

    doc.save(filename);
    return { success: true, filename };
  } catch (err) {
    console.error('History PDF generation error:', err);
    throw err;
  }
}
