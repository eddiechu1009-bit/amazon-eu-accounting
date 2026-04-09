import { useState } from 'react';
import AccountingAnalyzer from './components/AccountingAnalyzer';
import AdAnalyzer from './components/AdAnalyzer';
import { I18nProvider, useI18n } from './i18n';

type AppMode = 'accounting' | 'ads';

function AppInner() {
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<AppMode>('accounting');
  const isEn = lang === 'en';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amazon-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{mode === 'accounting' ? '📊' : '📢'}</span>
          <div>
            <h1 className="text-lg font-semibold">{t('appTitle')}</h1>
            <p className="text-xs text-gray-400">{t('appSubtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="px-3 py-1.5 text-sm bg-amazon-light hover:bg-amazon-blue rounded-lg transition-all duration-200 flex items-center gap-1.5 hover:shadow-md"
          aria-label="Switch language"
        >
          🌐 {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </header>

      {/* Mode Switch */}
      <nav className="bg-white border-b sticky top-[52px] z-40 shadow-sm">
        <div className="max-w-6xl mx-auto flex">
          <button
            onClick={() => setMode('accounting')}
            className={`flex-1 px-4 py-3 text-center transition-all duration-200 border-b-3 text-sm font-medium ${
              mode === 'accounting'
                ? 'border-amazon-orange text-amazon-dark bg-orange-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            📊 {isEn ? 'Settlement Analysis' : '帳務分析'}
          </button>
          <button
            onClick={() => setMode('ads')}
            className={`flex-1 px-4 py-3 text-center transition-all duration-200 border-b-3 text-sm font-medium ${
              mode === 'ads'
                ? 'border-amazon-orange text-amazon-dark bg-orange-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            📢 {isEn ? 'Ad Report Analysis' : '廣告報告分析'}
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {mode === 'accounting' && <AccountingAnalyzer />}
        {mode === 'ads' && <AdAnalyzer />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t">
        {t('footerLine1')}
        <br />{t('footerLine2')}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a href="https://eddiechu1009-bit.github.io/amazon-eu-tools/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-100 hover:bg-amazon-orange/10 hover:text-amazon-dark rounded-lg transition-all duration-200">🇪🇺 新賣家準備工具</a>
          <a href="https://eddiechu1009-bit.github.io/amazon-eu-seller-toolkit/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-100 hover:bg-amazon-orange/10 hover:text-amazon-dark rounded-lg transition-all duration-200">🛠️ 營運工具箱</a>
          <a href="https://eddiechu1009-bit.github.io/amazon-case-writer/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-100 hover:bg-amazon-orange/10 hover:text-amazon-dark rounded-lg transition-all duration-200">📝 Case 撰寫工具</a>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
