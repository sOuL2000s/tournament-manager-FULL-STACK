// 📁 src/components/LanguageSwitcher.jsx
import React from 'react';

export default function LanguageSwitcher({ lang, setLang }) {
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="border px-2 py-1 rounded bg-white dark:bg-gray-800 dark:text-white"
    >
      <option value="en">🇬🇧 English</option>
      <option value="hi">🇮🇳 हिंदी</option>
      <option value="bn">🇧🇩 বাংলা</option>
    </select>
  );
}
