/* eslint-disable react/prop-types */
import { useEffect } from "react";

// Shared modal shell: fixed overlay with dialog semantics, Escape and
// backdrop-click to close. Children render the modal body and buttons.
function Modal({ onClose, title, maxWidth = "max-w-md", children }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${maxWidth} w-full mx-4 p-6`}
      >
        {title && (
          <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}

export default Modal;
