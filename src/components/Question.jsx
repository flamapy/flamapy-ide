/* eslint-disable react/prop-types */
function Question({ title, options, questionType, selected, onUpdate }) {
  // Handle selection updates
  const handleChange = (value) => {
    if (questionType === "optional" || questionType === "or") {
      // Allow multiple selections
      const newSelected = selected.includes(value)
        ? selected.filter((item) => item !== value) // Remove if already selected
        : [...selected, value]; // Add if not selected
      onUpdate(newSelected);
    } else if (questionType === "alternative") {
      // Allow single selection
      onUpdate([parseInt(value)]);
    }
  };

  // Validation for 'or' type
  const isOrInvalid = questionType === "or" && selected.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-700 w-full rounded-xl p-4 text-xl">
        <p className="text-lg font-semibold text-white">{title}</p>
      </div>

      {/* Render options based on question type */}
      {questionType === "optional" || questionType === "or" ? (
        // Multiple selection (checkboxes)
        <div>
          {options?.map((option, index) => (
            <label key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                value={option.id}
                checked={selected.includes(option.id)}
                onChange={() => handleChange(option.id)}
              />
              {option.name}
            </label>
          ))}
          {isOrInvalid && (
            <p className="text-red-500 text-sm">
              Please select at least one option.
            </p>
          )}
        </div>
      ) : questionType === "alternative" && options.length <= 4 ? (
        // Single selection (radio buttons)
        <div>
          {options?.map((option, index) => (
            <label key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="alternative"
                value={option.id}
                checked={selected.includes(option.id)}
                onChange={() => handleChange(option.id)}
              />
              {option.name}
            </label>
          ))}
        </div>
      ) : (
        // Single selection (select dropdown for 5+ options)
        <select
          defaultValue={-1}
          className="p-2 border rounded w-max text-white py-2 px-4 m-2 shadow-lg transition-colors duration-200 bg-[#356C99] hover:bg-[#0D486C]"
          onChange={(option) => handleChange(option.target.value)}
        >
          <option value={-1} disabled>
            Select an option
          </option>
          {options?.map((option, index) => (
            <option
              key={index}
              value={option.id}
              selected={selected.includes(option.id)}
            >
              {option.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default Question;
