/* eslint-disable react/prop-types */
import { useState, useRef, useEffect } from "react";

const DropdownMenu = ({
  options,
  buttonLabel,
  executeAction,
  className = "w-full bg-[#356C99] text-white py-2 px-4 rounded shadow-lg flex justify-between items-center",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleAction = async (action) => {
    await executeAction(action);
    setIsOpen(false);
  };

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

  return (
    <div ref={dropdownRef} className="relative inline-block w-max">
      <button
        onClick={handleToggle}
        className={className}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {buttonLabel}
        <span className="ml-2">&#9660;</span>
      </button>

      {isOpen && (
        <div
          className="absolute w-full mt-1 bg-white border border-[#356C99] rounded-lg shadow-lg z-10"
          role="menu"
        >
          {options?.length ? (
            options.map((option) => (
              <div
                key={option.label}
                onClick={() => handleAction(option)}
                tabIndex={0}
                className="w-full text-left py-2 px-4 cursor-pointer hover:bg-[#0D486C] text-[#356C99] hover:text-white focus:outline-none focus:bg-[#0D486C] focus:text-white"
                role="menuitem"
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="py-2 px-4 text-gray-500">No options available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
