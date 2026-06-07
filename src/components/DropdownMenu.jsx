/* eslint-disable react/prop-types */
import { useState, useRef, useEffect } from "react";

const DropdownMenu = ({
  options,
  buttonLabel,
  executeAction,
  className = "w-full bg-[#356C99] text-white py-2 px-4 rounded shadow-lg flex justify-between items-center",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const itemRefs = useRef([]);
  const [menuStyle, setMenuStyle] = useState(null);

  const selectableOptions = options?.filter(
    (o) => o.type !== "section" && o.type !== "divider"
  ) ?? [];

  const handleToggle = () => {
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setFocusedIndex(-1);
    setIsOpen((prev) => !prev);
  };

  const handleAction = async (action) => {
    await executeAction(action);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        handleToggle();
      }
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      setFocusedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, selectableOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      handleAction(selectableOptions[focusedIndex]);
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0) itemRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  let selectableIdx = -1;

  return (
    <div ref={dropdownRef} className="relative inline-block w-max z-50" onKeyDown={handleKeyDown}>
      <button
        onClick={handleToggle}
        className={className}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {buttonLabel}
        <svg
          className={`ml-2 w-3 h-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-[#356C99] dark:border-gray-600 rounded-lg shadow-lg z-50"
          style={{
            top: menuStyle?.top ?? 0,
            left: menuStyle?.left ?? 0,
            minWidth: menuStyle?.width ?? "auto",
          }}
          role="menu"
        >
          {options?.length ? (
            options.map((option) => {
              if (option.type === "section") {
                return (
                  <div
                    key={option.label}
                    className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {option.label}
                  </div>
                );
              }
              if (option.type === "divider") {
                return <div key={option.label} className="border-t border-gray-200 my-1" />;
              }
              const idx = ++selectableIdx;
              return (
                <div
                  key={option.label}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onClick={() => handleAction(option)}
                  onKeyDown={(e) => e.key === "Enter" && handleAction(option)}
                  tabIndex={0}
                  className={`w-full text-left py-2 px-4 cursor-pointer focus:outline-none ${
                    focusedIndex === idx
                      ? "bg-[#0D486C] text-white"
                      : "text-[#356C99] dark:text-blue-300 hover:bg-[#0D486C] hover:text-white focus:bg-[#0D486C] focus:text-white"
                  }`}
                  role="option"
                  aria-selected={focusedIndex === idx}
                >
                  {option.label}
                </div>
              );
            })
          ) : (
            <div className="py-2 px-4 text-gray-500">No options available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
