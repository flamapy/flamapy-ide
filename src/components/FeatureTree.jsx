/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { ResizableBox } from "react-resizable";
import DropdownMenu from "./DropdownMenu";

// TreeNode component
const TreeNode = ({ node, statusMap, setStatusMap }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentStatus = statusMap[node.name];

  const handleExpandToggle = () => {
    if (node.children) setIsExpanded((prev) => !prev);
  };

  const handleStatusToggle = () => {
    const newStatus =
      currentStatus === true
        ? false
        : currentStatus === false
        ? undefined
        : true;

    setStatusMap((prev) => {
      const updated = { ...prev };
      if (newStatus === undefined) {
        delete updated[node.name];
      } else {
        updated[node.name] = newStatus;
      }
      return updated;
    });
  };

  const getStatusLabel = (status) => {
    if (status === true) return "✔️";
    if (status === false) return "❌";
    return "—";
  };

  const getStatusColor = (status) => {
    if (status === true) return "bg-green-500";
    if (status === false) return "bg-red-300";
    return "bg-gray-400";
  };

  return (
    <div className="ml-4 mt-2 space-y-1">
      <div className="flex justify-between items-center bg-white rounded px-2 py-1 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2">
          {node.children && (
            <button
              onClick={handleExpandToggle}
              className="text-sm px-1 rounded bg-gray-300 hover:bg-gray-400 transition-colors"
              aria-label="Toggle expand"
            >
              {isExpanded ? "−" : "+"}
            </button>
          )}
          <div
            className={`font-medium cursor-default ${
              node.children ? "text-blue-700" : "text-black"
            }`}
          >
            {node.name}
          </div>
        </div>

        <button
          onClick={handleStatusToggle}
          className={`text-white text-sm px-2 py-1 rounded ${getStatusColor(
            currentStatus
          )} transition-colors hover:brightness-110`}
          aria-label="Toggle status"
        >
          {getStatusLabel(currentStatus)}
        </button>
      </div>

      {isExpanded && node.children && (
        <div className="ml-2 border-l border-gray-300 pl-2">
          {node.children.map((child, i) => (
            <TreeNode
              key={`${node.name}-${i}`}
              node={child}
              statusMap={statusMap}
              setStatusMap={setStatusMap}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// TreeView component
const TreeView = ({ treeData, executeAction }) => {
  const SATOperations = [
    {
      label: "Valid Configuration",
      value: "PySATSatisfiableConfiguration",
      isOperationWithConf: true,
    },
    {
      label: "Interactive Configuration",
      value: "configurator",
      isOperationWithConf: false,
    },
    {
      label: "Download Configurator",
      value: "downloadConfigurator",
      isOperationWithConf: false,
    },
  ];

  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    setStatusMap({});
  }, [treeData]);

  return (
    <ResizableBox
      width={300}
      height={Infinity}
      axis="x"
      minConstraints={[200, Infinity]}
      maxConstraints={[500, Infinity]}
      className="bg-neutral-300 text-neutral-900 p-4 resize-handle-right rounded-lg overflow-auto relative shadow-md"
      handle={
        <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-20" />
      }
    >
      <div className="space-y-4">
        <DropdownMenu
          buttonLabel={"Configuration Operations"}
          options={SATOperations}
          executeAction={(action) => executeAction(action, statusMap)}
        />

        {treeData && (
          <TreeNode
            node={treeData}
            statusMap={statusMap}
            setStatusMap={setStatusMap}
          />
        )}
      </div>
    </ResizableBox>
  );
};

export default TreeView;
