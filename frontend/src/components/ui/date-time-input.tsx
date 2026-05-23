"use client";

import { Input } from "@/src/components/ui/input";

type DateTimeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function splitDateTime(value: string) {
  if (!value) {
    return {
      date: "",
      time: "",
    };
  }

  const [datePart, timePart = ""] = value.split("T");

  return {
    date: datePart,
    time: timePart.slice(0, 5),
  };
}

function combineDateTime(date: string, time: string) {
  if (!date && !time) {
    return "";
  }

  if (!date) {
    return "";
  }

  return `${date}T${time || "09:00"}`;
}

export function DateTimeInput({
  label,
  value,
  onChange,
  disabled,
}: DateTimeInputProps) {
  const { date, time } = splitDateTime(value);

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
        {label}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Дата"
          type="date"
          value={date}
          disabled={disabled}
          onChange={(event) => {
            onChange(combineDateTime(event.target.value, time));
          }}
        />

        <Input
          label="Время"
          type="time"
          value={time}
          disabled={disabled}
          onChange={(event) => {
            onChange(combineDateTime(date, event.target.value));
          }}
        />
      </div>
    </div>
  );
}