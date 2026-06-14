import React from "react";

interface InputProps extends React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  id?: string;
  [key: string]: any;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[#3D3D3D] mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-[#111111] placeholder:text-[#A0A0A0]
          focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]
          transition-colors duration-150
          ${error ? "border-red-500 focus:ring-red-200 focus:border-red-500" : "border-[#D0D0D0]"}
          ${className}`}
        {...props}
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-[#737373]">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}