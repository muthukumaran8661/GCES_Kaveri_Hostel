import React from 'react';

export default function SettingsModal({ currentTheme = 'system', onThemeChange, onClose }) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1E2230] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden text-slate-800 dark:text-slate-100 my-auto">
        {/* Header */}
        <div className="bg-[#9E1B32] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚙️</span>
            <div>
              <h3 className="font-serif text-lg font-bold leading-tight">Application Settings</h3>
              <p className="text-xs text-[var(--gold-soft)]">Customize your preferences &amp; appearance</p>
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
        <div className="p-5 space-y-4">
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

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-[var(--maroon)] hover:bg-[var(--maroon-dark)] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
