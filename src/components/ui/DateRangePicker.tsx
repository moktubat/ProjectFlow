import React, { forwardRef, useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";

// ─── helpers ──────────────────────────────────────────────────────────────────
function toDate(ymd: string): Date | null {
  if (!ymd) return null;
  const d = parse(ymd, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : null;
}
function fromDate(d: Date | null): string {
  return d && isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

// ─── Custom input rendered inside the trigger div ────────────────────────────
const CustomInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; onClear?: () => void; placeholder?: string }
>(({ value, onClick, onClear, placeholder }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 w-full px-3 py-2 border border-[#D0D0D0] rounded-lg bg-white hover:border-[#0038BC] transition-colors text-left text-sm"
  >
    <Calendar className="w-3.5 h-3.5 text-[#A0A0A0] shrink-0" />
    <span className={`flex-1 ${value ? "text-[#111111]" : "text-[#A0A0A0]"}`}>
      {value || placeholder}
    </span>
    {value && onClear && (
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
CustomInput.displayName = "CustomInput";

// ─── DateRangePicker ─────────────────────────────────────────────────────────
interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  label,
  className = "",
}: DateRangePickerProps) {

  const [draft, setDraft] = useState<[Date | null, Date | null]>([
    toDate(value.start),
    toDate(value.end),
  ]);


  const startDate = toDate(value.start);
  const endDate = toDate(value.end);


  useEffect(() => {
    setDraft([toDate(value.start), toDate(value.end)]);
  }, [value.start, value.end]);

  const [draftStart, draftEnd] = draft;

  const handleChange = ([start, end]: [Date | null, Date | null]) => {
    setDraft([start, end]);
    if (start && end) {
      onChange({ start: fromDate(start), end: fromDate(end) });
    }
  };

  const handleClear = () => {
    setDraft([null, null]);
    onChange({ start: "", end: "" });
  };

  return (
    <div className={`${className}`}>
      {label && (
        <label className="block text-sm font-medium text-[#3D3D3D] mb-1">{label}</label>
      )}
      <DatePicker
        selectsRange
        startDate={draftStart ?? undefined}
        endDate={draftEnd ?? undefined}
        onChange={handleChange}
        dateFormat="MM/dd/yy"
        placeholderText="Start date"
        customInput={
          <CustomInput
            placeholder="MM/DD/YY – MM/DD/YY"
            onClear={handleClear}
            value={
              draftStart
                ? `${format(draftStart, "MM/dd/yy")}${draftEnd ? " – " + format(draftEnd, "MM/dd/yy") : ""}`
                : undefined
            }
          />
        }
        popperPlacement="bottom-start"
        popperClassName="z-50"
        portalId="datepicker-portal"
        wrapperClassName="w-full"
        isClearable={false}
        monthsShown={1}
      />
    </div>
  );
}

// ─── SingleDatePicker ─────────────────────────────────────────────────────────
interface SingleDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  minDate?: string;
}

export function SingleDatePicker({
  value,
  onChange,
  label,
  placeholder = "Select date",
  className = "",
  minDate,
}: SingleDatePickerProps) {
  const selected = toDate(value);
  const min = minDate ? toDate(minDate) : undefined;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[#3D3D3D] mb-1">{label}</label>
      )}
      <DatePicker
        selected={selected}
        onChange={(d: Date | null) => onChange(fromDate(d))}
        dateFormat="MM/dd/yy"
        placeholderText={placeholder}
        minDate={min ?? undefined}
        customInput={
          <CustomInput
            placeholder={placeholder}
            onClear={() => onChange("")}
            value={selected && isValid(selected) ? format(selected, "MM/dd/yy") : undefined}
          />
        }
        popperPlacement="bottom-start"
        portalId="datepicker-portal"
        popperClassName="z-50"
        wrapperClassName="w-full"
        isClearable={false}
      />
    </div>
  );
}