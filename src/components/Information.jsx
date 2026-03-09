import { useState, useEffect } from "react";

function Information({ msg, type = "info" }) {
  const [color, setColor] = useState(null);
  useEffect(() => {
    if (type === "info") {
      setColor("bg-yellow-700");
    } else if (type === "error") {
      setColor("bg-red-700");
    } else if (type === "success") {
      setColor("bg-green-600");
    }
  }, []);
  return (
    <div className={`${color} w-full rounded-xl p-4 text-xl mb-2`}>
      <p className="text-lg font-semibold text-white">{msg}</p>
    </div>
  );
}

export default Information;
