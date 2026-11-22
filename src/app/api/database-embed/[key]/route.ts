import { databaseConfig } from '@/features/database/config';
import { loadDatabase } from '@/features/database/queries';
import { propertyValue, type DataRow } from '@/features/database/rules';
import { resolveStatusOrSelectDisplay, rowTitle } from '@/features/database/status';
import type { DatabaseKey } from '@/types/database';

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(key in databaseConfig)) return Response.json({ error: 'Unknown database' }, { status: 404 });
  try {
    const databaseKey = key as DatabaseKey;
    const data = await loadDatabase(databaseKey);
    const config = databaseConfig[databaseKey];
    const groupProperty = config.groupKey
      ? data.properties.find(p => p.property_key === config.groupKey)
      : undefined;

    return Response.json(
      {
        title: config.title,
        count: data.rows.length,
        rows: data.rows.slice(0, 30).map(rawRow => {
          const row = rawRow as DataRow;
          const groupRaw = config.groupKey ? propertyValue(row, config.groupKey) : null;
          let statusLabel: string | null = null;
          let statusColor: string | null = null;
          if (groupRaw != null && groupRaw !== '') {
            if (groupProperty?.property_type === 'relation') {
              const target = String(groupProperty.configuration.target ?? '');
              statusLabel = data.lookups[target]?.[String(groupRaw)] ?? String(groupRaw);
            } else if (groupProperty) {
              const resolved = resolveStatusOrSelectDisplay(databaseKey, groupProperty, String(groupRaw), data.options);
              statusLabel = resolved.label;
              statusColor = resolved.color ?? null;
            } else {
              statusLabel = String(groupRaw);
            }
          }
          return {
            id: row.id,
            title: rowTitle(row, databaseKey, data.lookups),
            status: statusLabel,
            statusColor,
            date: config.dateKey ? String(propertyValue(row, config.dateKey) ?? '') || null : null,
          };
        }),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return Response.json({ error: 'Not available' }, { status: 401 });
  }
}
