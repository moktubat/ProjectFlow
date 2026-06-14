import React from "react";

interface ButtonProps extends React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "warning" | "outline" | "ghost";
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
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants: Record<string, string> = {
    primary:
      "bg-[#0038BC] text-white hover:bg-[#002fa3] focus-visible:outline-[#0038BC] shadow-sm",
    secondary:
      "bg-[#EF8F00] text-white hover:bg-[#d67f00] focus-visible:outline-[#EF8F00] shadow-sm",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 shadow-sm",
    warning:
      "bg-[#EF8F00] text-white hover:bg-[#d67f00] focus-visible:outline-[#EF8F00] shadow-sm",
    outline:
      "border border-[#D0D0D0] bg-white text-[#3D3D3D] hover:bg-[#F4F4F4] focus-visible:outline-[#0038BC]",
    ghost:
      "bg-transparent text-[#525252] hover:bg-[#F4F4F4] focus-visible:outline-[#0038BC]",
  };

  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-sm gap-2",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-3.5 w-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}