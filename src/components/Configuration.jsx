function Configuration({ configuration }) {
  const categorizedConfig = {
    selected: [],
    deselected: [],
    undecided: [],
  };

  Object.entries(configuration).forEach(([feature, status]) => {
    if (status === true) {
      categorizedConfig.selected.push(feature);
    } else if (status === false) {
      categorizedConfig.deselected.push(feature);
    } else {
      categorizedConfig.undecided.push(feature);
    }
  });

  return (
    <div className="bg-white w-full rounded-xl p-4 text-xl shadow-md overflow-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Feature Configuration
      </h2>
      <div className="text-lg">
        <div className="mb-2">
          <h3 className="font-semibold text-green-600">Selected Features:</h3>
          <ul className="list-disc list-inside text-black">
            {categorizedConfig.selected.length > 0 ? (
              categorizedConfig.selected.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))
            ) : (
              <p className="text-gray-500">None</p>
            )}
          </ul>
        </div>

        <div className="mb-2">
          <h3 className="font-semibold text-red-600">Deselected Features:</h3>
          <ul className="list-disc list-inside text-black">
            {categorizedConfig.deselected.length > 0 ? (
              categorizedConfig.deselected.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))
            ) : (
              <p className="text-gray-500">None</p>
            )}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-yellow-600">Undecided Features:</h3>
          <ul className="list-disc list-inside text-black">
            {categorizedConfig.undecided.length > 0 ? (
              categorizedConfig.undecided.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))
            ) : (
              <p className="text-gray-500">None</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Configuration;
