import { HiOutlineMenu } from "react-icons/hi";
import {
  languageDisplayNames,
  languageOptions,
  type Language,
  type Translation,
} from "../i18n";

type AppHeaderProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  t: Translation;
};

export function AppHeader({
  isSidebarOpen,
  onToggleSidebar,
  language,
  onLanguageChange,
  t,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-[1200] bg-white/50 dark:bg-slate-900/60 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="w-full px-6 py-3 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
            aria-pressed={isSidebarOpen}
            aria-label={isSidebarOpen ? t.toggleSidebarHide : t.toggleSidebarShow}
          >
            <HiOutlineMenu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">{t.headerTitle}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.headerDescription}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-full border border-slate-300 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800"
            role="group"
            aria-label={t.languageButtonLabel}
          >
            {languageOptions.map((option, index) => {
              const isActive = language === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onLanguageChange(option)}
                  className={`px-4 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-sky-600 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700"
                  } ${index === 0 ? "rounded-l-full" : ""} ${
                    index === languageOptions.length - 1 ? "rounded-r-full" : ""
                  }`}
                  aria-pressed={isActive}
                >
                  {languageDisplayNames[option]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
