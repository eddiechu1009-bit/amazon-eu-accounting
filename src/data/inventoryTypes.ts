/** Amazon Inventory Health Report 庫存補貨分析型別 */

export interface InventoryRow {
  sku: string;
  asin: string;
  productName: string;
  available: number;
  inbound: number;
  reserved: number;
  unfulfillable: number;
  sales7d: number;
  sales30d: number;
  sales60d: number;
  sales90d: number;
  daysOfSupply: number; // Amazon's estimate
  marketplace: string;
}

export interface RestockResult {
  sku: string;
  asin: string;
  productName: string;
  available: number;
  inbound: number;
  dailySales: number;
  daysOfStock: number;
  restockDate: string; // YYYY-MM-DD
  restockQty: number;
  status: 'urgent' | 'soon' | 'ok' | 'overstock' | 'no-sales';
}
