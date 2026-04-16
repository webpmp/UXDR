import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const Login = () => {
  const { user, signIn, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center">
        <div className="max-w-md w-full px-8 text-center title-wrapper">
           <Shield className="w-16 h-16 mx-auto mb-6 text-[#FF3D00]" />
           <h1 className="font-sans font-black text-6xl uppercase tracking-tighter text-[#FF3D00]">
              UXDR
           </h1>
           <p className="mt-4 font-mono text-[11px] tracking-widest text-[#999999] uppercase">UX Design Review System</p>
           
           <button 
              onClick={signIn}
              className="mt-12 w-full py-4 bg-white hover:bg-gray-200 text-black font-black tracking-wider uppercase text-[12px] transition-colors rounded-sm"
           >
              Continue with Google
           </button>
        </div>
    </div>
  );
};
