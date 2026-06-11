/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ButtonHTMLAttributes } from "react";

interface ButtonProps extends React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "warning" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle = "inline-flex items-center justify-center font-sans font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0";
  
  const variants = {
    primary: "bg-theme-green hover:bg-slate-200 text-slate-950 shadow-neo-sm border-theme-black focus:ring-slate-900 font-bold",
    secondary: "bg-theme-blue hover:bg-blue-700 text-white shadow-neo-sm border-theme-black focus:ring-blue-500 font-bold",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-neo-sm border-theme-black focus:ring-red-500 font-bold",
    warning: "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-neo-sm border-theme-black focus:ring-amber-400 font-bold",
    outline: "border-2 border-theme-black hover:bg-slate-100 text-slate-950 font-bold focus:ring-slate-900"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4.5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base"
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
