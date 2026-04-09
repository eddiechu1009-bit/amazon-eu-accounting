import { useState, useCallback, useMemo } from 'react';
import { AdRow, AdSummary, KeywordPerformance } from '../data/adTypes';
import { parseAdReport, summarizeAdReport, analyzeKeywords } from '../data/adParser';
import { useI18n } from '../i18n';

type ViewMode = 'upload' | 'dashboard';

export default function AdAnalyzer() {
  const { lang } = useI18n();
  const isEn = lang === 'en';
  const [rows, setRows] = useState<AdRow[]>([]);
  const [summary, setSummary] = useState<AdSummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [targetAcos, setTargetAcos] = useState(30);

  const handleFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseAdReport(text);
        if (parsed.length === 0) {
          setError(isEn ? 'Unable to parse. Please confirm it is a Sponsored Products report (CSV/TSV).' : '無法解析，請確認是 Sponsored Products 廣告報告（CSV/TSV 格式）。');
          return;
        }
        setRows(parsed);
        setSummary(summarizeAdReport(parsed));
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

  const resetAll = () => { setRows([]); setSummary(null); setViewMode('upload'); setFileName(''); setError(''); };

  const keywords = useMemo(() => analyzeKeywords(rows), [rows]);
  const wasteful = useMemo(() => keywords.filter(k => k.spend > 0 && (k.sales === 0 || k.acos > targetAcos * 2)), [keywords, targetAcos]);
  const profitable = useMemo(() => keywords.filter(k => k.sales > 0 && k.acos <= targetAcos), [keywords, targetAcos]);
  const needsWork = useMemo(() => keywords.filter(k => k.sales > 0 && k.acos > targetAcos && k.acos <= targetAcos * 2), [keywords, targetAcos]);

  if (viewMode === 'upload') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-amazon-dark mb-2">{isEn ? '📢 Ad Report Analyzer' : '📢 廣告報告分析器'}</h2>
          <p className="text-gray-500">{isEn ? 'Upload your Sponsored Products report to analyze keyword performance' : '上傳 Sponsored Products 廣告報告，分析關鍵字表現與花費效率'}</p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer
            ${dragOver ? 'border-amazon-orange bg-orange-50' : 'border-gray-300 hover:border-amazon-orange hover:bg-orange-50/30'}`}
        >
          <div className="text-5xl mb-4">📢</div>
          <p className="text-lg font-medium text-gray-700 mb-2">{isEn ? 'Drop your ad report here' : '將廣告報告拖放至此'}</p>
          <p className="text-sm text-gray-400 mb-4">{isEn ? 'Supports Sponsored Products Search Term / Targeting reports (.csv/.tsv)' : '支援 Sponsored Products 搜尋詞報告 / Targeting 報告（.csv/.tsv）'}</p>
          <label className="inline-block px-6 py-2 bg-amazon-orange text-white rounded-lg cursor-pointer hover:bg-orange-500 transition">
            {isEn ? 'Choose file' : '選擇檔案'}
            <input type="file" accept=".csv,.tsv,.txt" onChange={onFileInput} className="hidden" />
          </label>
        </div>
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">⚠️ {error}</div>}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-800 mb-2">{isEn ? '📥 How to download the report?' : '📥 如何下載廣告報告？'}</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>{isEn ? 'Go to Seller Central → Advertising → Campaign Manager' : '前往 Seller Central → 廣告 → Campaign Manager'}</li>
            <li>{isEn ? 'Click "Measurement & Reporting" → "Sponsored ads reports"' : '點擊「衡量和報告」→「贊助廣告報告」'}</li>
            <li>{isEn ? 'Create report: Search Term or Targeting, select date range' : '建立報告：搜尋詞報告或 Targeting 報告，選擇日期範圍'}</li>
            <li>{isEn ? 'Download and upload the CSV file here' : '下載 CSV 檔案後上傳至此'}</li>
          </ol>
        </div>
      </div>
    );
  }

  if (!summary) return null;
  const cur = summary.currency;
  const fmt = (v: number) => `${cur === 'GBP' ? '£' : '€'}${v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-amazon-dark">{isEn ? '📢 Ad Performance Dashboard' : '📢 廣告表現儀表板'}</h2>
          <p className="text-sm text-gray-400">{fileName} · {summary.rowCount} {isEn ? 'rows' : '筆資料'} · {summary.dateRange.from} ~ {summary.dateRange.to}</p>
        </div>
        <button onClick={resetAll} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">{isEn ? 'Re-upload' : '🔄 重新上傳'}</button>
      </div>

      {/* Target ACoS */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">{isEn ? 'Target ACoS:' : '目標 ACoS：'}</span>
        <input type="number" value={targetAcos} onChange={e => setTargetAcos(Number(e.target.value) || 30)} min={1} max={100}
          className="w-20 px-2 py-1 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-orange/50" />
        <span className="text-sm text-gray-400">%</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-6">
        <KpiCard label={isEn ? 'Total Spend' : '總花費'} value={fmt(summary.totalSpend)} color="text-red-600" />
        <KpiCard label={isEn ? 'Total Sales' : '總銷售額'} value={fmt(summary.totalSales)} color="text-green-700" />
        <KpiCard label="ACoS" value={`${summary.overallAcos.toFixed(1)}%`} color={summary.overallAcos <= targetAcos ? 'text-green-700' : 'text-red-600'} />
        <KpiCard label={isEn ? 'Orders' : '訂單數'} value={summary.totalOrders.toLocaleString()} color="text-amazon-dark" />
        <KpiCard label={isEn ? 'Conv. Rate' : '轉換率'} value={`${summary.overallConversionRate.toFixed(1)}%`} color="text-blue-600" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xs text-gray-400">{isEn ? 'Impressions' : '曝光次數'}</div>
          <div className="text-lg font-bold text-gray-700">{summary.totalImpressions.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xs text-gray-400">CPC</div>
          <div className="text-lg font-bold text-gray-700">{fmt(summary.overallCpc)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xs text-gray-400">CTR</div>
          <div className="text-lg font-bold text-gray-700">{summary.overallCtr.toFixed(2)}%</div>
        </div>
      </div>

      {/* Keyword Health Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-green-700 mb-1">✅ {isEn ? 'Profitable' : '獲利關鍵字'} ({profitable.length})</div>
          <div className="text-xs text-green-600">ACoS ≤ {targetAcos}%</div>
          <div className="text-lg font-bold text-green-700 mt-1">{fmt(profitable.reduce((s, k) => s + k.sales, 0))}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-yellow-700 mb-1">⚠️ {isEn ? 'Needs Work' : '待優化'} ({needsWork.length})</div>
          <div className="text-xs text-yellow-600">ACoS {targetAcos}% ~ {targetAcos * 2}%</div>
          <div className="text-lg font-bold text-yellow-700 mt-1">{fmt(needsWork.reduce((s, k) => s + k.spend, 0))}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-red-700 mb-1">🚨 {isEn ? 'Wasteful' : '燒錢關鍵字'} ({wasteful.length})</div>
          <div className="text-xs text-red-600">{isEn ? 'No sales or ACoS > ' : '無銷售或 ACoS > '}{targetAcos * 2}%</div>
          <div className="text-lg font-bold text-red-700 mt-1">{fmt(wasteful.reduce((s, k) => s + k.spend, 0))}</div>
        </div>
      </div>

      {/* Wasteful Keywords - Action Required */}
      {wasteful.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm mb-6">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <h3 className="font-semibold text-red-700">🚨 {isEn ? 'Wasteful Keywords — Consider Negating' : '燒錢關鍵字 — 建議加入否定'}</h3>
            <p className="text-xs text-red-500 mt-0.5">{isEn ? 'These keywords are spending money without generating profitable sales' : '這些關鍵字在花錢但沒有產生有效銷售'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500">{isEn ? 'Keyword' : '關鍵字'}</th>
                  <th className="text-left px-3 py-2 text-gray-500">{isEn ? 'Match' : '匹配'}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Spend' : '花費'}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Sales' : '銷售'}</th>
                  <th className="text-right px-3 py-2 text-gray-500">ACoS</th>
                  <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Clicks' : '點擊'}</th>
                </tr>
              </thead>
              <tbody>
                {wasteful.slice(0, 20).map((kw, i) => (
                  <tr key={i} className="border-t hover:bg-red-50/50">
                    <td className="px-3 py-2 text-gray-700 font-medium max-w-[200px] truncate">{kw.keyword}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{kw.matchType}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">{fmt(kw.spend)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(kw.sales)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">{kw.acos >= 999 ? '∞' : `${kw.acos.toFixed(0)}%`}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{kw.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {wasteful.length > 20 && <p className="text-xs text-gray-400 px-4 py-2">{isEn ? `Showing top 20 of ${wasteful.length}` : `顯示前 20 筆，共 ${wasteful.length} 筆`}</p>}
        </div>
      )}

      {/* Profitable Keywords - Scale Up */}
      {profitable.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm mb-6">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h3 className="font-semibold text-green-700">✅ {isEn ? 'Profitable Keywords — Consider Scaling' : '獲利關鍵字 — 建議加碼投放'}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500">{isEn ? 'Keyword' : '關鍵字'}</th>
                  <th className="text-left px-3 py-2 text-gray-500">{isEn ? 'Match' : '匹配'}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Sales' : '銷售'}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Spend' : '花費'}</th>
                  <th className="text-right px-3 py-2 text-gray-500">ACoS</th>
                  <th className="text-right px-3 py-2 text-gray-500">{isEn ? 'Orders' : '訂單'}</th>
                </tr>
              </thead>
              <tbody>
                {profitable.sort((a, b) => b.sales - a.sales).slice(0, 20).map((kw, i) => (
                  <tr key={i} className="border-t hover:bg-green-50/50">
                    <td className="px-3 py-2 text-gray-700 font-medium max-w-[200px] truncate">{kw.keyword}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{kw.matchType}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{fmt(kw.sales)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(kw.spend)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-600">{kw.acos.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right text-gray-500">{kw.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        💡 {isEn
          ? 'Tip: Negate wasteful keywords in your campaigns, and increase bids on profitable ones. Review weekly for best results.'
          : '建議：將燒錢關鍵字加入否定關鍵字，對獲利關鍵字提高出價。建議每週檢視一次廣告表現。'}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm text-center">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
