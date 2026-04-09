/** Amazon Sponsored Products 廣告報告分析型別 */

export interface AdRow {
  date: string;
  campaignName: string;
  adGroupName: string;
  targeting: string; // keyword or ASIN target
  matchType: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number; // spend / sales * 100
  cpc: number;  // spend / clicks
  ctr: number;  // clicks / impressions * 100
  conversionRate: number; // orders / clicks * 100
  currency: string;
}

export interface AdSummary {
  totalSpend: number;
  totalSales: number;
  totalImpressions: number;
  totalClicks: number;
  totalOrders: number;
  overallAcos: number;
  overallCpc: number;
  overallCtr: number;
  overallConversionRate: number;
  currency: string;
  rowCount: number;
  dateRange: { from: string; to: string };
}

export interface KeywordPerformance {
  keyword: string;
  matchType: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number;
  campaigns: string[];
}

export type AdHealthStatus = 'profitable' | 'breakeven' | 'wasteful' | 'no-data';
