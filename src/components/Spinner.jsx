function Spinner() {
  return (
    <div
      className="spinner animate-spin w-5 h-5 border-4 border-solid border-gray-200 border-t-blue-500 rounded-full"
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
export default Spinner;
