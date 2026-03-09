import { useState, useEffect } from "react";
import PropTypes from 'prop-types';

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
  }, [type]);
  return (
    <div className={`${color} w-full rounded-xl p-4 text-xl mb-2`}>
      <p className="text-lg font-semibold text-white">{msg}</p>
    </div>
  );
}

Information.propTypes = {
  msg: PropTypes.string.isRequired,
  type: PropTypes.string,
};

export default Information;
