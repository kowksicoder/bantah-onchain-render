import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  variant?: 'bantah' | 'bantahbro';
}

export function SplashScreen({ onComplete, variant = 'bantah' }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Wait for fade out animation
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  if (variant === 'bantahbro') {
    return (
      <div className="fixed inset-0 bg-[#05030a] flex items-center justify-center z-50 animate-fade-out">
        <div className="text-center">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full border border-violet-500/30 bg-violet-500/10 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.35)]">
              <img
                src="/bantahbrologo.png"
                alt="BantahBro"
                className="w-20 h-20 rounded-full object-cover animate-pulse"
              />
            </div>
            <h1 className="text-violet-200 text-2xl font-bold mb-2">BantahBro</h1>
            <p className="text-violet-200/70 text-sm">AI Degen Command Center</p>
          </div>

          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-400 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50 animate-fade-out">
      <div className="text-center">
        <div className="mb-8">
          <img 
            src="/assets/bantahlogo.png" 
            alt="BetChat" 
            className="w-20 h-20 mx-auto mb-4 animate-pulse"
          />
          <h1 className="text-primary text-2xl font-bold mb-2">Bantah</h1>
          <p className="text-slate-600 text-sm">Predict • Chat • Win</p>
        </div>

        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      </div>
    </div>
  );
}
