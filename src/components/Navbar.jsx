/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";

function Navbar({ children, controls, darkMode, toggleDark }) {
  return (
    <nav className="relative z-20 flex items-center py-4 px-6 bg-white dark:bg-gray-800 shadow gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/"
          className="flex flex-rowtext-blue-950 text-xl font-semibold"
        >
          <img
            src="assets/flamapy_horizontal_logo_white.svg"
            alt="Flamapy logo"
            width="140rem"
          />
          IDE
        </Link>
      </div>
      <div className="flex-1 flex justify-center overflow-visible">
        {controls && (
          <div className="relative flex items-end gap-2 whitespace-nowrap overflow-visible">
            {controls}
          </div>
        )}
      </div>
      <div className="flex gap-4 items-center shrink-0">
        {children}
        <button
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
