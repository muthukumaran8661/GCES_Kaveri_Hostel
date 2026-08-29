import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function normalizeYear(y) {
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  return s;
}

export default function GateScannerModal({ session, onClose, onRefreshData }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [scanHistory, setScanHistory] = useState([]);

  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrcodeScanner = null;
    if (activeTab === 'camera' && !verifyResult) {
      try {
        html5QrcodeScanner = new Html5QrcodeScanner(
          'qr-reader-container',
          { fps: 10, qrbox: { width: 220, height: 220 } },
          false
        );

        html5QrcodeScanner.render(
          (decodedText) => {
            if (decodedText) {
              try { html5QrcodeScanner.clear(); } catch (e) {}
              handleVerify(decodedText);
            }
          },
          (error) => {
            // frame decode error - silent
          }
        );
        scannerRef.current = html5QrcodeScanner;
      } catch (err) {
        console.error('Camera init error:', err);
      }
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
      }
    };
  }, [activeTab, verifyResult]);

  async function apiCall(endpoint, method = 'POST', data = null) {
    const token = localStorage.getItem('gkof_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(endpoint, {
      method,
      headers,
      body: data ? JSON.stringify(data) : null
    });
    const result = await res.json();
    return { ok: res.ok, status: res.status, result };
  }

  const handleVerify = async (tokenToVerify) => {
    const targetToken = (tokenToVerify || tokenInput).trim();
    if (!targetToken) {
      alert('Please enter or scan a valid QR token');
      return;
    }

    try {
      setLoading(true);
      setActionMsg('');
      const { ok, result } = await apiCall('/api/qr/verify', 'POST', { qrToken: targetToken });

      setVerifyResult({
        ok,
        scanResult: result.scanResult || (ok ? 'VALID' : 'INVALID'),
        currentQrStatus: result.currentQrStatus || (result.request?.qrStatus) || 'UNKNOWN',
        canMarkOut: !!result.canMarkOut,
        canMarkBack: !!result.canMarkBack,
        message: result.message || (ok ? 'Verification Complete' : 'Invalid QR Code'),
        request: result.request || null
      });

      // Add to session scan history
      setScanHistory(prev => [
        {
          timestamp: new Date().toLocaleTimeString(),
          token: targetToken,
          studentName: result.request?.name || 'N/A',
          result: result.scanResult || (ok ? 'VALID' : 'INVALID'),
          message: result.message
        },
        ...prev.slice(0, 9)
      ]);
    } catch (err) {
      setVerifyResult({
        ok: false,
        scanResult: 'INVALID_TOKEN',
        currentQrStatus: 'INVALID',
        canMarkOut: false,
        canMarkBack: false,
        message: '❌ System error verifying QR token: ' + err.message,
        request: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkOut = async () => {
    if (!verifyResult || !verifyResult.request) return;
    const token = verifyResult.request.qrToken || verifyResult.request.requestId;
    try {
      setLoading(true);
      const { ok, result } = await apiCall('/api/qr/mark-out', 'POST', { qrToken: token });
      if (ok) {
        setActionMsg('✓ SUCCESS: MARK OUT completed for ' + (result.request?.name || 'Student'));
        setVerifyResult(prev => ({
          ...prev,
          canMarkOut: false,
          canMarkBack: false,
          currentQrStatus: 'OUT',
          scanResult: 'VALID_OUT',
          message: '✓ MARK OUT COMPLETED — Pass is now CURRENTLY OUT',
          request: result.request
        }));
        if (onRefreshData) onRefreshData();
      } else {
        setActionMsg(result.message || 'Failed to MARK OUT');
      }
    } catch (err) {
      setActionMsg('Error marking OUT: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkBack = async () => {
    if (!verifyResult || !verifyResult.request) return;
    const token = verifyResult.request.qrToken || verifyResult.request.requestId;
    try {
      setLoading(true);
      const { ok, result } = await apiCall('/api/qr/mark-back', 'POST', { qrToken: token });
      if (ok) {
        setActionMsg('✓ SUCCESS: MARK BACK completed! Student status set to Returned Safe.');
        setVerifyResult(prev => ({
          ...prev,
          canMarkOut: false,
          canMarkBack: false,
          currentQrStatus: 'RETURNED',
          scanResult: 'VALID_BACK',
          message: '✓ MARK BACK COMPLETED — Pass is RETURNED SAFE and now PERMANENTLY INVALID',
          request: result.request
        }));
        if (onRefreshData) onRefreshData();
      } else {
        setActionMsg(result.message || 'Failed to MARK BACK');
      }
    } catch (err) {
      setActionMsg('Error marking BACK: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetScan = () => {
    setVerifyResult(null);
    setActionMsg('');
    setTokenInput('');
  };

  const formatDt = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return String(d);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[var(--gold-soft)] overflow-hidden flex flex-col text-slate-800 my-auto">
        {/* Header */}
        <div className="bg-[#9E1B32] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📷</span>
            <div>
              <h3 className="font-serif text-lg font-bold leading-tight">Gate Pass QR Scanner &amp; Verifier</h3>
              <p className="text-xs text-[var(--gold-soft)]">GCES Kaveri Hostel Security Checkpoint</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg leading-none transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Action Message Alert */}
          {actionMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${actionMsg.includes('SUCCESS') ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'}`}>
              {actionMsg}
            </div>
          )}

          {!verifyResult ? (
            <>
              {/* Tabs: Camera vs Manual */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'camera' ? 'border-[var(--maroon)] text-[var(--maroon)]' : 'border-transparent text-gray-500'}`}
                >
                  📷 Camera Scanner
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'manual' ? 'border-[var(--maroon)] text-[var(--maroon)]' : 'border-transparent text-gray-500'}`}
                >
                  ⌨️ Enter Token / Request ID
                </button>
              </div>

              {/* Camera Scanner View */}
              {activeTab === 'camera' && (
                <div className="flex flex-col items-center gap-3">
                  <div id="qr-reader-container" className="w-full max-w-[320px] rounded-xl overflow-hidden border-2 border-indigo-200 shadow-inner bg-slate-50"></div>
                  <p className="text-[11px] text-gray-500 font-medium">Position student QR code within the camera frame</p>
                </div>
              )}

              {/* Manual Entry View */}
              {activeTab === 'manual' && (
                <div className="flex flex-col gap-3 py-2">
                  <label className="text-xs font-bold text-gray-700">Enter QR Token or Request ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. QR-7F8A9B1C or REQ5FG7U"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleVerify(tokenInput); }}
                      className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <button
                      onClick={() => handleVerify(tokenInput)}
                      disabled={loading}
                      className="px-4 py-2 bg-[var(--maroon)] hover:bg-rose-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify Token'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Result Verification Screen */
            <div className="flex flex-col gap-4">
              {/* Verification Header Badge */}
              {verifyResult.scanResult === 'VALID_OUT' && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-900 text-center font-bold text-base shadow-sm">
                  ✓ VALID OUT PASS
                  <div className="text-xs font-normal text-emerald-700 mt-0.5">Ready for Gate MARK OUT</div>
                </div>
              )}

              {verifyResult.scanResult === 'VALID_BACK' && (
                <div className="p-3 bg-blue-50 border-2 border-blue-500 rounded-xl text-blue-900 text-center font-bold text-base shadow-sm">
                  ✓ VALID OUT PASS &nbsp;·&nbsp; 🟢 CURRENTLY OUT
                  <div className="text-xs font-normal text-blue-700 mt-0.5">Student is currently outside. Ready for MARK BACK.</div>
                </div>
              )}

              {(verifyResult.scanResult === 'INVALID_ALREADY_USED' || verifyResult.currentQrStatus === 'RETURNED') && (
                <div className="p-3 bg-rose-50 border-2 border-rose-600 rounded-xl text-rose-900 text-center font-bold text-base shadow-sm">
                  ❌ INVALID OUT PASS
                  <div className="text-xs font-bold text-rose-700 mt-1">This QR code has already been used for both OUT and BACK.</div>
                </div>
              )}

              {['INVALID_TOKEN', 'INVALID_STATUS'].includes(verifyResult.scanResult) && verifyResult.currentQrStatus !== 'RETURNED' && (
                <div className="p-3 bg-amber-50 border-2 border-amber-500 rounded-xl text-amber-900 text-center font-bold text-base shadow-sm">
                  ❌ INVALID OUT PASS
                  <div className="text-xs font-medium text-amber-800 mt-0.5">{verifyResult.message}</div>
                </div>
              )}

              {/* Student & Pass Information Box */}
              {verifyResult.request && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2 border-b pb-2">
                    <div>
                      <span className="text-gray-500 text-[11px] block">Student Name</span>
                      <span className="font-bold text-gray-900 text-sm">{verifyResult.request.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px] block">Register Number</span>
                      <span className="font-mono font-bold text-gray-800">{verifyResult.request.reg || verifyResult.request.owner || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-b pb-2">
                    <div>
                      <span className="text-gray-500 text-[11px] block">Department &amp; Year</span>
                      <span className="font-medium text-gray-800">{verifyResult.request.department || '—'} ({normalizeYear(verifyResult.request.year)})</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px] block">Room / Hostel</span>
                      <span className="font-medium text-gray-800">{verifyResult.request.room || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-b pb-2">
                    <div>
                      <span className="text-gray-500 text-[11px] block">Destination</span>
                      <span className="font-medium text-gray-800 truncate block">{verifyResult.request.dest || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px] block">Parent Phone</span>
                      <span className="font-mono font-semibold text-gray-800">{verifyResult.request.parentPhone || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-b pb-2">
                    <div>
                      <span className="text-gray-500 text-[11px] block">Out Date &amp; Time</span>
                      <span className="font-semibold text-gray-800">{verifyResult.request.fromDate || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px] block">Expected Return</span>
                      <span className="font-semibold text-amber-800">{verifyResult.request.toDate || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-gray-500 text-[11px] block">Actual Out Time</span>
                      <span className="font-semibold text-blue-800">{formatDt(verifyResult.request.actualOutTime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px] block">Actual Return Time</span>
                      <span className="font-semibold text-emerald-800">
                        {formatDt(verifyResult.request.actualReturnTime)}
                        {verifyResult.request.lateReturn && (
                          <span className="text-rose-700 text-[10px] block font-bold">⚠ Late Return ({verifyResult.request.lateReturnDuration})</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t text-[11px]">
                    <span className="font-mono text-indigo-900 font-bold">Request ID: {verifyResult.request.requestId || verifyResult.request.id}</span>
                    <span className="font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">QR Status: {verifyResult.request.qrStatus || 'ACTIVE'} ({verifyResult.request.scanCount || 0}/2)</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {verifyResult.canMarkOut && (
                  <button
                    onClick={handleMarkOut}
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🟢</span> <span>[ MARK OUT ]</span>
                  </button>
                )}

                {verifyResult.canMarkBack && (
                  <button
                    onClick={handleMarkBack}
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🔵</span> <span>[ MARK BACK ]</span>
                  </button>
                )}

                {/* If Invalid / Returned -> Rejection Warning Box */}
                {(verifyResult.scanResult === 'INVALID_ALREADY_USED' || verifyResult.currentQrStatus === 'RETURNED') && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 text-center font-medium">
                    <b>No Actions Available:</b> This QR pass is permanently invalid because the student has already checked OUT and returned SAFE.
                  </div>
                )}

                <button
                  onClick={handleResetScan}
                  className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer mt-1"
                >
                  🔄 Scan / Verify Another QR Code
                </button>
              </div>
            </div>
          )}

          {/* Session Scan Log History */}
          {scanHistory.length > 0 && (
            <div className="mt-2 border-t pt-3">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Session Audit Activity</span>
              <div className="max-h-[120px] overflow-y-auto space-y-1.5 text-[11px]">
                {scanHistory.map((h, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="text-gray-500 font-mono">{h.timestamp}</span>
                    <span className="font-bold text-gray-800">{h.studentName}</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${h.result.includes('VALID') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {h.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
