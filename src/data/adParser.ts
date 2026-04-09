import { AdRow, AdSummary, KeywordPerformance } from './adTypes';

/**
 * Parse Amazon Sponsored Products Bulk Report (CSV/TSV)
 * Supports both "Search term report" and "Targeting report" formats
 */
export function parseAdReport(text: string): AdRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect delimiter
  const header = lines[0];
  const delim = header.includes('\t') ? '\t' : ',';
  const cols = parseLine(header, delim).map(c => c.toLowerCase().trim());

  // Map column names (Amazon uses various names across locales)
  const colMap: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    date: ['date', 'start date', 'day'],
    campaignName: ['campaign name', 'campaign'],
    adGroupName: ['ad group name', 'ad group'],
    targeting: ['targeting', 'customer search term', 'search term', 'keyword'],
    matchType: ['match type'],
    impressions: ['impressions'],
    clicks: ['clicks'],
    spend: ['spend', 'cost'],
    sales: ['7 day total sales', '14 day total sales', 'total sales', 'sales'],
    orders: ['7 day total orders (#)', '14 day total orders (#)', 'total orders', 'orders'],
    currency: ['currency'],
  };

  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      const idx = cols.indexOf(name);
      if (idx >= 0) { colMap[key] = idx; break; }
    }
  }

  // Must have at least spend and impressions
  if (colMap.impressions === undefined && colMap.clicks === undefined) return [];

  const rows: AdRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i], delim);
    if (vals.length < 3) continue;

    const get = (key: string) => vals[colMap[key]] ?? '';
    const num = (key: string) => {
      const v = get(key).replace(/[^0-9.\-]/g, '');
      return parseFloat(v) || 0;
    };

    const impressions = num('impressions');
    const clicks = num('clicks');
    const spend = num('spend');
    const sales = num('sales');
    const orders = num('orders');

    // Skip rows with no data
    if (impressions === 0 && clicks === 0 && spend === 0) continue;

    rows.push({
      date: get('date'),
      campaignName: get('campaignName'),
      adGroupName: get('adGroupName'),
      targeting: get('targeting') || get('adGroupName'),
      matchType: get('matchType') || 'AUTO',
      impressions,
      clicks,
      spend,
      sales,
      orders,
      acos: sales > 0 ? (spend / sales) * 100 : spend > 0 ? 999 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
      currency: get('currency') || 'EUR',
    });
  }

  return rows;
}

function parseLine(line: string, delim: string): string[] {
  if (delim === '\t') return line.split('\t').map(s => s.trim().replace(/^"|"$/g, ''));
  // Simple CSV parse
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

export function summarizeAdReport(rows: AdRow[]): AdSummary {
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const dates = rows.map(r => r.date).filter(Boolean).sort();

  return {
    totalSpend,
    totalSales,
    totalImpressions,
    totalClicks,
    totalOrders,
    overallAcos: totalSales > 0 ? (totalSpend / totalSales) * 100 : 0,
    overallCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    overallCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    overallConversionRate: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
    currency: rows[0]?.currency || 'EUR',
    rowCount: rows.length,
    dateRange: { from: dates[0] || '', to: dates[dates.length - 1] || '' },
  };
}

export function analyzeKeywords(rows: AdRow[]): KeywordPerformance[] {
  const map: Record<string, KeywordPerformance> = {};
  for (const r of rows) {
    const key = `${r.targeting}||${r.matchType}`;
    if (!map[key]) {
      map[key] = {
        keyword: r.targeting,
        matchType: r.matchType,
        impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, acos: 0,
        campaigns: [],
      };
    }
    const kw = map[key];
    kw.impressions += r.impressions;
    kw.clicks += r.clicks;
    kw.spend += r.spend;
    kw.sales += r.sales;
    kw.orders += r.orders;
    if (!kw.campaigns.includes(r.campaignName)) kw.campaigns.push(r.campaignName);
  }

  return Object.values(map).map(kw => ({
    ...kw,
    acos: kw.sales > 0 ? (kw.spend / kw.sales) * 100 : kw.spend > 0 ? 999 : 0,
  })).sort((a, b) => b.spend - a.spend);
}
