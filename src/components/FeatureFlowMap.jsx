import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import * as d3 from "d3";

const FeatureFlowMap = ({ data, width = 900, height = 500 }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // limpiar

    // ===== 1. Crear jerarquía =====
    const root = d3.hierarchy(data);

    // IMPORTANTE: acumulamos valores (null -> 0)
    root.sum(d => d.value ?? 0);

    // ===== 2. Layout tipo árbol =====
    const treeLayout = d3.tree().size([height - 50, width - 200]);
    treeLayout(root);

    // ===== 3. Escalas =====
    const maxValue = d3.max(root.descendants(), d => d.value) || 1;

    const linkWidthScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([1, 20]);

    // ===== 4. Grupo principal =====
    const g = svg.append("g")
      .attr("transform", "translate(100,20)");

    // ===== 5. Generador de enlaces =====
    const linkGenerator = d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x);

    // ===== 6. Links (flows) =====
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", linkGenerator)
      .attr("fill", "none")

      // 🔴 color según valor
      .attr("stroke", d => {
        const val = d.target.data.value;
        return val == null ? "#e74a3b" : "#4e73df";
      })

      // 🔴 línea discontinua si NO hay valor
      .attr("stroke-dasharray", d => {
        const val = d.target.data.value;
        return val == null ? "5,5" : "0";
      })

      // 🔴 grosor
      .attr("stroke-width", d => {
        const val = d.target.data.value;
        return val == null ? 2 : linkWidthScale(d.target.value);
      })

      .attr("stroke-opacity", 0.7);

    // ===== 7. Nodes =====
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`);

    // 📏 tamaño base del rectángulo
    const rectWidth = 120;
    const rectHeight = 30;

    // 🟥 rectángulo (sin relleno)
    node.append("rect")
      .attr("x", -rectWidth / 2)
      .attr("y", -rectHeight / 2)
      .attr("width", rectWidth)
      .attr("height", rectHeight)
      .attr("rx", 6) // bordes redondeados
      .attr("ry", 6)
      .attr("fill", "none") // 🔥 sin color
      .attr("stroke", d => {
        return d.data.value == null ? "#e74a3b" : "#333";
      })
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", d => {
        return d.data.value == null ? "4,3" : "0";
      });

    // 📝 texto centrado
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .text(d => d.data.name);

    // ===== 8. Zoom & Pan =====
    const zoom = d3.zoom().on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

    svg.call(zoom);

  }, [data, width, height]);

  return (
    <div className="w-full bg-white rounded-xl shadow p-4">
      <h3 className="text-lg font-bold mb-2">
        Feature Flow Map (D3)
      </h3>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

FeatureFlowMap.propTypes = {
  data: PropTypes.object,
  width: PropTypes.number,
  height: PropTypes.number,
};

export default FeatureFlowMap;