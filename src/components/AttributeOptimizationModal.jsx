/* eslint-disable react/prop-types */
import Modal from "./ui/Modal";

// Z3 attribute optimization: pick which numerical attributes to optimize and
// in which direction. `goals` is {attribute: {selected, goal}}.
function AttributeOptimizationModal({
  attributes,
  goals,
  onToggle,
  onGoalChange,
  onExecute,
  onCancel,
}) {
  const hasSelection = Object.values(goals).some((g) => g.selected);

  return (
    <Modal title="Select Optimization Goals" maxWidth="max-w-3xl" onClose={onCancel}>
      <div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 rounded">
        {attributes && attributes.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Optimize</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Attribute</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Goal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {attributes.map((attribute) => {
                const isSelected = goals[attribute]?.selected || false;
                const goal = goals[attribute]?.goal || "Minimize";
                return (
                  <tr key={attribute}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggle(attribute, e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {attribute}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <select
                        value={goal}
                        disabled={!isSelected}
                        onChange={(e) => onGoalChange(attribute, e.target.value)}
                        className={`mt-1 block w-full py-1 px-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm ${
                          !isSelected ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400" : "bg-white dark:bg-gray-600 dark:text-gray-200"
                        }`}
                      >
                        <option value="Minimize">Minimize</option>
                        <option value="Maximize">Maximize</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
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
          disabled={!hasSelection}
          className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onExecute}
        >
          Execute Optimization
        </button>
      </div>
    </Modal>
  );
}

export default AttributeOptimizationModal;
