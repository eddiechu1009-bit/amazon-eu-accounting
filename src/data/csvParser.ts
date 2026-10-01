import { TransactionRow, AccountingSummary, FeeCategory } from './accountingTypes';
import { matchExplainer } from './accountingData';

/** 匯入時無法確定的金額：不計入彙總，列給使用者到原檔確認 */
export interface AmountWarning {
  line: number;        // 檔案中的列號（含標題列，從 1 起算）
  raw: string;         // 原始金額字串
  reason: 'ambiguous' | 'invalid';
  orderId: string;
  description: string;
}

export interface ParseResult {
  rows: TransactionRow[];
  warnings: AmountWarning[];
  numberFormat: NumberFormat | 'mixed' | 'unknown';
}

/**
 * 解析 CSV / TSV 文字內容為交易列陣列
 * 支援 Amazon Settlement Report 的 v2 flat file 格式
 *
 * 金額格式依報表語系而定（英國站 1,234.56；德法義西站 1.234,56）。
 * 「1,234」「1.234」單看一格無法判斷，所以先掃整個金額欄判定格式，再逐格嚴格解析；
 * 仍無法判定或格式不對的，不計入彙總、放進 warnings 讓使用者到原檔確認 —— 不會靜默當成 0 或截一半。
 */
export function parseSettlementReport(text: string): ParseResult {
  // 偵測分隔符號：tab 優先（Amazon 預設 TSV），否則用逗號
  const firstLine = text.split('\n')[0] ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const { rows: lines, lineNos } = splitCSVLines(text, delimiter);
  if (lines.length < 2) return { rows: [], warnings: [], numberFormat: 'unknown' };

  const headers = lines[0].map((h) => h.trim().toLowerCase().replace(/["\s-]/g, ''));
  const pending: { line: number; raw: Record<string, string>; amountStr: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    if (cols.length < 3) continue;

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = (cols[idx] ?? '').trim().replace(/^"|"$/g, '');
    });
    const amountStr = findCol(raw, ['amount', 'total', 'transactionamount', 'itemrelatedfeeamount', 'otheramount', 'directpaymentamount']);
    pending.push({ line: lineNos[i], raw, amountStr });
  }

  const numberFormat = detectNumberFormat(
    pending.map((p) => p.amountStr),
    pending.map((p) => findCol(p.raw, ['marketplace', 'marketplacename', 'storename'])),
  );
  const fmt: NumberFormat | null = numberFormat === 'en' || numberFormat === 'eu' ? numberFormat : null;

  const rows: TransactionRow[] = [];
  const warnings: AmountWarning[] = [];
  for (const { line, raw, amountStr } of pending) {
    const orderId = findCol(raw, ['orderid', 'order id', 'amazonorderid']);
    const amountDescription = findCol(raw, ['amountdescription', 'feedescription', 'description', 'chargedescription']);
    if (!amountStr.trim()) {
      if (orderId) warnings.push({ line, raw: amountStr, reason: 'invalid', orderId, description: amountDescription });
      continue;
    }
    const parsed = parseAmountStrict(amountStr, fmt);
    if (parsed.value === null) {
      warnings.push({ line, raw: amountStr, reason: parsed.reason ?? 'invalid', orderId, description: amountDescription });
      continue;
    }
    const amount = parsed.value;

    // 跳過金額為 0 且無有意義資料的列
    if (amount === 0 && !orderId) continue;

    rows.push({
      raw,
      date: findCol(raw, ['posteddate', 'posteddatetime', 'date', 'settlementstartdate', 'posteddt']),
      orderId,
      sku: findCol(raw, ['sku', 'merchantsku', 'sellersku']),
      transactionType: findCol(raw, ['transactiontype', 'type']),
      amountType: findCol(raw, ['amounttype', 'feetype', 'fufillmentid']),
      amountDescription,
      amount,
      currency: findCol(raw, ['currency', 'currencycode', 'marketplacecurrency']) || 'EUR',
      marketplace: findCol(raw, ['marketplace', 'marketplacename', 'storename']),
    });
  }

  return { rows, warnings, numberFormat };
}

/** 舊介面：只回傳可確定金額的交易列 */
export function parseSettlementCSV(text: string): TransactionRow[] {
  return parseSettlementReport(text).rows;
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

/** 回傳每一筆紀錄，以及它在檔案中的實際起始列號（1 起算；空白行、引號內換行都會算進去） */
function splitCSVLines(text: string, delimiter: string): { rows: string[][]; lineNos: number[] } {
  const result: string[][] = [];
  const lineNos: number[] = [];
  let physical = 1;
  let startLine = 1;
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
        // 引號內換行也要算列號：\r\n 算一次、單獨的 \r 或 \n 各算一次
        if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) physical++;
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
        if (current.some((c) => c.trim())) { result.push(current); lineNos.push(startLine); }
        current = [];
        physical++;
        startLine = physical;
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.some((c) => c.trim())) { result.push(current); lineNos.push(startLine); }
  return { rows: result, lineNos };
}

function findCol(raw: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const key = c.replace(/[\s-]/g, '').toLowerCase();
    if (raw[key] !== undefined && raw[key] !== '') return raw[key];
  }
  return '';
}

/** en：1,234.56（點是小數點）；eu：1.234,56（逗號是小數點） */
export type NumberFormat = 'en' | 'eu';

const RE_INT = /^\d+$/;
const RE_DOT_DEC = /^\d+\.\d+$/;                     // 1234.56 / 1.234（也可能是歐式千分位）
const RE_COMMA_DEC = /^\d+,\d+$/;                    // 1234,56 / 1,234（也可能是英式千分位）
const RE_EN_GROUPED = /^\d{1,3}(,\d{3})+(\.\d+)?$/;  // 1,234 / 1,234,567.89
const RE_EU_GROUPED = /^\d{1,3}(\.\d{3})+(,\d+)?$/;  // 1.234 / 1.234.567,89
// 只認幣別代碼與符號；其他字母（例如 12abc）一律視為格式錯誤
const CUR = /^(?:EUR|GBP|USD|SEK|PLN|CZK|TRY|DKK|CHF|€|£|\$)|(?:EUR|GBP|USD|SEK|PLN|CZK|TRY|DKK|CHF|€|£|\$)$/gi;

/** 去掉幣別符號、空白（含不換行空白）、撇號千分位，並取出正負號（-12、12-、(12)） */
function normalizeAmountText(val: string): { body: string; neg: boolean } | null {
  let s = val.trim().replace(/[\s\u00a0\u202f'\u2019]/g, '').replace(CUR, '');
  // 負數只接受一種寫法：(12)、-12、12-；重複符號（(-12)、-12-）視為格式錯誤
  let marks = 0;
  if (/^\(.*\)$/.test(s)) { marks++; s = s.slice(1, -1).replace(CUR, ''); }
  if (s.startsWith('-') || s.startsWith('\u2212')) { marks++; s = s.slice(1).replace(CUR, ''); }
  else if (s.startsWith('+')) s = s.slice(1).replace(CUR, '');
  if (s.endsWith('-')) { marks++; s = s.slice(0, -1).replace(CUR, ''); }
  if (marks > 1 || !/^[\d.,]+$/.test(s)) return null;
  return { body: s, neg: marks === 1 };
}

/** 這個金額字串本身透露的格式：en／eu／兩者皆可（either）／不合格式（invalid） */
export function classifyAmount(val: string): NumberFormat | 'either' | 'invalid' | 'empty' {
  if (!val.trim()) return 'empty';
  const n = normalizeAmountText(val);
  if (!n) return 'invalid';
  const s = n.body;
  if (RE_INT.test(s)) return 'either';
  const en = (RE_DOT_DEC.test(s) || RE_EN_GROUPED.test(s)) && Number.isFinite(Number(s.replace(/,/g, '')));
  const eu = (RE_COMMA_DEC.test(s) || RE_EU_GROUPED.test(s)) && Number.isFinite(Number(s.replace(/\./g, '').replace(',', '.')));
  if (en && eu) return 'either';
  if (en) return 'en';
  if (eu) return 'eu';
  return 'invalid';
}

/**
 * 判定整欄的數字格式：先看金額欄有沒有只可能是某一種格式的值（例如 12,50 或 1,234.56）；
 * 整欄都只有歧義值時，才退回看 marketplace（amazon.co.uk → en；amazon.de/fr/it/es → eu）。
 */
export function detectNumberFormat(values: string[], marketplaces: string[] = []): NumberFormat | 'mixed' | 'unknown' {
  let en = 0, eu = 0;
  for (const v of values) {
    const c = classifyAmount(v);
    if (c === 'en') en++;
    else if (c === 'eu') eu++;
  }
  if (en && eu) return 'mixed';
  if (en) return 'en';
  if (eu) return 'eu';
  const mk = marketplaces.join(' ').toLowerCase();
  const ukHint = /amazon\.co\.uk/.test(mk);
  const euHint = /amazon\.(de|fr|it|es|nl|se|pl|com\.be)\b/.test(mk);
  if (ukHint && !euHint) return 'en';
  if (euHint && !ukHint) return 'eu';
  return 'unknown';
}

/**
 * 嚴格解析金額。整串都要符合某一種數字寫法，不接受「前綴看起來像數字」的部分解析：
 *   1,234.56 / 1.234,56 / 1234,56 / 1234.56 / -12.34 / (12.34) / 1,234,567 / 1.234.567
 * 「1,234」「1.234」這種兩種讀法都通的，要靠 fmt（整欄判定的格式）決定；fmt 為 null 時回傳 ambiguous。
 */
export function parseAmountStrict(val: string, fmt: NumberFormat | null): { value: number | null; reason?: 'ambiguous' | 'invalid' } {
  if (!val || !val.trim()) return { value: 0 };
  const n = normalizeAmountText(val);
  if (!n) return { value: null, reason: 'invalid' };
  const s = n.body;

  const asEn = (RE_INT.test(s) || RE_DOT_DEC.test(s) || RE_EN_GROUPED.test(s)) ? Number(s.replace(/,/g, '')) : null;
  const asEu = (RE_INT.test(s) || RE_COMMA_DEC.test(s) || RE_EU_GROUPED.test(s)) ? Number(s.replace(/\./g, '').replace(',', '.')) : null;

  let num: number | null;
  if (asEn !== null && asEu !== null) {
    if (asEn === asEu) num = asEn;
    else if (fmt === 'en') num = asEn;
    else if (fmt === 'eu') num = asEu;
    else return { value: null, reason: 'ambiguous' };
  } else {
    num = asEn ?? asEu;
  }
  if (num === null || !Number.isFinite(num)) return { value: null, reason: 'invalid' };
  return { value: n.neg ? -num : num };
}

export function guessCategory(row: TransactionRow): FeeCategory {
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
