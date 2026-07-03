/* eslint-disable react/prop-types */
import { useState } from "react";
import Modal from "./ui/Modal";
import { DEFAULT_REST_URL } from "../utils/computeBackend";

// Lets the user point the "Remote API" compute backend at a flamapy-rest server.
// Defaults to DEFAULT_REST_URL (rest.flamapy.org) and is reachable from the
// Compute section in the toolbar.
function BackendSettingsModal({ url, onSave, onCancel }) {
  const [value, setValue] = useState(url || DEFAULT_REST_URL);
  const trimmed = value.trim();
  const canSave = /^https?:\/\/.+/.test(trimmed);

  function save() {
    if (canSave) onSave(trimmed.replace(/\/+$/, ""));
  }

  return (
    <Modal onClose={onCancel}>
        <h3 className="text-xl font-bold mb-1 text-gray-800 dark:text-gray-200">
          Remote API backend
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Analysis operations will run on this flamapy-rest server instead of in
          your browser. Your model is uploaded to it on each operation.
        </p>

        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
          Server URL
        </label>
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={DEFAULT_REST_URL}
          autoFocus
          className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
        />
        {!canSave && (
          <p className="mt-2 text-sm text-red-500">
            Enter a valid http(s) URL.
          </p>
        )}

        <div className="mt-3">
          <button
            className="text-xs text-[#356C99] hover:underline"
            onClick={() => setValue(DEFAULT_REST_URL)}
            type="button"
          >
            Reset to default ({DEFAULT_REST_URL})
          </button>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            disabled={!canSave}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={save}
          >
            Save
          </button>
        </div>
    </Modal>
  );
}

export default BackendSettingsModal;
