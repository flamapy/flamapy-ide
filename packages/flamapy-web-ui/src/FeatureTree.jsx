/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import DropdownMenu from "./DropdownMenu";

// TreeNode component
const TreeNode = ({ node, statusMap, setStatusMap, history }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const currentStatus = history ? history[node.name]: statusMap[node.name];

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
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2">
          {node.children && (
            <button
              onClick={handleExpandToggle}
              className={`text-sm px-1 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors ${history ? 'disabled': ''}`}
              aria-label="Toggle expand"
            >
              {isExpanded ? "−" : "+"}
            </button>
          )}
          <div
            className={`font-medium cursor-default ${
              node.children ? "text-blue-700 dark:text-blue-400" : "text-black dark:text-gray-200"
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
        <div className="ml-2 border-l border-gray-300 dark:border-gray-600 pl-2">
          {node.children.map((child, i) => (
            <TreeNode
              key={`${node.name}-${i}`}
              node={child}
              statusMap={statusMap}
              setStatusMap={setStatusMap}
              history={history}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// TreeView component: the configurator's content (operations menu + feature tree). The
// side-panel frame around it (title, width, scrolling) belongs to the IDE shell.
const TreeView = ({ treeData, executeAction, operations, history }) => {
  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    setStatusMap({});
  }, [treeData, history]);

  return (
    <div className="space-y-3">
      <DropdownMenu
        buttonLabel={"Configuration operations"}
        options={operations}
        executeAction={(action) => executeAction(action, statusMap)}
        className="w-full inline-flex items-center justify-between gap-1 bg-accent text-white py-1.5 px-3 rounded-md text-[12px] hover:bg-[#1d5cf0] transition-colors"
      />

      {treeData && (
        <TreeNode
          node={treeData}
          statusMap={statusMap}
          setStatusMap={setStatusMap}
          history={history}
        />
      )}
    </div>
  );
};

export default TreeView;
