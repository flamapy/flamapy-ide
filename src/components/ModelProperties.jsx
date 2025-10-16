/* eslint-disable react/prop-types */
import { useState } from "react";

const ModelProperties = ({ modelProperties }) => {
  return (
    <div className="p-4 bg-white rounded shadow-lg mt-2">
      <div className="w-full bg-green-600 text-white text-center py-3 px-4 rounded-md mb-4">
        The model is valid
      </div>

      <h2 className="text-[#0D486C] font-bold text-2xl mb-4">
        Model Information
      </h2>

      <div className="divide-y divide-neutral-300 space-y-2">
        {Object.entries(modelProperties).map(([key, value]) => (
          <div key={key} className="mb-4">
            <span className="font-bold text-neutral-900">{key}:</span>
            {Array.isArray(value) ? (
              <CollapsibleList items={value} />
            ) : (
              <span className="ml-4 font-mono text-[#171a1b]">{value}</span>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-[#0D486C] font-bold text-2xl mb-4">
        Open in <img src="/assets/logo_fmfactlabel.svg" alt="FM Fact Label" className="inline h-16 w-16 align-middle" />
      </h2>
    </div>
  );
};

const CollapsibleList = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="ml-4">
      <button
        className="text-[#0D486C] font-mono underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "Hide Details" : "Show Details"}
      </button>
      {isOpen && (
        <ul className="list-disc list-inside mt-2 space-y-1">
          {items.map((item, index) => (
            <li key={index} className="font-mono text-[#0D486C]">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ModelProperties;
