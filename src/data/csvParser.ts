import { TransactionRow, AccountingSummary, FeeCategory } from './accountingTypes';
import { matchExplainer } from './accountingData';

/**
 * 解析 CSV / TSV 文字內容為交易列陣列
 * 支援 Amazon Settlement Report 的 v2 flat file 格式
 */
export function parseSettlementCSV(text: string): TransactionRow[] {
  // 偵測分隔符號：tab 優先（Amazon 預設 TSV），否則用逗號
  const firstLine = text.split('\n')[0] ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const lines = splitCSVLines(text, delimiter);
  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.trim().toLowerCase().replace(/["\s-]/g, ''));
  const rows: TransactionRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    if (cols.length < 3) continue;

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = (cols[idx] ?? '').trim().replace(/^"|"$/g, '');
    });

    const amount = parseAmount(
      findCol(raw, ['amount', 'total', 'transactionamount', 'itemrelatedfeeamount', 'otheramount', 'directpaymentamount'])
    );

    // 跳過金額為 0 且無有意義資料的列
    if (amount === 0 && !findCol(raw, ['orderId', 'orderid'])) continue;

    rows.push({
      raw,
      date: findCol(raw, ['posteddate', 'posteddatetime', 'date', 'settlementstartdate', 'posteddt']),
      orderId: findCol(raw, ['orderid', 'order id', 'amazonorderid']),
      sku: findCol(raw, ['sku', 'merchantsku', 'sellersku']),
      transactionType: findCol(raw, ['transactiontype', 'type']),
      amountType: findCol(raw, ['amounttype', 'feetype', 'fufillmentid']),
      amountDescription: findCol(raw, ['amountdescription', 'feedescription', 'description', 'chargedescription']),
      amount,
      currency: findCol(raw, ['currency', 'currencycode', 'marketplacecurrency']) || 'EUR',
      marketplace: findCol(raw, ['marketplace', 'marketplacename', 'storename']),
    });
  }

  return rows;
}

/** 將交易列彙總為 AccountingSummary */
export function summarizeTransactions(rows: TransactionRow[]): AccountingSummary {
  const byCategory: Record<FeeCategory, number> = {
    sales: 0, fba: 0, commission: 0, advertising: 0,
    subscription: 0, refund: 0, tax: 0, other: 0,
  };
  const byItem: Record<string, number> = {};
  const currencies = new Set<string>();

  for (const row of rows) {
    currencies.add(row.currency);
    const explainer = matchExplainer(row.amountDescription);
    const cat: FeeCategory = explainer?.category ?? guessCategory(row);
    byCategory[cat] += row.amount;

    const itemKey = explainer?.label ?? (row.amountDescription || '未分類');
    byItem[itemKey] = (byItem[itemKey] ?? 0) + row.amount;
  }

  return {
    currency: currencies.size === 1 ? [...currencies][0] : [...currencies].join(' / ') || 'EUR',
    totalSales: byCategory.sales,
    totalFBA: byCategory.fba,
    totalCommission: byCategory.commission,
    totalAdvertising: byCategory.advertising,
    totalSubscription: byCategory.subscription,
    totalRefund: byCategory.refund,
    totalTax: byCategory.tax,
    totalOther: byCategory.other,
    netProceeds: Object.values(byCategory).reduce((a, b) => a + b, 0),
    byCategory,
    byItem,
    rowCount: rows.length,
  };
}

// ─── 內部工具函式 ─────────────────────────────────────────────

function splitCSVLines(text: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        current.push(field);
        field = '';
        if (current.some((c) => c.trim())) result.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.some((c) => c.trim())) result.push(current);
  return result;
}

function findCol(raw: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const key = c.replace(/[\s-]/g, '').toLowerCase();
    if (raw[key] !== undefined && raw[key] !== '') return raw[key];
  }
  return '';
}

function parseAmount(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.\-,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function guessCategory(row: TransactionRow): FeeCategory {
  const desc = (row.amountDescription + ' ' + row.amountType + ' ' + row.transactionType).toLowerCase();
  if (/refund|return|reversal/i.test(desc)) return 'refund';
  if (/fba|fulfil|storage|removal|disposal|warehouse/i.test(desc)) return 'fba';
  if (/commission|referral|closing/i.test(desc)) return 'commission';
  if (/advertis|sponsor|coupon|deal|lightning/i.test(desc)) return 'advertising';
  if (/subscri|monthly/i.test(desc)) return 'subscription';
  if (/tax|vat|ioss|epr|regulatory/i.test(desc)) return 'tax';
  if (/principal|shipping|product.*charge|giftwrap/i.test(desc)) return 'sales';
  return 'other';
}
