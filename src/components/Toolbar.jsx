/* eslint-disable react/prop-types */

function Toolbar({ children }) {
  return (
    <div className="flex justify-between items-center py-2 px-2 bg-white shadow">
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default Toolbar;
