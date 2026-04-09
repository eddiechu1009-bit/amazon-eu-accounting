import { InventoryRow, RestockResult } from './inventoryTypes';

/**
 * Parse Amazon Inventory Health Report (CSV/TSV)
 * Also supports FBA Manage Inventory / Inventory Planning reports
 */
export function parseInventoryReport(text: string): InventoryRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0];
  const delim = header.includes('\t') ? '\t' : ',';
  const cols = parseLine(header, delim).map(c => c.toLowerCase().trim());

  const colMap: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    sku: ['sku', 'seller-sku', 'seller sku', 'msku'],
    asin: ['asin'],
    productName: ['product-name', 'product name', 'title', 'item-name', 'item name'],
    available: ['afn-fulfillable-quantity', 'available', 'fulfillable-quantity', 'afn fulfillable quantity'],
    inbound: ['afn-inbound-working-quantity', 'inbound', 'afn-inbound-shipped-quantity', 'inbound working', 'afn inbound working quantity'],
    reserved: ['afn-reserved-quantity', 'reserved', 'afn reserved quantity'],
    unfulfillable: ['afn-unsellable-quantity', 'unfulfillable', 'afn unsellable quantity'],
    sales7d: ['units-shipped-last-7-days', 'sales-last-7-days', 'units shipped last 7 days', 'your-price-units-shipped-last-7-days'],
    sales30d: ['units-shipped-last-30-days', 'sales-last-30-days', 'units shipped last 30 days', 'your-price-units-shipped-last-30-days'],
    sales60d: ['units-shipped-last-60-days', 'sales-last-60-days', 'units shipped last 60 days'],
    sales90d: ['units-shipped-last-90-days', 'sales-last-90-days', 'units shipped last 90 days', 'your-price-units-shipped-last-90-days'],
    daysOfSupply: ['days-of-supply', 'estimated-days-of-supply', 'days of supply'],
    marketplace: ['marketplace', 'marketplace-id'],
  };

  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      const idx = cols.indexOf(name);
      if (idx >= 0) { colMap[key] = idx; break; }
    }
  }

  if (colMap.sku === undefined && colMap.asin === undefined) return [];

  const rows: InventoryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i], delim);
    if (vals.length < 3) continue;

    const get = (key: string) => vals[colMap[key]] ?? '';
    const num = (key: string) => {
      const v = get(key).replace(/[^0-9.\-]/g, '');
      return parseInt(v) || 0;
    };

    const sku = get('sku');
    const asin = get('asin');
    if (!sku && !asin) continue;

    rows.push({
      sku: sku || asin,
      asin,
      productName: get('productName') || sku,
      available: num('available'),
      inbound: num('inbound'),
      reserved: num('reserved'),
      unfulfillable: num('unfulfillable'),
      sales7d: num('sales7d'),
      sales30d: num('sales30d'),
      sales60d: num('sales60d'),
      sales90d: num('sales90d'),
      daysOfSupply: num('daysOfSupply'),
      marketplace: get('marketplace'),
    });
  }

  return rows;
}

function parseLine(line: string, delim: string): string[] {
  if (delim === '\t') return line.split('\t').map(s => s.trim().replace(/^"|"$/g, ''));
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

/**
 * Calculate restock recommendations
 */
export function calcRestock(
  rows: InventoryRow[],
  leadTimeDays: number,
  safetyStockDays: number,
  targetStockDays: number,
): RestockResult[] {
  const today = new Date();

  return rows.map(row => {
    // Calculate daily sales (prefer 30d, fallback to 7d*4.3, then 60d, 90d)
    let dailySales = 0;
    if (row.sales30d > 0) dailySales = row.sales30d / 30;
    else if (row.sales7d > 0) dailySales = row.sales7d / 7;
    else if (row.sales60d > 0) dailySales = row.sales60d / 60;
    else if (row.sales90d > 0) dailySales = row.sales90d / 90;

    const totalAvailable = row.available + row.inbound;
    const daysOfStock = dailySales > 0 ? Math.round(totalAvailable / dailySales) : (totalAvailable > 0 ? 999 : 0);

    // When to restock: when stock drops to (leadTime + safety) days
    const restockTriggerDays = leadTimeDays + safetyStockDays;
    const daysUntilRestock = dailySales > 0 ? Math.max(0, daysOfStock - restockTriggerDays) : 999;
    const restockDate = new Date(today);
    restockDate.setDate(restockDate.getDate() + daysUntilRestock);

    // How much to restock: enough for targetStockDays of sales
    const restockQty = dailySales > 0
      ? Math.max(0, Math.ceil(dailySales * targetStockDays - totalAvailable + dailySales * leadTimeDays))
      : 0;

    // Status
    let status: RestockResult['status'] = 'ok';
    if (dailySales === 0 && totalAvailable === 0) status = 'no-sales';
    else if (dailySales === 0 && totalAvailable > 0) status = 'no-sales';
    else if (daysOfStock <= restockTriggerDays) status = 'urgent';
    else if (daysOfStock <= restockTriggerDays + 14) status = 'soon';
    else if (daysOfStock > targetStockDays * 2) status = 'overstock';

    return {
      sku: row.sku,
      asin: row.asin,
      productName: row.productName,
      available: row.available,
      inbound: row.inbound,
      dailySales: Math.round(dailySales * 100) / 100,
      daysOfStock,
      restockDate: restockDate.toISOString().split('T')[0],
      restockQty,
      status,
    };
  }).sort((a, b) => {
    const order = { urgent: 0, soon: 1, ok: 2, overstock: 3, 'no-sales': 4 };
    return order[a.status] - order[b.status] || a.daysOfStock - b.daysOfStock;
  });
}

/** Export restock results as CSV */
export function exportRestockCSV(results: RestockResult[], isEn: boolean) {
  const statusLabel = (s: RestockResult['status']) => {
    const map = isEn
      ? { urgent: 'URGENT', soon: 'Restock Soon', ok: 'OK', overstock: 'Overstock', 'no-sales': 'No Sales' }
      : { urgent: '🚨 緊急補貨', soon: '⚠️ 即將需要補貨', ok: '✅ 正常', overstock: '📦 庫存過多', 'no-sales': '— 無銷量' };
    return map[s];
  };

  const headers = isEn
    ? ['SKU', 'ASIN', 'Product Name', 'Available', 'Inbound', 'Daily Sales', 'Days of Stock', 'Restock Date', 'Restock Qty', 'Status']
    : ['SKU', 'ASIN', '商品名稱', '可售庫存', '入倉中', '日均銷量', '可售天數', '建議補貨日', '建議補貨量', '狀態'];

  const rows = results.map(r => [
    r.sku, r.asin, `"${r.productName}"`, r.available, r.inbound,
    r.dailySales, r.daysOfStock, r.restockDate, r.restockQty, statusLabel(r.status),
  ].join(','));

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `restock-plan-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
