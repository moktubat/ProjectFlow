import React, { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Clock, X } from "lucide-react";
import { parse, format, isValid } from "date-fns";

// Convert "HH:mm" (24h) to/from a Date object (date part doesn't matter)
function toDate(hhmm: string): Date | null {
  if (!hhmm) return null;
  const d = parse(hhmm, "HH:mm", new Date());
  return isValid(d) ? d : null;
}
function fromDate(d: Date | null): string {
  return d && isValid(d) ? format(d, "HH:mm") : "";
}
function displayTime(hhmm: string): string {
  const d = toDate(hhmm);
  return d ? format(d, "h:mm aa") : "";
}

const CustomTimeInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; onClear?: () => void; placeholder?: string; raw?: string }
>(({ onClick, onClear, placeholder, raw }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 w-full px-3 py-2 border border-[#D0D0D0] rounded-lg bg-white hover:border-[#0038BC] transition-colors text-left text-sm"
  >
    <Clock className="w-3.5 h-3.5 text-[#A0A0A0] shrink-0" />
    <span className={`flex-1 ${raw ? "text-[#111111]" : "text-[#A0A0A0]"}`}>
      {raw ? displayTime(raw) : placeholder}
    </span>
    {raw && onClear && (
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onClear?.())}
        className="text-[#A0A0A0] hover:text-[#111111] cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </span>
    )}
  </button>
));
CustomTimeInput.displayName = "CustomTimeInput";

interface TimePickerProps {
  value: string; // "HH:mm" 24h
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function TimePicker({
  value,
  onChange,
  label,
  placeholder = "Select time",
  className = "",
}: TimePickerProps) {
  const selected = toDate(value);

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[#3D3D3D] mb-1">{label}</label>
      )}
      <DatePicker
        selected={selected}
        onChange={(d: Date | null) => onChange(fromDate(d))}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={15}
        timeCaption="Time"
        dateFormat="h:mm aa"
        placeholderText={placeholder}
        customInput={
          <CustomTimeInput
            placeholder={placeholder}
            raw={value}
            onClear={() => onChange("")}
          />
        }
        popperPlacement="bottom-start"
        popperClassName="z-50"
        wrapperClassName="w-full"
        isClearable={false}
      />
    </div>
  );
}