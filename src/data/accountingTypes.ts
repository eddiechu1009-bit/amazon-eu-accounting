/** Amazon EU Settlement Report 帳務分析相關型別 */

export interface TransactionRow {
  /** 原始列資料 */
  raw: Record<string, string>;
  /** 結算日期 */
  date: string;
  /** 訂單編號 */
  orderId: string;
  /** SKU */
  sku: string;
  /** 交易類型 (Order / Refund / Service Fee 等) */
  transactionType: string;
  /** 金額類型 (ProductCharges / FBA fees 等) */
  amountType: string;
  /** 科目描述 */
  amountDescription: string;
  /** 金額 */
  amount: number;
  /** 幣別 */
  currency: string;
  /** 市場 */
  marketplace: string;
}

export type FeeCategory =
  | 'sales'
  | 'fba'
  | 'commission'
  | 'advertising'
  | 'subscription'
  | 'refund'
  | 'tax'
  | 'other';

export interface FeeCategoryInfo {
  id: FeeCategory;
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  description: string;
  descriptionEn: string;
}

export interface FeeItemExplainer {
  /** Settlement Report 中的 amount-description 值 */
  key: string;
  /** 中文名稱 */
  label: string;
  /** 英文名稱 */
  labelEn: string;
  /** 歸屬分類 */
  category: FeeCategory;
  /** 中文說明 */
  description: string;
  /** 英文說明 */
  descriptionEn: string;
  /** 計費邏輯（中文） */
  formula?: string;
  /** 計費邏輯（英文） */
  formulaEn?: string;
  /** 建議會計科目代碼 */
  accountCode?: string;
  /** 建議會計科目名稱（中文） */
  accountName?: string;
  /** 建議會計科目名稱（英文） */
  accountNameEn?: string;
}

/** VAT 按國家拆分結果 */
export interface VATByCountry {
  country: string;
  countryCode: string;
  salesGross: number;
  salesNet: number;
  vatCollected: number;
  shippingRevenue: number;
  shippingTax: number;
  refunds: number;
  currency: string;
  transactionCount: number;
}

export interface AccountingSummary {
  currency: string;
  totalSales: number;
  totalFBA: number;
  totalCommission: number;
  totalAdvertising: number;
  totalSubscription: number;
  totalRefund: number;
  totalTax: number;
  totalOther: number;
  netProceeds: number;
  byCategory: Record<FeeCategory, number>;
  byItem: Record<string, number>;
  rowCount: number;
}
