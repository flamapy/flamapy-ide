/* eslint-disable react/prop-types */
import Modal from "./ui/Modal";

// Single-attribute picker (used by the Feature Flow Map view).
function AttributeSelectionModal({
  attributes,
  selected,
  onSelect,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title="Select Attribute" maxWidth="max-w-3xl" onClose={onCancel}>
      <div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 rounded">
        {attributes && attributes.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Select</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Attribute</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {attributes.map((attribute) => (
                <tr key={attribute}>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <input
                      type="radio"
                      name="attribute"
                      checked={selected === attribute}
                      onChange={() => onSelect(attribute)}
                      className="h-4 w-4 text-blue-600 border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {attribute}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-red-500">No numerical attributes available in this model.</p>
        )}
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <button
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          disabled={!selected}
          className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}

export default AttributeSelectionModal;
