import AccountingAnalyzer from './components/AccountingAnalyzer';
import { I18nProvider, useI18n } from './i18n';

function AppInner() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amazon-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
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

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <AccountingAnalyzer />
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
