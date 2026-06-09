/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";
import { vsIconBtn } from "./ui/styles";

// Slim banner matching the editor's VSCode-style title bar (same height, logo
// size and link styling). Used by the marketing / info pages so the chrome
// stays consistent across the whole app.
function Navbar({ children, controls, darkMode, toggleDark }) {
  return (
    <header className="relative z-20 flex items-center gap-4 h-9 px-3 bg-white dark:bg-gray-800 border-b border-black/10 dark:border-white/10 shrink-0">
      <Link to="/" className="flex items-center gap-1.5 shrink-0">
        <img
          src="assets/flamapy_horizontal_logo_white.svg"
          alt="Flamapy logo"
          width="110"
        />
        <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
          IDE
        </span>
      </Link>
      <div className="flex-1 flex justify-center overflow-visible">
        {controls && (
          <div className="relative flex items-end gap-2 whitespace-nowrap overflow-visible">
            {controls}
          </div>
        )}
      </div>
      <nav className="flex items-center gap-4 shrink-0">
        {children}
        <button
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          className={vsIconBtn}
        >
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

export default Navbar;
