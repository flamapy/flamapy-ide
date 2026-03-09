/* eslint-disable react/prop-types */
function CustomButton({ active = true, onClick, children }) {
  const baseClasses =
    "w-max text-white py-2 px-4 m-2 rounded shadow-lg transition-colors duration-200";
  const activeClasses = "bg-[#356C99] hover:bg-[#0D486C]";
  const disabledClasses = "bg-gray-400 cursor-not-allowed";

  return (
    <button
      className={`${baseClasses} ${active ? activeClasses : disabledClasses}`}
      onClick={active ? onClick : undefined}
      disabled={!active}
    >
      {children}
    </button>
  );
}

export default CustomButton;
