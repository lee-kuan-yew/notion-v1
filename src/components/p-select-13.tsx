"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TimezoneSelectProps = {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (timezone: string) => void;
  className?: string;
};

function canonicalZone(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return tz;
  }
}

export default function Particle({
  id,
  name,
  defaultValue = "Asia/Ho_Chi_Minh",
  value,
  onValueChange,
  className,
}: TimezoneSelectProps = {}) {
  const formattedTimezones = useMemo(() => {
    const rawZones = Intl.supportedValuesOf("timeZone");
    // Normalize Asia/Saigon -> Asia/Ho_Chi_Minh for clear display in Vietnam while supporting all IANA zones
    const zones = rawZones.map((tz) => (tz === "Asia/Saigon" ? "Asia/Ho_Chi_Minh" : tz));
    if (!zones.includes("Asia/Ho_Chi_Minh")) zones.push("Asia/Ho_Chi_Minh");

    return zones
      .map((timezone) => {
        const formatter = new Intl.DateTimeFormat("en", {
          timeZone: timezone,
          timeZoneName: "shortOffset",
        });
        const parts = formatter.formatToParts(new Date());
        const offset =
          parts.find((part) => part.type === "timeZoneName")?.value || "";
        const modifiedOffset = offset === "GMT" ? "GMT+0" : offset;

        const offsetMatch = offset.match(/GMT([+-]?)(\d+)(?::(\d+))?/);
        const sign = offsetMatch?.[1] === "-" ? -1 : 1;
        const hours = Number.parseInt(offsetMatch?.[2] || "0", 10);
        const minutes = Number.parseInt(offsetMatch?.[3] || "0", 10);
        const totalMinutes = sign * (hours * 60 + minutes);

        return {
          label: `(${modifiedOffset}) ${timezone.replace(/_/g, " ")}`,
          numericOffset: totalMinutes,
          value: timezone,
        };
      })
      .sort((a, b) => a.numericOffset - b.numericOffset || a.label.localeCompare(b.label));
  }, []);

  const [selectedTz, setSelectedTz] = useState(defaultValue);
  const currentTz = value ?? selectedTz;
  const currentCanonical = canonicalZone(currentTz);
  const currentItem =
    formattedTimezones.find((tz) => tz.value === currentTz) ??
    formattedTimezones.find((tz) => canonicalZone(tz.value) === currentCanonical) ??
    formattedTimezones.find((tz) => tz.value === "Asia/Ho_Chi_Minh") ??
    formattedTimezones[0];

  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={currentItem?.value ?? currentTz} />}
      <Select
        value={currentItem}
        onValueChange={(next) => {
          if (!next) return;
          if (value === undefined) setSelectedTz(next.value);
          onValueChange?.(next.value);
        }}
        itemToStringValue={(item) => item.value}
      >
        <SelectTrigger id={id} aria-label="Chọn múi giờ">
          <SelectValue>
            {(item) => <span className="truncate">{item?.label}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {formattedTimezones.map((item) => (
            <SelectItem key={item.value} value={item}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

export { Particle as TimezoneSelect };
