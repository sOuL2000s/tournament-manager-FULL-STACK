// 📁 src/components/LanguageSwitcher.jsx
import React from 'react';

export default function LanguageSwitcher({ lang, setLang }) {
  return (
    <select
      value={lang} // Controlled component: value is determined by the `lang` prop
      onChange={(e) => {
        setLang(e.target.value); // Update the language state
        localStorage.setItem('lang', e.target.value); // Persist the selected language in local storage
      }}
      className="border px-2 py-1 rounded bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {/* Language Options with Emojis */}
      <option value="en">🇬🇧 English</option>
      <option value="hi">🇮🇳 हिंदी</option>
      <option value="bn">🇧🇩 বাংলা</option>
    </select>
  );
}
