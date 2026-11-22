export type TimezoneSelectProps = {
  id?: string;
  name?: string;
  defaultValue?: string;
  className?: string;
};

type ZoneMeta = { timezone: string; label: string; minutes: number };
let cachedZones: ZoneMeta[] | null = null;

function zoneOffset(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
  const offset = formatter.formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value || 'GMT';
  const match = offset.match(/GMT([+-]?)(\d+)?(?::(\d+))?/);
  const sign = match?.[1] === '-' ? -1 : 1;
  return {
    label: offset === 'GMT' ? 'GMT+0' : offset,
    minutes: sign * (Number(match?.[2] || 0) * 60 + Number(match?.[3] || 0)),
  };
}

function getZones(): ZoneMeta[] {
  if (cachedZones) return cachedZones;
  const seen = new Set<string>();
  const list: ZoneMeta[] = [];
  for (const raw of Intl.supportedValuesOf('timeZone')) {
    const timezone = raw === 'Asia/Saigon' ? 'Asia/Ho_Chi_Minh' : raw;
    if (seen.has(timezone)) continue;
    seen.add(timezone);
    list.push({ timezone, ...zoneOffset(timezone) });
  }
  list.sort((a, b) => a.minutes - b.minutes || a.timezone.localeCompare(b.timezone));
  cachedZones = list;
  return list;
}

export default function TimezoneSelect({
  id,
  name,
  defaultValue = 'Asia/Ho_Chi_Minh',
  className,
}: TimezoneSelectProps) {
  const baseZones = getZones();
  const zones = baseZones.some(zone => zone.timezone === defaultValue)
    ? baseZones
    : [...baseZones, { timezone: defaultValue, ...zoneOffset(defaultValue) }];

  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={`input min-h-[38px] ${className ?? ''}`}
      aria-label="Chọn múi giờ"
    >
      {zones.map(zone => (
        <option key={zone.timezone} value={zone.timezone}>
          ({zone.label}) {zone.timezone.replaceAll('_', ' ')}
        </option>
      ))}
    </select>
  );
}

export { TimezoneSelect };
