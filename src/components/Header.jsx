// Inside src/components/Header.jsx
export default function Header({ darkMode, setDarkMode, lang, setLang, t, setToken }) {
  return (
    <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b dark:border-gray-700">
      <h1 className="text-xl font-bold text-center sm:text-left">{t.title}</h1>
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <LanguageSwitcher lang={lang} setLang={setLang} />
        <button onClick={() => setDarkMode(!darkMode)} className="bg-gray-200 dark:bg-gray-700 px-4 py-1 rounded">
          {darkMode ? t.light : t.dark}
        </button>
        <button onClick={() => {
          localStorage.removeItem('token');
          setToken(null);
        }} className="bg-red-500 text-white px-4 py-1 rounded">
          {t.logout}
        </button>
      </div>
    </div>
  );
}
