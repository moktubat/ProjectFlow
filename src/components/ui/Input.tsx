/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { InputHTMLAttributes } from "react";

interface InputProps extends React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
  label?: string;
  error?: string;
  id?: string;
  [key: string]: any;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-theme-blue focus:ring-4 focus:ring-theme-blue/10 transition-all ${
          error ? "border-red-500 focus:border-red-500" : "border-slate-200"
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="block mt-1 text-xs text-theme-pink font-medium px-1">
          {error}
        </span>
      )}
    </div>
  );
}
