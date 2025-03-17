/* eslint-disable react/prop-types */
import { useEffect, useState, useRef } from "react";
import Tree from "react-d3-tree";
import { elementToSVG } from "dom-to-svg";

// Function to draw an arc between the children
const drawSemicircle = (rectWidth, rectHeight, isAlternative) => {
  const radius = rectWidth / 4;
  const startX = radius;
  const startY = rectHeight / 2;
  const endX = -radius;
  const endY = rectHeight / 2;

  return (
    <path
      d={`M ${startX},${startY} A ${radius},${radius} 0 0,1 ${endX},${endY}`}
      fill={isAlternative ? "none" : "gray"}
      stroke="black"
      strokeWidth="1"
      className="group"
    />
  );
};

// Helper function to calculate the width of a text string
const calculateTextWidth = (text, fontSize) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${fontSize}px sans-serif`;
  return context.measureText(text).width;
};

const RenderRectSvgNode = ({ nodeDatum, toggleNode }) => {
  const rectWidth = 130;
  const rectHeight = 60;
  const padding = 10;
  const availableWidth = rectWidth - 2 * padding;

  const isMandatory = nodeDatum.attributes?.isMandatory;
  const isOptional = nodeDatum.attributes?.isOptional;
  const isAlternativeGroup = nodeDatum.attributes?.isAlternativeGroup;
  const isOrGroup = nodeDatum.attributes?.isOrGroup;
  const isAbstract = nodeDatum.attributes?.isAbstract;
  const isMultifeature = nodeDatum.attributes?.isMultifeature;
  const featureCardinalityMin = nodeDatum.attributes?.featureCardinality.min;
  const featureCardinalityMax = nodeDatum.attributes?.featureCardinality.max == -1 ? "*" : nodeDatum.attributes?.featureCardinality.max;
  const featureCardinality = isMultifeature ? " [" + featureCardinalityMin + ".." + featureCardinalityMax + "]" : "";
  const isNumerical = nodeDatum.attributes?.isNumerical;
  const isString = nodeDatum.attributes?.isString;
  const featureType = isNumerical || isString ? " : " + nodeDatum.attributes?.featureType : "";

  const nodeName = nodeDatum.name + featureCardinality + featureType;
  const defaultFontSize = 20;

  const [fontSize, setFontSize] = useState(defaultFontSize);

  useEffect(() => {
    const textWidth = calculateTextWidth(nodeName, defaultFontSize);

    if (textWidth > availableWidth) {
      const newFontSize = (availableWidth / textWidth) * defaultFontSize;
      setFontSize(newFontSize);
    } else {
      setFontSize(defaultFontSize);
    }
  }, [nodeName]);

  const dotPosition = { x: 0, y: -rectHeight / 2 };

  return (
    <g>
      {/* Rectangle to represent the node */}
      <rect
        width={rectWidth}
        height={rectHeight}
        x={-rectWidth / 2}
        y={-rectHeight / 2}
        fill={isAbstract ? "lightgray" : "lightblue"}
        stroke="blue"
        strokeWidth="1"
        rx="10"
        onClick={toggleNode}
      />

      {/* Node name inside the rectangle */}
      <text
        fill="black"
        x="0"
        y="5"
        textAnchor="middle"
        style={{ fontSize: `${fontSize}px`, fontWeight: "lighter", fontStyle: isAbstract ? "italic" : "normal" }}
      >
        {nodeName}
      </text>

      {/* Render a black dot if the feature is mandatory */}
      {isMandatory && (
        <circle cx={dotPosition.x} cy={dotPosition.y} r={5} fill="black" />
      )}

      {/* Render a white dot if the feature is optional */}
      {isOptional && (
        <circle
          cx={dotPosition.x}
          cy={dotPosition.y}
          r={5}
          fill="white"
          stroke="black"
        />
      )}

      {/* Render arc between children if it's an alternative group */}
      {(isAlternativeGroup || isOrGroup) && (
        <g>{drawSemicircle(rectWidth, rectHeight, isAlternativeGroup)}</g>
      )}
    </g>
  );
};

// Component that renders the tree and centers it
export default function FeatureModelVisualization({ treeData, constraints }) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null); // Reference to the parent container
  const svgRef = useRef(null); // Reference to the SVG container for exporting
  const [showConstraints, setShowConstraints] = useState(false);

  // Function to update the tree's translation based on the container size
  const updateTreePosition = () => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setTranslate({ x: width / 2, y: height / 4 });
    }
  };

  // Run on initial render and window resize to update the tree position
  useEffect(() => {
    updateTreePosition();
    window.addEventListener("resize", updateTreePosition);
    return () => window.removeEventListener("resize", updateTreePosition);
  }, []);

  const exportSVG = () => {
    const svgElement = svgRef.current.querySelector("svg");
    if (!svgElement) return;

    const paths = svgElement.querySelectorAll("path:not(.group)");
    paths.forEach((path) => {
      path.setAttribute("stroke", "black");
      path.setAttribute("stroke-width", "1");
      path.setAttribute("fill", "none");
    });

    const svgDocument = elementToSVG(svgRef.current);

    const svgData = new XMLSerializer().serializeToString(svgDocument);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "tree-visualization.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const straightPathFunc = (linkDatum) => {
    const { source, target } = linkDatum;
    return `M${source.x},${source.y + 30}L${target.x},${target.y - 30}`;
  };

  return (
    <div ref={containerRef} className="w-full h-full relative mb-2 mt-2">
      <div className="absolute top-4 left-4 flex flex-col">
        <button
          onClick={exportSVG}
          className=" bg-blue-500 text-white px-4 py-2 rounded-md mb-2"
        >
          Export as SVG
        </button>
        {constraints && constraints.length > 0 && (
          <button
            className="bg-blue-500 text-white px-4 py-2  rounded-md"
            onClick={() => setShowConstraints(!showConstraints)}
          >
            {showConstraints ? "Hide" : "Show"} Constraints
          </button>
        )}
      </div>
      {/* Tree component from react-d3-tree */}
      <div ref={svgRef} className="w-full h-full">
        <Tree
          data={treeData}
          translate={translate}
          renderCustomNodeElement={(rd3tProps) => (
            <RenderRectSvgNode
              nodeDatum={rd3tProps.nodeDatum}
              toggleNode={rd3tProps.toggleNode}
            />
          )}
          orientation="vertical"
          pathFunc={straightPathFunc}
        />
        {showConstraints && constraints && constraints.length > 0 && (
          <div className="absolute top-4 right-4 p-4 rounded-lg bg-neutral-300 h-min">
            <div className="font-bold text-xl px-4 py-2">Constraints</div>
            {constraints.map((constraint, index) => (
              <div key={index} className="text-s font-mono">
                {constraint}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
