/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";
import { vsIconBtn } from "../ui/styles";

// Slim VSCode-style title bar: logo on the left, navigation links + dark-mode
// toggle on the right. Used by EditorPage (the editor owns its own chrome).
function TitleBar({ darkMode, toggleDark }) {
  const link =
    "text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:text-accent dark:hover:text-white transition-colors";
  return (
    <header className="flex items-center gap-4 h-9 px-3 bg-white dark:bg-gray-800 border-b border-black/10 dark:border-white/10 shrink-0">
      <Link to="/" className="flex items-center gap-1.5 shrink-0">
        <img src="assets/flamapy_horizontal_logo_white.svg" alt="Flamapy logo" width="110" />
        <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">IDE</span>
      </Link>
      <div className="flex-1" />
      <nav className="flex items-center gap-4 shrink-0">
        <Link to="/how-to-cite-us" className={link}>How to cite us</Link>
        <a
          href="https://github.com/flamapy/flamapy-ide"
          target="_blank"
          rel="noreferrer"
          className={link}
        >
          GitHub
        </a>
        <Link to="/privacy" className={link}>Privacy</Link>
        <button onClick={toggleDark} aria-label="Toggle dark mode" className={vsIconBtn}>
          {darkMode ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </nav>
    </header>
  );
}

export default TitleBar;
