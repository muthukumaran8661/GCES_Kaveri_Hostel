import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

function normalizeYear(y) {
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  return s;
}

export default function StudentQrModal({ request, onClose }) {
  if (!request) return null;

  const qrToken = request.qrToken || request.requestId || '';
  const qrStatus = request.qrStatus || (request.status === 'returned' ? 'RETURNED' : 'ACTIVE');
  const scanCount = request.scanCount || (request.status === 'returned' ? 2 : (request.actualOutTime ? 1 : 0));

  let badgeBg = '#E6F4EA';
  let badgeColor = '#137333';
  let badgeBorder = '#CEEAD6';
  let badgeText = '🟢 ACTIVE — Ready for Gate Mark Out';

  if (qrStatus === 'OUT') {
    badgeBg = '#FEF7E0';
    badgeColor = '#B06000';
    badgeBorder = '#FCE8B2';
    badgeText = '🟡 CURRENTLY OUT — Awaiting Gate Return';
  } else if (qrStatus === 'RETURNED' || request.status === 'returned') {
    badgeBg = '#F1F3F4';
    badgeColor = '#5F6368';
    badgeBorder = '#DADCE0';
    badgeText = '🔴 RETURNED SAFE — QR Permanently Expired';
  }

  const formatDt = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return String(d);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[var(--gold-soft)] overflow-hidden text-slate-800 my-auto">
        {/* Header */}
        <div className="bg-[#9E1B32] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-serif text-lg font-bold leading-tight">Official Out Pass QR Code</h3>
              <p className="text-xs text-[var(--gold-soft)]">GCES Kaveri Girls Hostel Gate Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg leading-none transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          {/* Status Badge */}
          <div
            className="w-full py-2 px-3 rounded-xl border font-bold text-xs shadow-xs"
            style={{ backgroundColor: badgeBg, color: badgeColor, borderColor: badgeBorder }}
          >
            {badgeText}
          </div>

          {/* QR Code Canvas */}
          <div className="p-4 bg-white border-2 border-dashed border-gray-300 rounded-2xl shadow-inner flex flex-col items-center gap-2">
            {qrToken ? (
              <QRCodeSVG
                value={qrToken}
                size={200}
                level="H"
                includeMargin={true}
              />
            ) : (
              <div className="w-[200px] h-[200px] bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded-xl">
                Generating QR...
              </div>
            )}
            <div className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md border border-indigo-200 mt-1">
              Token ID: {qrToken || 'N/A'}
            </div>
          </div>

          {/* Pass Details Card */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs space-y-1.5">
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-gray-500 font-semibold">Student Name</span>
              <span className="font-bold text-gray-900">{request.name || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-gray-500 font-semibold">Register Number</span>
              <span className="font-mono font-semibold text-gray-800">{request.reg || request.owner || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-gray-500 font-semibold">Dept &amp; Year</span>
              <span className="font-medium text-gray-800">{request.department || '—'} ({normalizeYear(request.year)})</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-gray-500 font-semibold">Destination</span>
              <span className="font-medium text-gray-800 max-w-[200px] truncate">{request.dest || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-gray-500 font-semibold">Expected Return</span>
              <span className="font-semibold text-amber-800">{request.toDate || '—'}</span>
            </div>
            {request.actualOutTime && (
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-gray-500 font-semibold">Actual Out Time</span>
                <span className="font-semibold text-blue-800">{formatDt(request.actualOutTime)}</span>
              </div>
            )}
            {request.actualReturnTime && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Actual Return Time</span>
                <span className="font-semibold text-emerald-800">{formatDt(request.actualReturnTime)}</span>
              </div>
            )}
          </div>

          {/* One-Time Security Rule Notice */}
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 text-left flex items-start gap-2">
            <span className="text-base leading-none">🔒</span>
            <div>
              <b>Single-Use Gate Pass Policy:</b> This QR code can be scanned <b>1x for MARK OUT</b> and <b>1x for MARK BACK</b>. Scan count: <b>{scanCount}/2</b>. After return, it becomes permanently invalid.
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Close QR Modal
          </button>
        </div>
      </div>
    </div>
  );
}
