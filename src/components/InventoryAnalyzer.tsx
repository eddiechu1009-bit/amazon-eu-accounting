import { useState, useCallback, useMemo } from 'react';
import { InventoryRow, RestockResult } from '../data/inventoryTypes';
import { parseInventoryReport, calcRestock, exportRestockCSV } from '../data/inventoryParser';
import { useI18n } from '../i18n';

export default function InventoryAnalyzer() {
  const { lang } = useI18n();
  const isEn = lang === 'en';
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [viewMode, setViewMode] = useState<'upload' | 'dashboard'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [leadTime, setLeadTime] = useState(45); // days
  const [safetyDays, setSafetyDays] = useState(14);
  const [targetDays, setTargetDays] = useState(60);

  const handleFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseInventoryReport(text);
        if (parsed.length === 0) {
          setError(isEn ? 'Unable to parse. Please confirm it is an Inventory Health Report.' : '無法解析，請確認是 Inventory Health Report（庫存健康報告）。');
          return;
        }
        setRows(parsed);
        setViewMode('dashboard');
      } catch {
        setError(isEn ? 'File parsing failed.' : '檔案解析失敗。');
      }
    };
    reader.readAsText(file);
  }, [isEn]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const resetAll = () => { setRows([]); setViewMode('upload'); setFileName(''); setError(''); };

  const results = useMemo(() => calcRestock(rows, leadTime, safetyDays, targetDays), [rows, leadTime, safetyDays, targetDays]);

  const counts = useMemo(() => {
    const c = { urgent: 0, soon: 0, ok: 0, overstock: 0, noSales: 0 };
    results.forEach(r => {
      if (r.status === 'urgent') c.urgent++;
      else if (r.status === 'soon') c.soon++;
      else if (r.status === 'ok') c.ok++;
      else if (r.status === 'overstock') c.overstock++;
      else c.noSales++;
    });
    return c;
  }, [results]);

  if (viewMode === 'upload') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-amazon-dark mb-2">{isEn ? '📦 Inventory Restock Planner' : '📦 庫存補貨計算器'}</h2>
          <p className="text-gray-500">{isEn ? 'Upload your Inventory Health Report to get restock recommendations' : '上傳 Inventory Health Report，自動計算每個 SKU 的補貨建議'}</p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer
            ${dragOver ? 'border-amazon-orange bg-orange-50' : 'border-gray-300 hover:border-amazon-orange hover:bg-orange-50/30'}`}
        >
          <div className="text-5xl mb-4">📦</div>
          <p className="text-lg font-medium text-gray-700 mb-2">{isEn ? 'Drop your inventory report here' : '將庫存報告拖放至此'}</p>
          <p className="text-sm text-gray-400 mb-4">{isEn ? 'Supports Inventory Health Report, FBA Inventory (.csv/.tsv)' : '支援 Inventory Health Report、FBA 庫存報告（.csv/.tsv）'}</p>
          <label className="inline-block px-6 py-2 bg-amazon-orange text-white rounded-lg cursor-pointer hover:bg-orange-500 transition">
            {isEn ? 'Choose file' : '選擇檔案'}
            <input type="file" accept=".csv,.tsv,.txt" onChange={onFileInput} className="hidden" />
          </label>
        </div>
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">⚠️ {error}</div>}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-800 mb-2">{isEn ? '📥 How to download?' : '📥 如何下載庫存報告？'}</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>{isEn ? 'Go to Seller Central → Inventory → Inventory Planning' : '前往 Seller Central → 庫存 → 庫存規劃'}</li>
            <li>{isEn ? 'Or: Reports → Fulfillment → Inventory Health' : '或：報告 → 物流 → Inventory Health'}</li>
            <li>{isEn ? 'Click "Download" to get the CSV file' : '點擊「下載」取得 CSV 檔案'}</li>
            <li>{isEn ? 'Upload the file here' : '將檔案上傳至此'}</li>
          </ol>
        </div>
      </div>
    );
  }

  const statusBadge = (s: RestockResult['status']) => {
    const map = {
      urgent: { label: isEn ? 'URGENT' : '🚨 緊急', cls: 'bg-red-100 text-red-700' },
      soon: { label: isEn ? 'Restock Soon' : '⚠️ 即將補貨', cls: 'bg-yellow-100 text-yellow-700' },
      ok: { label: isEn ? 'OK' : '✅ 正常', cls: 'bg-green-100 text-green-700' },
      overstock: { label: isEn ? 'Overstock' : '📦 過多', cls: 'bg-blue-100 text-blue-700' },
      'no-sales': { label: isEn ? 'No Sales' : '— 無銷量', cls: 'bg-gray-100 text-gray-500' },
    };
    const { label, cls } = map[s];
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-amazon-dark">{isEn ? '📦 Restock Plan' : '📦 補貨計畫'}</h2>
          <p className="text-sm text-gray-400">{fileName} · {rows.length} SKUs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportRestockCSV(results, isEn)} className="px-3 py-1.5 text-sm bg-amazon-orange text-white rounded-lg hover:bg-orange-500 transition">
            {isEn ? '📥 Export CSV' : '📥 匯出 CSV'}
          </button>
          <button onClick={resetAll} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            {isEn ? 'Re-upload' : '🔄 重新上傳'}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border p-4 shadow-sm mb-4 animate-fadeIn">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">⚙️ {isEn ? 'Restock Parameters' : '補貨參數設定'}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{isEn ? 'Lead Time (days)' : '交期+海運天數'}</label>
            <input type="number" value={leadTime} onChange={e => setLeadTime(Number(e.target.value) || 0)} min={1}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-orange/50" />
            <p className="text-xs text-gray-400 mt-0.5">{isEn ? 'Production + shipping' : '生產+運輸時間'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{isEn ? 'Safety Stock (days)' : '安全庫存天數'}</label>
            <input type="number" value={safetyDays} onChange={e => setSafetyDays(Number(e.target.value) || 0)} min={0}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-orange/50" />
            <p className="text-xs text-gray-400 mt-0.5">{isEn ? 'Buffer stock' : '緩衝庫存'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{isEn ? 'Target Stock (days)' : '目標庫存天數'}</label>
            <input type="number" value={targetDays} onChange={e => setTargetDays(Number(e.target.value) || 0)} min={1}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-orange/50" />
            <p className="text-xs text-gray-400 mt-0.5">{isEn ? 'Desired coverage' : '補貨後目標天數'}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-red-700">{counts.urgent}</div>
          <div className="text-xs text-red-600">{isEn ? 'Urgent' : '🚨 緊急補貨'}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-yellow-700">{counts.soon}</div>
          <div className="text-xs text-yellow-600">{isEn ? 'Soon' : '⚠️ 即將補貨'}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-green-700">{counts.ok}</div>
          <div className="text-xs text-green-600">{isEn ? 'OK' : '✅ 正常'}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-blue-700">{counts.overstock}</div>
          <div className="text-xs text-blue-600">{isEn ? 'Overstock' : '📦 庫存過多'}</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-500">{counts.noSales}</div>
          <div className="text-xs text-gray-400">{isEn ? 'No Sales' : '無銷量'}</div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500">{isEn ? 'Status' : '狀態'}</th>
                <th className="text-left px-3 py-2 text-gray-500">SKU</th>
                <th className="text-left px-3 py-2 text-gray-500 max-w-[200px]">{isEn ? 'Product' : '商品'}</th>
                <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Available' : '可售'}</th>
                <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Inbound' : '入倉中'}</th>
                <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Daily Sales' : '日均銷量'}</th>
                <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Days Left' : '可售天數'}</th>
                <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Restock By' : '補貨日期'}</th>
                <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Restock Qty' : '補貨量'}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={`border-t hover:bg-gray-50 ${r.status === 'urgent' ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.sku}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={r.productName}>{r.productName}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.available}</td>
                  <td className="px-3 py-2 text-right font-mono text-blue-600">{r.inbound || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.dailySales > 0 ? r.dailySales.toFixed(1) : '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${
                    r.daysOfStock <= leadTime + safetyDays ? 'text-red-600' :
                    r.daysOfStock <= leadTime + safetyDays + 14 ? 'text-yellow-600' : 'text-green-700'
                  }`}>{r.daysOfStock >= 999 ? '∞' : r.daysOfStock}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.restockQty > 0 ? r.restockDate : '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.restockQty > 0 ? 'text-amazon-orange' : 'text-gray-400'}`}>
                    {r.restockQty > 0 ? r.restockQty : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p>💡 {isEn ? 'Restock trigger = Lead Time + Safety Stock days. When stock drops below this, it\'s time to order.' : '補貨觸發點 = 交期天數 + 安全庫存天數。當可售天數低於此值時，應立即下單補貨。'}</p>
        <p>💡 {isEn ? 'Daily sales are calculated from 30-day data (preferred), falling back to 7/60/90-day data.' : '日均銷量優先使用 30 天數據，若無則依序使用 7/60/90 天數據。'}</p>
        <p>💡 {isEn ? 'All data is processed locally. Nothing is uploaded to any server.' : '所有資料在瀏覽器本地處理，不會上傳至任何伺服器。'}</p>
      </div>
    </div>
  );
}
