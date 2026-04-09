import { TransactionRow, FeeCategory, VATByCountry } from './accountingTypes';
import { matchExplainer } from './accountingData';

// ─── 會計科目映射表 ──────────────────────────────────────────
// 依 FeeCategory 對應到建議的會計科目
export interface AccountMapping {
  category: FeeCategory;
  accountCode: string;
  accountName: string;
  accountNameEn: string;
  nature: 'revenue' | 'expense' | 'tax' | 'asset' | 'liability';
  natureLabel: string;
  natureLabelEn: string;
}

export const accountMappings: AccountMapping[] = [
  { category: 'sales', accountCode: '—', accountName: '營業收入 — 商品銷售', accountNameEn: 'Revenue — Product Sales',
    nature: 'revenue', natureLabel: '收入', natureLabelEn: 'Revenue' },
  { category: 'commission', accountCode: '—', accountName: '銷售費用 — 平台佣金', accountNameEn: 'Selling Expense — Platform Commission',
    nature: 'expense', natureLabel: '費用', natureLabelEn: 'Expense' },
  { category: 'fba', accountCode: '—', accountName: '銷售費用 — 物流配送', accountNameEn: 'Selling Expense — Fulfillment & Logistics',
    nature: 'expense', natureLabel: '費用', natureLabelEn: 'Expense' },
  { category: 'advertising', accountCode: '—', accountName: '銷售費用 — 廣告推廣', accountNameEn: 'Selling Expense — Advertising & Promotion',
    nature: 'expense', natureLabel: '費用', natureLabelEn: 'Expense' },
  { category: 'subscription', accountCode: '—', accountName: '管理費用 — 平台服務費', accountNameEn: 'Admin Expense — Platform Service Fee',
    nature: 'expense', natureLabel: '費用', natureLabelEn: 'Expense' },
  { category: 'refund', accountCode: '—', accountName: '營業收入 — 銷貨退回與折讓', accountNameEn: 'Revenue — Sales Returns & Allowances',
    nature: 'revenue', natureLabel: '收入沖減', natureLabelEn: 'Contra Revenue' },
  { category: 'tax', accountCode: '—', accountName: '應付稅款 — VAT / 其他稅', accountNameEn: 'Tax Payable — VAT / Other Tax',
    nature: 'liability', natureLabel: '負債', natureLabelEn: 'Liability' },
  { category: 'other', accountCode: '—', accountName: '其他營業費用 / 營業外收支', accountNameEn: 'Other Operating Expense / Non-operating Items',
    nature: 'expense', natureLabel: '費用', natureLabelEn: 'Expense' },
];

export const accountMappingMap: Record<FeeCategory, AccountMapping> =
  Object.fromEntries(accountMappings.map((m) => [m.category, m])) as Record<FeeCategory, AccountMapping>;


// ─── Marketplace → 國家映射 ──────────────────────────────────
const marketplaceCountryMap: Record<string, { country: string; countryCode: string }> = {
  'amazon.de': { country: '德國 Germany', countryCode: 'DE' },
  'amazon.fr': { country: '法國 France', countryCode: 'FR' },
  'amazon.it': { country: '義大利 Italy', countryCode: 'IT' },
  'amazon.es': { country: '西班牙 Spain', countryCode: 'ES' },
  'amazon.co.uk': { country: '英國 United Kingdom', countryCode: 'UK' },
  'amazon.nl': { country: '荷蘭 Netherlands', countryCode: 'NL' },
  'amazon.se': { country: '瑞典 Sweden', countryCode: 'SE' },
  'amazon.pl': { country: '波蘭 Poland', countryCode: 'PL' },
  'amazon.com.be': { country: '比利時 Belgium', countryCode: 'BE' },
  'amazon.com.tr': { country: '土耳其 Turkey', countryCode: 'TR' },
};

function resolveCountry(marketplace: string): { country: string; countryCode: string } {
  const mp = marketplace.toLowerCase().trim();
  for (const [key, val] of Object.entries(marketplaceCountryMap)) {
    if (mp.includes(key) || mp.includes(val.countryCode.toLowerCase())) return val;
  }
  // 嘗試從 marketplace 名稱推斷
  if (mp.includes('de') || mp.includes('germany') || mp.includes('deutsch')) return marketplaceCountryMap['amazon.de'];
  if (mp.includes('fr') || mp.includes('france')) return marketplaceCountryMap['amazon.fr'];
  if (mp.includes('it') || mp.includes('ital')) return marketplaceCountryMap['amazon.it'];
  if (mp.includes('es') || mp.includes('spain') || mp.includes('españa')) return marketplaceCountryMap['amazon.es'];
  if (mp.includes('uk') || mp.includes('united kingdom') || mp.includes('co.uk')) return marketplaceCountryMap['amazon.co.uk'];
  if (mp.includes('nl') || mp.includes('nether')) return marketplaceCountryMap['amazon.nl'];
  if (mp.includes('se') || mp.includes('sweden')) return marketplaceCountryMap['amazon.se'];
  if (mp.includes('pl') || mp.includes('poland')) return marketplaceCountryMap['amazon.pl'];
  return { country: marketplace || 'Unknown', countryCode: '??' };
}

// ─── VAT 按國家拆分 ─────────────────────────────────────────
export function computeVATByCountry(rows: TransactionRow[]): VATByCountry[] {
  const map: Record<string, VATByCountry> = {};

  for (const r of rows) {
    const { country, countryCode } = resolveCountry(r.marketplace);
    if (!map[countryCode]) {
      map[countryCode] = {
        country, countryCode,
        salesGross: 0, salesNet: 0, vatCollected: 0,
        shippingRevenue: 0, shippingTax: 0, refunds: 0,
        currency: r.currency, transactionCount: 0,
      };
    }
    const entry = map[countryCode];
    entry.transactionCount++;

    const exp = matchExplainer(r.amountDescription);
    const key = exp?.key ?? r.amountDescription;

    switch (key) {
      case 'Principal':
        entry.salesGross += r.amount;
        entry.salesNet += r.amount;
        break;
      case 'Tax':
        entry.vatCollected += r.amount;
        entry.salesGross += r.amount; // gross includes VAT
        break;
      case 'Shipping':
        entry.shippingRevenue += r.amount;
        break;
      case 'ShippingTax':
        entry.shippingTax += r.amount;
        break;
      case 'RefundPrincipal':
      case 'RefundShipping':
      case 'RefundGiftWrap':
        entry.refunds += r.amount;
        break;
      case 'RefundTax':
      case 'RefundShippingTax':
        entry.vatCollected += r.amount; // negative refund reduces VAT
        break;
      default:
        break;
    }
  }

  return Object.values(map).sort((a, b) => Math.abs(b.salesGross) - Math.abs(a.salesGross));
}


// ─── CSV 匯出 ────────────────────────────────────────────────

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCSVRow(cells: string[]): string {
  return cells.map(escapeCSV).join(',');
}

function downloadCSV(filename: string, content: string) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 匯出會計科目彙總 CSV */
export function exportAccountingSummaryCSV(
  rows: TransactionRow[],
  byCategory: Record<FeeCategory, number>,
  currency: string,
  isEn: boolean
) {
  const header = isEn
    ? ['Account Name', 'Nature', 'Category', 'Amount', 'Currency']
    : ['會計科目名稱', '科目性質', '費用分類', '金額', '幣別'];

  const lines = [toCSVRow(header)];
  for (const m of accountMappings) {
    const val = byCategory[m.category] ?? 0;
    if (val === 0) continue;
    lines.push(toCSVRow([
      isEn ? m.accountNameEn : m.accountName,
      isEn ? m.natureLabelEn : m.natureLabel,
      isEn ? m.category : m.accountName.split('—')[0].trim(),
      val.toFixed(2),
      currency,
    ]));
  }

  downloadCSV('amazon-accounting-summary.csv', lines.join('\n'));
}

/** 匯出 VAT 按國家拆分 CSV */
export function exportVATByCountryCSV(vatData: VATByCountry[], isEn: boolean) {
  const header = isEn
    ? ['Country', 'Code', 'Gross Sales', 'Net Sales', 'VAT Collected', 'Shipping Revenue', 'Shipping Tax', 'Refunds', 'Currency', 'Transactions']
    : ['國家', '代碼', '含稅銷售額', '不含稅銷售額', 'VAT 稅額', '運費收入', '運費稅金', '退款', '幣別', '交易筆數'];

  const lines = [toCSVRow(header)];
  for (const v of vatData) {
    lines.push(toCSVRow([
      v.country, v.countryCode,
      v.salesGross.toFixed(2), v.salesNet.toFixed(2), v.vatCollected.toFixed(2),
      v.shippingRevenue.toFixed(2), v.shippingTax.toFixed(2), v.refunds.toFixed(2),
      v.currency, String(v.transactionCount),
    ]));
  }

  downloadCSV('amazon-vat-by-country.csv', lines.join('\n'));
}

/** 匯出完整交易明細 CSV */
export function exportTransactionDetailCSV(rows: TransactionRow[], isEn: boolean) {
  const header = isEn
    ? ['Date', 'Order ID', 'SKU', 'Transaction Type', 'Amount Type', 'Description', 'Amount', 'Currency', 'Marketplace', 'Category', 'Suggested Account']
    : ['日期', '訂單編號', 'SKU', '交易類型', '金額類型', '科目描述', '金額', '幣別', '市場', '費用分類', '建議會計科目'];

  const lines = [toCSVRow(header)];
  for (const r of rows) {
    const exp = matchExplainer(r.amountDescription);
    const cat = exp?.category ?? 'other';
    const mapping = accountMappingMap[cat];
    lines.push(toCSVRow([
      r.date, r.orderId, r.sku, r.transactionType, r.amountType, r.amountDescription,
      r.amount.toFixed(2), r.currency, r.marketplace,
      isEn ? cat : (mapping?.accountName.split('—')[0].trim() ?? cat),
      isEn ? (mapping?.accountNameEn ?? '') : (mapping?.accountName ?? ''),
    ]));
  }

  downloadCSV('amazon-transaction-detail.csv', lines.join('\n'));
}
