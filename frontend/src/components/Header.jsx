import React from 'react';
import logo from './../assets/logo.png'

export default function Header({ session, onLogout, subtitle }) {
  const roleLabel = session
    ? (session.role === 'staff' ? (session.designation || 'Warden') : `ID ${session.studentId || session.username || ''}`)
    : '';

  return (
    <div className="gkof-hero">
      <div className="w-[58px] h-[58px] rounded-full bg-white p-1 flex-shrink-0 shadow-md max-[600px]:w-[46px] max-[600px]:h-[46px]">
        <img src={logo} alt="GCES Srirangam logo" className="w-full h-full object-contain rounded-full" />
      </div>
      <div className="text-white leading-tight flex-1 min-w-0">
        <div className="font-serif font-bold text-[19px] max-[600px]:text-[15.5px] max-[420px]:text-[14px]">
          GCES Kaveri Girls Out Form
        </div>
        <div className="font-mono text-[10.5px] tracking-[1.4px] uppercase text-gold-soft mt-[3px] max-[600px]:text-[9px] max-[600px]:tracking-[1px]">
          {session ? (session.role === 'staff' || session.role === 'admin' ? 'Warden Dashboard' : session.role === 'faculty' ? 'Faculty Dashboard' : 'Student Dashboard') : subtitle}
        </div>
      </div>
      {session && (
        <div className="flex items-center gap-2.5 flex-shrink-0 max-[600px]:w-full max-[600px]:justify-between">
          <div className="text-white text-right leading-tight max-[600px]:text-left">
            <b className="font-serif text-[12.5px] block">{session.name}</b>
            <span className="font-mono text-[9.5px] color-gold-soft text-[#F3DCA6]">{roleLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
