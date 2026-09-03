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
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

/**
 * Generate and download PDF report of all Staff and Warden accounts.
 * 
 * @param {Object} params
 * @param {Array} params.staffList - List of staff user records from MongoDB / API
 * @param {Object} [params.currentSession] - Logged in session performing export
 */
export async function generateStaffDetailsPdf({ staffList = [], currentSession = null }) {
  try {
    // Landscape A4: width = 841.89 pt, height = 595.28 pt
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Theme color palette
    const maroon = [158, 27, 50];       // #9E1B32
    const maroonDark = [122, 20, 38];   // Deep maroon
    const gold = [217, 164, 65];        // #D9A441
    const goldSoft = [243, 220, 166];   // Light gold
    const ink = [42, 33, 64];           // #2A2140
    const inkSoft = [100, 100, 115];
    const borderGold = [217, 164, 65];
    const teal = [18, 122, 110];        // #127A6E
    const green = [18, 138, 76];        // Active green
    const red = [186, 26, 26];          // Inactive red

    const marginLeft = 24;
    const marginRight = 24;
    const usableWidth = pageW - marginLeft - marginRight; // 793.89 pt

    const logoData = await getLogoBase64(logo);

    // Date and time string
    const now = new Date();
    const generatedDateStr = now.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Summary counts
    const totalStaff = staffList.length;
    const wardenCount = staffList.filter(u => u.role === 'staff' || u.role === 'admin').length;
    const facultyCount = staffList.filter(u => u.role === 'faculty').length;
    const activeCount = staffList.filter(u => (u.status || 'active') === 'active').length;
    const inactiveCount = totalStaff - activeCount;

    // Table Column Definitions (Sum = usableWidth = 793.89 pt)
    const columns = [
      { key: 'idx', label: 'S.No', width: 34, align: 'center' },
      { key: 'name', label: 'Full Name', width: 125, align: 'left' },
      { key: 'username', label: 'Login ID', width: 95, align: 'left' },
      { key: 'role', label: 'Role', width: 85, align: 'center' },
      { key: 'department', label: 'Department', width: 90, align: 'left' },
      { key: 'year', label: 'Assigned Year', width: 75, align: 'center' },
      { key: 'email', label: 'Registered Email Address', width: 155, align: 'left' },
      { key: 'phone', label: 'Phone Number', width: 75, align: 'center' },
      { key: 'status', label: 'Status', width: 59.89, align: 'center' }
    ];

    // Page tracking
    let pageCount = 1;

    // Helper: Draw Header on page
    function drawHeader() {
      // Top Institutional Banner
      doc.setFillColor(...maroon);
      doc.rect(0, 0, pageW, 54, 'F');

      // Accent Gold Ribbon
      doc.setFillColor(...gold);
      doc.rect(0, 54, pageW, 3.5, 'F');

      // College Logo
      let textX = marginLeft;
      if (logoData) {
        try {
          doc.addImage(logoData, 'PNG', marginLeft, 7, 40, 40);
          textX = marginLeft + 48;
        } catch (e) {
          console.warn('Could not render logo in PDF:', e);
        }
      }

      // Main Institution Header
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('GCES Kaveri Girls Out Form', textX, 23);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...goldSoft);
      doc.text('Staff & Warden Details Report', textX, 39);

      // Top Right Document Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text('STAFF PERMISSIONS RECORD', pageW - marginRight, 23, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...goldSoft);
      doc.text(`Generated: ${generatedDateStr}`, pageW - marginRight, 39, { align: 'right' });
    }

    // Draw first page header
    drawHeader();

    let y = 68;

    // Meta & Statistics Summary Box
    doc.setFillColor(252, 250, 245);
    doc.setDrawColor(...borderGold);
    doc.setLineWidth(0.75);
    doc.roundedRect(marginLeft, y, usableWidth, 26, 3, 3, 'FD');

    // Stats items
    const stats = [
      `Total Records: ${totalStaff}`,
      `Wardens: ${wardenCount}`,
      `Faculty Advisors: ${facultyCount}`,
      `Active: ${activeCount}`,
      `Inactive: ${inactiveCount}`
    ];

    const statSpacing = usableWidth / stats.length;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);

    stats.forEach((st, idx) => {
      const sx = marginLeft + (idx * statSpacing) + (statSpacing / 2);
      doc.text(st, sx, y + 16, { align: 'center' });
      if (idx < stats.length - 1) {
        doc.setDrawColor(...borderGold);
        doc.line(marginLeft + (idx + 1) * statSpacing, y + 5, marginLeft + (idx + 1) * statSpacing, y + 21);
      }
    });

    y += 34;

    // Helper: Draw Table Header Row
    function drawTableHeader(currentY) {
      doc.setFillColor(...maroonDark);
      doc.rect(marginLeft, currentY, usableWidth, 22, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);

      let colX = marginLeft;
      columns.forEach(col => {
        let alignX = colX + 4;
        if (col.align === 'center') alignX = colX + (col.width / 2);
        if (col.align === 'right') alignX = colX + col.width - 4;
        doc.text(col.label, alignX, currentY + 14, { align: col.align || 'left' });
        colX += col.width;
      });

      // Bottom border for header
      doc.setDrawColor(...gold);
      doc.setLineWidth(1);
      doc.line(marginLeft, currentY + 22, marginLeft + usableWidth, currentY + 22);

      return currentY + 22;
    }

    y = drawTableHeader(y);

    const rowHeight = 22;
    const footerHeight = 35;
    const bottomLimit = pageH - footerHeight;

    // Render Data Rows
    if (staffList.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.rect(marginLeft, y, usableWidth, 30, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...inkSoft);
      doc.text('No staff or warden accounts found.', pageW / 2, y + 18, { align: 'center' });
      y += 30;
    } else {
      staffList.forEach((u, index) => {
        // Page overflow check
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          pageCount++;
          drawHeader();
          y = drawTableHeader(68);
        }

        // Alternating row background
        const isEven = index % 2 === 0;
        doc.setFillColor(isEven ? 255 : 251, isEven ? 255 : 249, isEven ? 255 : 244);
        doc.rect(marginLeft, y, usableWidth, rowHeight, 'F');

        // Row outline
        doc.setDrawColor(234, 226, 214);
        doc.setLineWidth(0.5);
        doc.line(marginLeft, y + rowHeight, marginLeft + usableWidth, y + rowHeight);

        // Populate values
        const sNo = String(index + 1);
        const name = (u.name || '—').trim();
        const loginId = (u.staffId || u.username || '—').trim();
        const roleLabel = (u.role === 'staff' || u.role === 'admin') ? 'Warden' : 'Faculty Advisor';
        const dept = (u.department || '—').trim();
        const year = normalizeYear(u.year);
        const email = (u.email || '—').trim();
        const phone = (u.phone || '—').trim();
        const rawStatus = (u.status || 'active').toLowerCase();
        const statusLabel = rawStatus === 'active' ? 'Active' : 'Inactive';

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...ink);

        let colX = marginLeft;
        columns.forEach(col => {
          let text = '';
          let isBold = false;
          let customColor = null;

          if (col.key === 'idx') {
            text = sNo;
          } else if (col.key === 'name') {
            text = doc.splitTextToSize(name, col.width - 8)[0] || name;
            isBold = true;
          } else if (col.key === 'username') {
            text = doc.splitTextToSize(loginId, col.width - 8)[0] || loginId;
            customColor = [60, 50, 80];
          } else if (col.key === 'role') {
            text = roleLabel;
            isBold = true;
            customColor = roleLabel === 'Warden' ? maroon : teal;
          } else if (col.key === 'department') {
            text = doc.splitTextToSize(dept, col.width - 8)[0] || dept;
          } else if (col.key === 'year') {
            text = year;
          } else if (col.key === 'email') {
            text = doc.splitTextToSize(email, col.width - 8)[0] || email;
            customColor = [40, 40, 60];
          } else if (col.key === 'phone') {
            text = phone;
          } else if (col.key === 'status') {
            text = statusLabel;
            isBold = true;
            customColor = rawStatus === 'active' ? green : red;
          }

          if (isBold) doc.setFont('helvetica', 'bold');
          else doc.setFont('helvetica', 'normal');

          if (customColor) doc.setTextColor(...customColor);
          else doc.setTextColor(...ink);

          let alignX = colX + 4;
          if (col.align === 'center') alignX = colX + (col.width / 2);
          if (col.align === 'right') alignX = colX + col.width - 4;

          doc.text(text, alignX, y + 14, { align: col.align || 'left' });
          colX += col.width;
        });

        y += rowHeight;
      });
    }

    // Add footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);

      // Footer divider
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.75);
      doc.line(marginLeft, pageH - 22, pageW - marginRight, pageH - 22);

      // System note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...inkSoft);
      doc.text(
        'Government College of Engineering, Salem — Kaveri Girls Hostel Management System • Confidential Administration Report (Strictly No Passwords Stored/Exported)',
        marginLeft,
        pageH - 10
      );

      // Page numbering
      doc.setFont('helvetica', 'bold');
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginRight, pageH - 10, { align: 'right' });
    }

    // Save and trigger browser download
    const dateFormatted = now.toISOString().split('T')[0];
    const fileName = `GCES_Staff_Warden_Details_${dateFormatted}.pdf`;
    doc.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('[PDF Export Error] Failed to generate Staff Details PDF:', error);
    throw error;
  }
}
