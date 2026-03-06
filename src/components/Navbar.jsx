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
          className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors text-lg"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
