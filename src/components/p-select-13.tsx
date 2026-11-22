export type TimezoneSelectProps = {
  id?: string;
  name?: string;
  defaultValue?: string;
  className?: string;
};

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

export default function TimezoneSelect({
  id,
  name,
  defaultValue = 'Asia/Ho_Chi_Minh',
  className,
}: TimezoneSelectProps) {
  const zones = Intl.supportedValuesOf('timeZone')
    .map(timezone => (timezone === 'Asia/Saigon' ? 'Asia/Ho_Chi_Minh' : timezone))
    .filter((timezone, index, all) => all.indexOf(timezone) === index)
    .map(timezone => ({ timezone, ...zoneOffset(timezone) }))
    .sort((a, b) => a.minutes - b.minutes || a.timezone.localeCompare(b.timezone));

  if (!zones.some(zone => zone.timezone === defaultValue)) {
    zones.push({ timezone: defaultValue, ...zoneOffset(defaultValue) });
  }

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
