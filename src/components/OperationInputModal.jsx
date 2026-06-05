/* eslint-disable react/prop-types */
import { useState } from "react";

// Collects the single extra argument an operation needs before running (see the
// `input` descriptor in EditorPage's OPERATIONS table). Supports a feature picker
// ("feature" — choose from `options`) and a numeric field ("integer").
function OperationInputModal({ action, options, onConfirm, onCancel }) {
  const input = action.input;
  const [value, setValue] = useState(input.kind === "integer" ? String(input.min ?? 0) : "");

  const canConfirm = value !== "" && !(input.kind === "feature" && !options?.length);

  function confirm() {
    if (!canConfirm) return;
    onConfirm(input.kind === "integer" ? Number(value) : value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">{action.label}</h3>
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">{input.prompt}</label>

        {input.kind === "integer" ? (
          <input
            type="number"
            min={input.min}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            autoFocus
            className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
          />
        ) : options?.length ? (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
          >
            <option value="" disabled>Select…</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-red-500">No features available in this model.</p>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={confirm}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}

export default OperationInputModal;
