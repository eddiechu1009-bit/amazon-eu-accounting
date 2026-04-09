import { useState, useCallback, useMemo } from 'react';
import { TransactionRow, AccountingSummary, FeeCategory, VATByCountry } from '../data/accountingTypes';
import { parseSettlementCSV, summarizeTransactions } from '../data/csvParser';
import {
  feeCategories,
  feeCategoryMap,
  feeExplainers,
  matchExplainer,
  getExplainersByCategory,
} from '../data/accountingData';
import {
  accountMappings,
  accountMappingMap,
  computeVATByCountry,
  exportAccountingSummaryCSV,
  exportVATByCountryCSV,
  exportTransactionDetailCSV,
} from '../data/accountingHelpers';
import { useI18n } from '../i18n';

type ViewMode = 'upload' | 'summary' | 'detail' | 'glossary';

/** 匯率設定：各幣別對 USD 的匯率 */
export type ExchangeRates = Record<string, number>;

const defaultRates: ExchangeRates = {
  EUR: 1.08,
  GBP: 1.27,
  SEK: 0.095,
  PLN: 0.25,
  CZK: 0.043,
  TRY: 0.031,
  DKK: 0.145,
  USD: 1,
};

export default function AccountingAnalyzer() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [selectedCategory, setSelectedCategory] = useState<FeeCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [showUSD, setShowUSD] = useState(false);
  const [rates, setRates] = useState<ExchangeRates>({ ...defaultRates });
  const [showRatePanel, setShowRatePanel] = useState(false);
  const isEn = lang === 'en';

  const handleFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseSettlementCSV(text);
        if (parsed.length === 0) {
          setError(isEn ? 'Unable to parse the file. Please confirm it is an Amazon Settlement Report in CSV/TSV format.' : '無法解析檔案，請確認是 Amazon Settlement Report 的 CSV/TSV 格式。');
          return;
        }
        setRows(parsed);
        setSummary(summarizeTransactions(parsed));
        setViewMode('summary');
      } catch {
        setError(isEn ? 'File parsing failed. Please check the format.' : '檔案解析失敗，請確認格式正確。');
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

  const resetAll = () => {
    setRows([]); setSummary(null); setViewMode('upload');
    setFileName(''); setError(''); setSelectedCategory(null);
  };

  // ─── 上傳畫面 ───────────────────────────────────────────
  if (viewMode === 'upload') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-amazon-dark mb-2">{t('uploadTitle')}</h2>
          <p className="text-gray-500">{t('uploadDesc')}</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer
            ${dragOver ? 'border-amazon-orange bg-orange-50' : 'border-gray-300 hover:border-amazon-orange hover:bg-orange-50/30'}`}
        >
          <div className="text-5xl mb-4">📁</div>
          <p className="text-lg font-medium text-gray-700 mb-2">{t('dropHere')}</p>
          <p className="text-sm text-gray-400 mb-4">{t('fileFormats')}</p>
          <label className="inline-block px-6 py-2 bg-amazon-orange text-white rounded-lg cursor-pointer hover:bg-orange-500 transition">
            {t('orChooseFile')}
            <input type="file" accept=".csv,.tsv,.txt" onChange={onFileInput} className="hidden" />
          </label>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">⚠️ {error}</div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-800 mb-2">{t('howToDownload')}</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
          </ol>
        </div>

        <div className="mt-4 text-center">
          <button onClick={() => setViewMode('glossary')} className="text-sm text-amazon-orange hover:underline">
            {t('viewGlossary')}
          </button>
        </div>
      </div>
    );
  }

  // ─── 科目字典 ───────────────────────────────────────────
  if (viewMode === 'glossary') {
    return (
      <GlossaryView
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        onBack={() => { setViewMode(summary ? 'summary' : 'upload'); setSelectedCategory(null); }}
      />
    );
  }

  if (!summary) return null;

  // ─── USD 匯率面板 + 內容 ────────────────────────────────
  const usdPanel = (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showUSD} onChange={(e) => setShowUSD(e.target.checked)}
            className="w-4 h-4 accent-amazon-orange" />
          <span className="text-sm text-gray-700">{isEn ? 'Show USD equivalent' : '顯示美金換算'}</span>
        </label>
        {showUSD && (
          <button onClick={() => setShowRatePanel(!showRatePanel)}
            className="text-xs text-amazon-orange hover:underline">
            {showRatePanel ? (isEn ? 'Hide rates' : '收起匯率') : (isEn ? 'Edit rates' : '編輯匯率')} ⚙️
          </button>
        )}
      </div>
      {showUSD && showRatePanel && (
        <div className="bg-white border rounded-lg p-3 mb-2">
          <p className="text-xs text-gray-500 mb-2">{isEn ? 'Exchange rates to USD (editable):' : '各幣別對美金匯率（可自行修改）：'}</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(rates).filter(([k]) => k !== 'USD').map(([code, rate]) => (
              <div key={code} className="flex items-center gap-1">
                <span className="text-xs font-mono text-gray-600 w-8">{code}</span>
                <input type="number" step="0.001" min="0" value={rate}
                  onChange={(e) => setRates((prev) => ({ ...prev, [code]: parseFloat(e.target.value) || 0 }))}
                  className="w-20 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-amazon-orange/50" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (viewMode === 'summary') {
    return (
      <div>
        {usdPanel}
        <SummaryView summary={summary} fileName={fileName} onReset={resetAll} rows={rows}
          showUSD={showUSD} rates={rates}
          onViewDetail={(cat) => { setSelectedCategory(cat); setViewMode('detail'); }}
          onViewGlossary={() => setViewMode('glossary')} />
      </div>
    );
  }

  if (viewMode === 'detail' && selectedCategory) {
    return (
      <div>
        {usdPanel}
        <DetailView rows={rows} category={selectedCategory}
          showUSD={showUSD} rates={rates}
          onBack={() => { setViewMode('summary'); setSelectedCategory(null); }} />
      </div>
    );
  }

  return null;
}


// ═══════════════════════════════════════════════════════════════
// SummaryView — with sub-tabs: Summary / Accounting / VAT / Export
// ═══════════════════════════════════════════════════════════════
type SummaryTab = 'overview' | 'accounting' | 'vat' | 'export';

function SummaryView({ summary, fileName, onReset, onViewDetail, onViewGlossary, rows, showUSD, rates }: {
  summary: AccountingSummary; fileName: string; onReset: () => void;
  onViewDetail: (cat: FeeCategory) => void; onViewGlossary: () => void;
  rows: TransactionRow[]; showUSD: boolean; rates: ExchangeRates;
}) {
  const { lang, t } = useI18n();
  const isEn = lang === 'en';
  const [subTab, setSubTab] = useState<SummaryTab>('overview');
  const maxAbs = Math.max(...Object.values(summary.byCategory).map(Math.abs), 1);
  const vatData = useMemo(() => computeVATByCountry(rows), [rows]);

  const subTabs: { id: SummaryTab; label: string }[] = [
    { id: 'overview', label: t('tabSummary') },
    { id: 'accounting', label: t('tabAccounting') },
    { id: 'vat', label: t('tabVAT') },
    { id: 'export', label: t('tabExport') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-amazon-dark">{t('summaryTitle')}</h2>
          <p className="text-sm text-gray-400">
            {fileName} · {summary.rowCount} {t('transactions')} · {summary.currency}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onViewGlossary} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            {t('glossaryBtn')}
          </button>
          <button onClick={onReset} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            {t('reuploadBtn')}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {subTabs.map((tab) => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition ${
              subTab === tab.id ? 'bg-white shadow font-semibold text-amazon-dark' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <OverviewContent summary={summary} maxAbs={maxAbs} isEn={isEn} onViewDetail={onViewDetail} showUSD={showUSD} rates={rates} />
      )}
      {subTab === 'accounting' && (
        <AccountingContent summary={summary} isEn={isEn} showUSD={showUSD} rates={rates} />
      )}
      {subTab === 'vat' && (
        <VATContent vatData={vatData} isEn={isEn} showUSD={showUSD} rates={rates} />
      )}
      {subTab === 'export' && (
        <ExportContent rows={rows} summary={summary} vatData={vatData} isEn={isEn} />
      )}
    </div>
  );
}

// ─── Overview (original summary content) ──────────────────────
function OverviewContent({ summary, maxAbs, isEn, onViewDetail, showUSD, rates }: {
  summary: AccountingSummary; maxAbs: number; isEn: boolean; onViewDetail: (cat: FeeCategory) => void;
  showUSD: boolean; rates: ExchangeRates;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className={`rounded-xl p-6 mb-6 text-center ${summary.netProceeds >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <p className="text-sm text-gray-500 mb-1">{t('netProceeds')}</p>
        <p className={`text-3xl font-bold ${summary.netProceeds >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {formatWithUSD(summary.netProceeds, summary.currency, showUSD, rates)}
        </p>
      </div>

      {/* 收入/支出圓餅圖 */}
      <PieChartSection summary={summary} isEn={isEn} currency={summary.currency} showUSD={showUSD} rates={rates} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {feeCategories.map((cat) => {
          const val = summary.byCategory[cat.id];
          if (val === 0) return null;
          const pct = Math.abs(val) / maxAbs;
          return (
            <button key={cat.id} onClick={() => onViewDetail(cat.id)}
              className="text-left p-4 bg-white rounded-xl border hover:shadow-md transition group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {cat.icon} {isEn ? cat.labelEn : cat.label}
                </span>
                <span className={`font-bold ${val >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatWithUSD(val, summary.currency, showUSD, rates)}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct * 100}%`, backgroundColor: cat.color }} />
              </div>
              <p className="text-xs text-gray-400 mt-1 group-hover:text-amazon-orange transition">{t('clickDetail')}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-700">{t('itemBreakdown')}</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500">{t('colItem')}</th>
                <th className="text-right px-4 py-2 text-gray-500">{t('colAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.byItem)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .map(([label, val]) => (
                  <tr key={label} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{label}</td>
                    <td className={`px-4 py-2 text-right font-mono ${val >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCurrency(val, summary.currency)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Accounting Mapping ───────────────────────────────────────
function AccountingContent({ summary, isEn, showUSD, rates }: { summary: AccountingSummary; isEn: boolean; showUSD: boolean; rates: ExchangeRates }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="text-lg font-bold text-amazon-dark mb-1">{t('accountingTitle')}</h3>
      <p className="text-sm text-gray-500 mb-4">{t('accountingDesc')}</p>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500">{t('colAccountName')}</th>
                <th className="text-left px-4 py-2 text-gray-500">{t('colNature')}</th>
                <th className="text-left px-4 py-2 text-gray-500">{isEn ? 'Amazon Category' : 'Amazon 分類'}</th>
                <th className="text-right px-4 py-2 text-gray-500">{t('colAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {accountMappings.map((m) => {
                const val = summary.byCategory[m.category] ?? 0;
                if (val === 0) return null;
                const catInfo = feeCategoryMap[m.category];
                return (
                  <tr key={m.category} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 font-medium">{isEn ? m.accountNameEn : m.accountName}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        m.nature === 'revenue' ? 'bg-green-100 text-green-700' :
                        m.nature === 'liability' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {isEn ? m.natureLabelEn : m.natureLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {catInfo.icon} {isEn ? catInfo.labelEn : catInfo.label}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${val >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatWithUSD(val, summary.currency, showUSD, rates)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr className="border-t-2">
                <td colSpan={3} className="px-4 py-2 text-gray-700">{t('netProceeds')}</td>
                <td className={`px-4 py-2 text-right font-mono ${summary.netProceeds >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatWithUSD(summary.netProceeds, summary.currency, showUSD, rates)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        {isEn
          ? '💡 These are suggested account classifications only. Each country has its own Chart of Accounts (e.g., SKR03/SKR04 in Germany, PCG in France, PGC in Spain). Please map these to your company\'s specific account codes.'
          : '💡 以上為建議性的會計科目分類，僅供對帳參考。各國有各自的法定會計科目表（如德國 SKR03/SKR04、法國 PCG、西班牙 PGC），請依貴公司的會計科目表進行對應。'}
      </div>
    </div>
  );
}

// ─── VAT by Country ───────────────────────────────────────────
function VATContent({ vatData, isEn, showUSD, rates }: { vatData: VATByCountry[]; isEn: boolean; showUSD: boolean; rates: ExchangeRates }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="text-lg font-bold text-amazon-dark mb-1">{t('vatTitle')}</h3>
      <p className="text-sm text-gray-500 mb-4">{t('vatDesc')}</p>

      {vatData.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{isEn ? 'No marketplace data available for VAT breakdown' : '無市場資料可供 VAT 拆分'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500">{t('colCountry')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colGrossSales')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colNetSales')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colVAT')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colShippingRev')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colShippingTax')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colRefunds')}</th>
                  <th className="text-right px-3 py-2 text-gray-500">{t('colTxCount')}</th>
                </tr>
              </thead>
              <tbody>
                {vatData.map((v) => (
                  <tr key={v.countryCode} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 font-medium">{v.country}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">{formatWithUSD(v.salesGross, v.currency, showUSD, rates)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{formatWithUSD(v.salesNet, v.currency, showUSD, rates)}</td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700">{formatWithUSD(v.vatCollected, v.currency, showUSD, rates)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">{formatWithUSD(v.shippingRevenue, v.currency, showUSD, rates)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">{formatWithUSD(v.shippingTax, v.currency, showUSD, rates)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">{formatWithUSD(v.refunds, v.currency, showUSD, rates)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{v.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
        {t('vatNote')}
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────
function ExportContent({ rows, summary, vatData, isEn }: {
  rows: TransactionRow[]; summary: AccountingSummary; vatData: VATByCountry[]; isEn: boolean;
}) {
  const { t } = useI18n();
  const exportButtons = [
    { label: t('exportSummary'), desc: t('exportSummaryDesc'), icon: '📊',
      onClick: () => exportAccountingSummaryCSV(rows, summary.byCategory, summary.currency, isEn) },
    { label: t('exportVAT'), desc: t('exportVATDesc'), icon: '🏛️',
      onClick: () => exportVATByCountryCSV(vatData, isEn) },
    { label: t('exportDetail'), desc: t('exportDetailDesc'), icon: '📋',
      onClick: () => exportTransactionDetailCSV(rows, isEn) },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-amazon-dark mb-1">{t('exportTitle')}</h3>
      <p className="text-sm text-gray-500 mb-4">{t('exportDesc')}</p>

      <div className="space-y-3">
        {exportButtons.map((btn) => (
          <button key={btn.label} onClick={btn.onClick}
            className="w-full text-left p-4 bg-white rounded-xl border hover:shadow-md hover:border-amazon-orange transition group">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{btn.icon}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-700 group-hover:text-amazon-dark">{btn.label}</p>
                <p className="text-xs text-gray-400">{btn.desc}</p>
              </div>
              <span className="text-gray-300 group-hover:text-amazon-orange transition">⬇</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// DetailView — 可展開/收起的科目分組 + 搜尋 + 交易明細
// ═══════════════════════════════════════════════════════════════
function DetailView({ rows, category, onBack, showUSD, rates }: {
  rows: TransactionRow[]; category: FeeCategory; onBack: () => void;
  showUSD: boolean; rates: ExchangeRates;
}) {
  const { lang, t } = useI18n();
  const isEn = lang === 'en';
  const catInfo = feeCategoryMap[category];
  const catExplainers = getExplainersByCategory(category);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 篩選該分類的交易
  const catRows = useMemo(() =>
    rows.filter((r) => {
      const exp = matchExplainer(r.amountDescription);
      if (exp) return exp.category === category;
      // fallback: 用 guessCategory 邏輯也納入
      return false;
    }),
    [rows, category]);

  // 搜尋過濾
  const filtered = useMemo(() => {
    if (!search.trim()) return catRows;
    const q = search.toLowerCase();
    return catRows.filter((r) =>
      r.orderId.toLowerCase().includes(q) ||
      r.sku.toLowerCase().includes(q) ||
      r.amountDescription.toLowerCase().includes(q) ||
      (matchExplainer(r.amountDescription)?.label ?? '').toLowerCase().includes(q) ||
      (matchExplainer(r.amountDescription)?.labelEn ?? '').toLowerCase().includes(q) ||
      r.date.toLowerCase().includes(q) ||
      r.marketplace.toLowerCase().includes(q)
    );
  }, [catRows, search]);

  // 按科目分組
  const grouped = useMemo(() => {
    const map: Record<string, { key: string; label: string; labelEn: string; rows: TransactionRow[]; total: number }> = {};
    for (const r of filtered) {
      const exp = matchExplainer(r.amountDescription);
      const groupKey = exp?.key ?? r.amountDescription ?? 'unknown';
      if (!map[groupKey]) {
        map[groupKey] = {
          key: groupKey,
          label: exp?.label ?? r.amountDescription,
          labelEn: exp?.labelEn ?? r.amountDescription,
          rows: [],
          total: 0,
        };
      }
      map[groupKey].rows.push(r);
      map[groupKey].total += r.amount;
    }
    return Object.values(map).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [filtered]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);
  const cur = filtered[0]?.currency ?? 'EUR';

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (expanded.size === grouped.length) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(grouped.map((g) => g.key)));
    }
  };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-amazon-orange mb-4 transition">
        {t('backToSummary')}
      </button>

      {/* 標題 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{catInfo.icon}</span>
        <div>
          <h2 className="text-xl font-bold text-amazon-dark">{isEn ? catInfo.labelEn : catInfo.label}</h2>
          <p className="text-sm text-gray-500">{isEn ? catInfo.descriptionEn : catInfo.description}</p>
        </div>
      </div>

      {/* 小計 */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">{t('categorySubtotal')}</span>
          <span className={`text-xl font-bold ${total >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatWithUSD(total, cur, showUSD, rates)}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{filtered.length} {t('txCount')}</p>
      </div>

      {/* 搜尋列 + 展開/收起 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder={t('detailSearchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-orange/50 text-sm"
        />
        <button
          onClick={toggleAll}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
        >
          {expanded.size === grouped.length ? t('collapseAll') : t('expandAll')}
        </button>
      </div>

      {/* 分組列表 */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🔍</div>
          <p>{t('noMatchingTx')}</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {grouped.map((g) => {
            const isOpen = expanded.has(g.key);
            const exp = matchExplainer(g.key);
            return (
              <div key={g.key} className="bg-white rounded-xl border overflow-hidden">
                {/* 分組標題列 — 點擊展開/收起 */}
                <button
                  onClick={() => toggleGroup(g.key)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span className="text-sm font-medium text-gray-700">{isEn ? g.labelEn : g.label}</span>
                    <span className="text-xs text-gray-400">({g.rows.length}{isEn ? '' : ' 筆'})</span>
                  </div>
                  <span className={`font-mono text-sm font-semibold ${g.total >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatWithUSD(g.total, cur, showUSD, rates)}
                  </span>
                </button>

                {/* 展開的交易明細 */}
                {isOpen && (
                  <div className="border-t">
                    {/* 科目說明 */}
                    {exp && (
                      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs">
                        <span className="font-semibold text-blue-700">{t('feeExplanation')}：</span>
                        <span className="text-blue-600">{isEn ? exp.descriptionEn : exp.description}</span>
                        {(isEn ? exp.formulaEn : exp.formula) && (
                          <span className="text-blue-500 ml-2">| {t('formulaPrefix')}{isEn ? exp.formulaEn : exp.formula}</span>
                        )}
                      </div>
                    )}
                    {/* 交易表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('colDate')}</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('colOrderId')}</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('colSku')}</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('colDescription')}</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">{t('colMarketplace')}</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium">{t('colAmount')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r, idx) => (
                            <tr key={idx} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.date || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-700 font-mono">{r.orderId || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-600">{r.sku || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-600">{r.amountDescription || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-600">{r.marketplace || '—'}</td>
                              <td className={`px-3 py-1.5 text-right font-mono ${r.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {formatCurrency(r.amount, r.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 科目說明區 */}
      {catExplainers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-3">{t('categoryExplainer')}</h3>
          <div className="space-y-3">
            {catExplainers.map((exp) => (
              <div key={exp.key} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">{exp.key}</span>
                  <span className="font-medium text-gray-800">{isEn ? exp.labelEn : exp.label}</span>
                </div>
                <p className="text-gray-600 mt-0.5">{isEn ? exp.descriptionEn : exp.description}</p>
                {(isEn ? exp.formulaEn : exp.formula) && (
                  <p className="text-xs text-blue-600 mt-0.5">{t('formulaPrefix')}{isEn ? exp.formulaEn : exp.formula}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// GlossaryView
// ═══════════════════════════════════════════════════════════════
function GlossaryView({ searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, onBack }: {
  searchTerm: string; setSearchTerm: (s: string) => void;
  selectedCategory: FeeCategory | null; setSelectedCategory: (c: FeeCategory | null) => void;
  onBack: () => void;
}) {
  const { lang, t } = useI18n();
  const isEn = lang === 'en';

  const filtered = useMemo(() => {
    let items = feeExplainers;
    if (selectedCategory) items = items.filter((f) => f.category === selectedCategory);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter((f) =>
        f.key.toLowerCase().includes(q) || f.label.includes(q) || f.labelEn.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) || f.descriptionEn.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchTerm, selectedCategory]);

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-amazon-orange mb-4 transition">
        {t('backBtn')}
      </button>

      <h2 className="text-xl font-bold text-amazon-dark mb-1">{t('glossaryTitle')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('glossaryDesc')}</p>

      <div className="mb-4">
        <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-orange/50" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 text-xs rounded-full border transition ${!selectedCategory ? 'bg-amazon-orange text-white border-amazon-orange' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          {t('filterAll')}
        </button>
        {feeCategories.map((cat) => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 text-xs rounded-full border transition ${selectedCategory === cat.id ? 'text-white border-transparent' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            style={selectedCategory === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
            {cat.icon} {isEn ? cat.labelEn.split(' ')[0] : cat.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3">{filtered.length} {t('totalItems')}</p>

      <div className="space-y-3">
        {filtered.map((exp) => {
          const cat = feeCategoryMap[exp.category];
          return (
            <div key={exp.key} className="bg-white rounded-xl border p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{exp.key}</span>
                  <span className="font-semibold text-gray-800">{isEn ? exp.labelEn : exp.label}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: cat.color }}>
                  {cat.icon} {isEn ? cat.labelEn.split(' ')[0] : cat.label.split(' ')[0]}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{isEn ? exp.descriptionEn : exp.description}</p>
              {(isEn ? exp.formulaEn : exp.formula) && (
                <p className="text-xs text-blue-600 mt-1">{t('formulaLabel')}{isEn ? exp.formulaEn : exp.formula}</p>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🔍</div>
          <p>{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PieChartSection — 收入/支出圓餅圖
// ═══════════════════════════════════════════════════════════════
interface PieSlice {
  label: string;
  value: number;
  color: string;
  pct: number;
}

function PieChartSection({ summary, isEn, currency, showUSD, rates }: {
  summary: AccountingSummary; isEn: boolean; currency: string;
  showUSD: boolean; rates: ExchangeRates;
}) {
  // 收入項：sales 正值
  const revenueSlices: PieSlice[] = [];
  const expenseSlices: PieSlice[] = [];

  for (const cat of feeCategories) {
    const val = summary.byCategory[cat.id];
    if (val === 0) continue;
    const slice: PieSlice = {
      label: isEn ? cat.labelEn : cat.label,
      value: Math.abs(val),
      color: cat.color,
      pct: 0,
    };
    if (val > 0) revenueSlices.push(slice);
    else expenseSlices.push(slice);
  }

  const revTotal = revenueSlices.reduce((s, sl) => s + sl.value, 0);
  const expTotal = expenseSlices.reduce((s, sl) => s + sl.value, 0);
  revenueSlices.forEach((sl) => (sl.pct = revTotal > 0 ? (sl.value / revTotal) * 100 : 0));
  expenseSlices.forEach((sl) => (sl.pct = expTotal > 0 ? (sl.value / expTotal) * 100 : 0));

  if (revenueSlices.length === 0 && expenseSlices.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {revenueSlices.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-3">
            💰 {isEn ? 'Revenue Breakdown' : '收入結構'}
            <span className="text-xs font-normal text-gray-400 ml-2">
              {formatWithUSD(revTotal, currency, showUSD, rates)}
            </span>
          </h4>
          <div className="flex items-center gap-4">
            <SVGPieChart slices={revenueSlices} size={120} />
            <PieLegend slices={revenueSlices} currency={currency} showUSD={showUSD} rates={rates} />
          </div>
        </div>
      )}
      {expenseSlices.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-red-600 mb-3">
            📉 {isEn ? 'Expense Breakdown' : '支出結構'}
            <span className="text-xs font-normal text-gray-400 ml-2">
              {formatWithUSD(expTotal, currency, showUSD, rates)}
            </span>
          </h4>
          <div className="flex items-center gap-4">
            <SVGPieChart slices={expenseSlices} size={120} />
            <PieLegend slices={expenseSlices} currency={currency} showUSD={showUSD} rates={rates} />
          </div>
        </div>
      )}
    </div>
  );
}

function SVGPieChart({ slices, size }: { slices: PieSlice[]; size: number }) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const radius = r - 4;
  let cumAngle = -90; // start from top

  const paths = slices.map((sl, i) => {
    const angle = (sl.pct / 100) * 360;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    // Single slice = full circle
    if (sl.pct >= 99.9) {
      return (
        <circle key={i} cx={cx} cy={cy} r={radius} fill={sl.color} />
      );
    }

    return (
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={sl.color}
      />
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {paths}
    </svg>
  );
}

function PieLegend({ slices, currency, showUSD, rates }: {
  slices: PieSlice[]; currency: string; showUSD: boolean; rates: ExchangeRates;
}) {
  return (
    <div className="flex-1 space-y-1 min-w-0">
      {slices.map((sl) => (
        <div key={sl.label} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
          <span className="text-gray-600 truncate">{sl.label}</span>
          <span className="text-gray-400 ml-auto shrink-0">{sl.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────
function formatCurrency(val: number, currency: string): string {
  const symbolMap: Record<string, string> = {
    EUR: '€', GBP: '£', USD: '$', SEK: 'kr ', PLN: 'zł ', CZK: 'Kč ',
    TRY: '₺', DKK: 'kr ', NOK: 'kr ', CHF: 'CHF ', HUF: 'Ft ',
    RON: 'lei ', BGN: 'лв ', HRK: 'kn ', JPY: '¥', CNY: '¥',
    TWD: 'NT$', CAD: 'CA$', AUD: 'A$', INR: '₹', BRL: 'R$', MXN: 'MX$',
  };
  const code = currency?.toUpperCase().trim() || 'EUR';
  const symbol = symbolMap[code] ?? (code + ' ');
  const sign = val < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(val).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toUSD(val: number, currency: string, rates: ExchangeRates): number {
  const code = currency?.toUpperCase().trim() || 'EUR';
  const rate = rates[code] ?? 1;
  return val * rate;
}

function formatWithUSD(val: number, currency: string, showUSD: boolean, rates: ExchangeRates): string {
  const base = formatCurrency(val, currency);
  if (!showUSD || currency?.toUpperCase() === 'USD') return base;
  const usd = toUSD(val, currency, rates);
  return `${base} (${formatCurrency(usd, 'USD')})`;
}
