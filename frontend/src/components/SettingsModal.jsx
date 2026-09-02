import React, { useState } from 'react';

export default function SettingsModal({ currentTheme = 'system', onThemeChange, onClose }) {
  const [view, setView] = useState('main'); // 'main' | 'about'

  const options = [
    {
      id: 'light',
      title: 'Light Theme',
      desc: 'Clean, bright interface using classic light colors',
      icon: '☀️'
    },
    {
      id: 'dark',
      title: 'Dark Theme',
      desc: 'Sleek dark mode interface designed for low-light comfort',
      icon: '🌙'
    },
    {
      id: 'system',
      title: 'System Default',
      desc: "Automatically adapt to your device's light or dark mode setting",
      icon: '💻'
    }
  ];

  const features = [
    { icon: '📝', title: 'Student Outpass Requests', desc: 'Quick submission of outpass requests with auto-filled hometown destination' },
    { icon: '👨‍🏫', title: 'Faculty Advisor Approval', desc: 'Department & year-specific academic advisor review and verification' },
    { icon: '🛡️', title: 'Warden Approval', desc: 'Hostel administration clearance and final authorization' },
    { icon: '📞', title: 'Parent Confirmation', desc: 'Parent phone verification and communication logging' },
    { icon: '⚡', title: 'Outpass Ready Status', desc: 'Real-time multi-stage approval workflow tracking' },
    { icon: '📱', title: 'QR Code Generation', desc: 'Tamper-evident dynamic QR pass generation for hostel gate check-in/out' },
    { icon: '📜', title: 'Request History', desc: 'Complete historical logs of past outpasses, timestamps & statuses' },
    { icon: '🔑', title: 'Password Recovery', desc: 'Secure OTP-based email verification and password reset' },
    { icon: '🎨', title: 'Theme Settings', desc: 'Customizable visual themes including Light Mode, Dark Mode & System Default' }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1E2230] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden text-slate-800 dark:text-slate-100 my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#9E1B32] text-white p-4 px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {view === 'about' ? (
              <button
                onClick={() => setView('main')}
                className="text-lg text-white/90 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer mr-1"
                title="Back to Settings"
              >
                ←
              </button>
            ) : (
              <span className="text-2xl">⚙️</span>
            )}
            <div>
              <h3 className="font-serif text-lg font-bold leading-tight">
                {view === 'about' ? 'About Application' : 'Application Settings'}
              </h3>
              <p className="text-xs text-[var(--gold-soft)]">
                {view === 'about'
                  ? 'System information & feature overview'
                  : 'Customize your preferences & appearance'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg leading-none transition-colors cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {view === 'main' ? (
            <>
              {/* Appearance / Theme Section */}
              <div>
                <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2 mb-1">
                  <span>🎨</span> Appearance / Theme
                </h4>
                <p className="text-xs text-[var(--ink-soft)]">
                  Choose your preferred visual theme across the portal.
                </p>
              </div>

              <div className="space-y-2.5">
                {options.map((opt) => {
                  const isSelected = currentTheme === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => onThemeChange(opt.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-[var(--maroon)] bg-[var(--gold-soft)]/20 shadow-xs'
                          : 'border-[var(--line)] hover:border-gray-400 bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                          <div className="font-bold text-xs text-[var(--ink)] flex items-center gap-2">
                            {opt.title}
                            {isSelected && (
                              <span className="text-[10px] bg-[var(--maroon)] text-white font-bold px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                            {opt.desc}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-[var(--maroon)] bg-[var(--maroon)]'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* About Option Section */}
              <div className="pt-2 border-t border-[var(--line)]">
                <div
                  onClick={() => setView('about')}
                  className="p-3.5 rounded-xl border-2 border-[var(--line)] hover:border-[var(--maroon)] bg-transparent hover:bg-[var(--gold-soft)]/15 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                      <div className="font-bold text-xs text-[var(--ink)] group-hover:text-[var(--maroon)] transition-colors">
                        About
                      </div>
                      <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                        View information about this application
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-[var(--ink-soft)] group-hover:text-[var(--maroon)] group-hover:translate-x-0.5 transition-all text-sm font-bold">
                    ❯
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-[var(--maroon)] hover:bg-[var(--maroon-dark)] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            /* About View */
            <div className="space-y-4">
              <button
                onClick={() => setView('main')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--maroon)] hover:underline cursor-pointer"
              >
                ← Back to Settings
              </button>

              {/* Application Header Card */}
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--gold-soft)]/15 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10.5px] font-mono tracking-wider uppercase text-[var(--maroon)] font-bold">
                      Hostel Management System
                    </span>
                    <h3 className="font-serif text-base sm:text-lg font-bold text-[var(--maroon-dark)] mt-0.5">
                      GCES Kaveri Girls Out Form
                    </h3>
                  </div>
                  <span className="text-xs bg-[var(--maroon)] text-white font-mono font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                    v1.0.0
                  </span>
                </div>
                <p className="text-xs text-[var(--ink)] leading-relaxed">
                  A digital hostel outpass management system designed to simplify and manage student outpass requests, approvals, parent confirmation, and Outpass Ready QR generation.
                </p>
              </div>

              {/* System Details / Version */}
              <div className="p-3.5 rounded-xl border border-[var(--line)] space-y-2 bg-[var(--card)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--ink-soft)] font-medium">Application Name</span>
                  <span className="font-semibold text-[var(--ink)] text-right">GCES Kaveri Girls Out Form</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-[var(--line)] pt-2">
                  <span className="text-[var(--ink-soft)] font-medium">Version</span>
                  <span className="font-mono font-bold text-[var(--maroon)]">1.0.0</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-[var(--line)] pt-2">
                  <span className="text-[var(--ink-soft)] font-medium">Institution</span>
                  <span className="font-medium text-[var(--ink)] text-right">GCES Srirangam</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-[var(--line)] pt-2">
                  <span className="text-[var(--ink-soft)] font-medium">Hostel</span>
                  <span className="font-medium text-[var(--ink)]">Kaveri Girls Hostel</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold font-serif uppercase tracking-wider text-[var(--ink-soft)]">
                  Key Features
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--card)] flex items-start gap-2.5"
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{feat.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--ink)]">{feat.title}</div>
                        <div className="text-[11px] text-[var(--ink-soft)] leading-normal mt-0.5">
                          {feat.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Back to Settings Button */}
              <div className="pt-2">
                <button
                  onClick={() => setView('main')}
                  className="w-full py-2.5 bg-[var(--maroon)] hover:bg-[var(--maroon-dark)] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  ← Back to Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
