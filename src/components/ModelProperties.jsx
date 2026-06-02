/* eslint-disable react/prop-types */
import { useState } from "react";

const ModelProperties = ({ modelProperties }) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow-lg mt-2">
      <div className="w-full bg-green-600 text-white text-center py-3 px-4 rounded-md mb-4">
        The model is syntactically valid
      </div>

      <h2 className="text-[#0D486C] dark:text-blue-300 font-bold text-2xl mb-4">
        Model Information
      </h2>

      <div className="divide-y divide-neutral-300 dark:divide-gray-600 space-y-2">
        {Object.entries(modelProperties).map(([key, value]) => (
          <div key={key} className="mb-4">
            <span className="font-bold text-neutral-900 dark:text-gray-100">{key}:</span>
            {Array.isArray(value) ? (
              <CollapsibleList items={value} isOpenDefault={false} />
            ) : (
              <span className="ml-4 font-mono text-[#171a1b] dark:text-gray-200">{value}</span>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

const CollapsibleList = ({ items, isOpenDefault, decimal = false}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  return (
    <div className="ml-4">
      <button
        className="text-[#0D486C] dark:text-blue-300 font-mono underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "Hide Details" : "Show Details"}
      </button>
      {isOpen && (
        <ul className={`list-${decimal ? 'decimal': 'disc'} list-inside mt-2 space-y-1`}>
          {items.map((item, index) => (
            <li key={index} className="font-mono text-[#0D486C] dark:text-blue-300">
              {Array.isArray(item) ? (<>
                <span className=" font-mono text-[#171a1b] dark:text-gray-200">Atomic Set #{index + 1}</span>
              <CollapsibleList items={item} isOpenDefault={false} decimal={true} />
              </>
            ) : (
              <span className=" font-mono text-[#171a1b] dark:text-gray-200">{item}</span>
            )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ModelProperties;
