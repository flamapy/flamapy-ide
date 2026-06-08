/* eslint-disable react/prop-types */

// Generic segmented control (VSCode/featuredraw style): a pill group where the
// active option gets a raised white chip. Used for the solver picker and any
// other inline toggle. `options` is [{ value, label, title? }].
function Segmented({ value, onChange, options, className = "" }) {
  return (
    <div
      className={`inline-flex rounded-md border border-black/10 dark:border-white/10 bg-black/[.04] dark:bg-white/[.04] p-0.5 ${className}`}
      role="tablist"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-0.5 text-[12px] rounded-[5px] transition-colors ${
              active
                ? "bg-white dark:bg-gray-700 shadow-sm text-[#2b6cff] dark:text-white font-medium"
                : "text-black/60 dark:text-gray-400 hover:text-black dark:hover:text-gray-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
