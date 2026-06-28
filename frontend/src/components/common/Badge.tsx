import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  dot?: boolean;
}

const variants: Record<string, string> = {
  success: 'bg-emerald-900/50 text-emerald-400 border-emerald-700',
  danger: 'bg-red-900/50 text-red-400 border-red-700',
  warning: 'bg-amber-900/50 text-amber-400 border-amber-700',
  info: 'bg-brand-900/50 text-brand-400 border-brand-700',
  neutral: 'bg-slate-700 text-slate-300 border-slate-600',
};

const dotColors: Record<string, string> = {
  success: 'bg-emerald-400',
  danger: 'bg-red-400',
  warning: 'bg-amber-400',
  info: 'bg-brand-400',
  neutral: 'bg-slate-400',
};

export function Badge({ label, variant = 'neutral', dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {label}
    </span>
  );
}
