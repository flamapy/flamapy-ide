import { useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Scatter, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ParetoFrontChart = ({ data }) => {
  const chartRef = useRef(null);
  const { objectives = [], solutions = [] } = data || {};
  const numObjectives = objectives.length;

  const downloadPNG = () => {
    const url = chartRef.current?.toBase64Image();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `pareto-front-${numObjectives}d.png`;
    a.click();
  };

  // --- LÓGICA PARA 1 OBJETIVO (BAR CHART) ---
  const barData = {
    labels: solutions.map(s => s.name),
    datasets: [{
      label: objectives[0],
      data: solutions.map(s => s.values[0]),
      backgroundColor: '#356C99',
    }]
  };

  // --- LÓGICA PARA 2 OBJETIVOS (SCATTER CHART) ---
  const scatterData = {
    datasets: [{
      label: 'Pareto Optimal Solutions',
      data: solutions.map(s => ({ x: s.values[0], y: s.values[1], info: s.configuration })),
      backgroundColor: '#356C99',
      pointRadius: 6,
    }]
  };

  // --- LÓGICA PARA 3+ OBJETIVOS (PARALLEL COORDINATES EMULADO CON LINE CHART) ---
  // En Chart.js, el Parallel Coordinates se emula usando las etiquetas como ejes
  const parallelData = {
    labels: objectives,
    datasets: solutions.map((s, i) => ({
      label: s.name,
      data: s.values,
      borderColor: `hsla(${(i * 360) / solutions.length}, 70%, 50%, 0.8)`,
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 4,
    }))
  };

  const getChartConfig = () => {
    if (numObjectives === 1) {
      return { 
        Component: Bar, 
        chartData: barData, 
        options: { 
          scales: { y: { title: { display: true, text: objectives[0] } } } 
        } 
      };
    }
    if (numObjectives === 2) {
      return { 
        Component: Scatter, 
        chartData: scatterData, 
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                afterLabel: (ctx) => `Config: ${ctx.raw.info}`
              }
            }
          },
          scales: {
            x: { title: { display: true, text: objectives[0] } },
            y: { title: { display: true, text: objectives[1] } }
          }
        }
      };
    }
    // 3 o más: Parallel Coordinates
    return { 
      Component: Line, 
      chartData: parallelData, 
      options: {
        plugins: {
          legend: { display: solutions.length < 10 }, // Ocultar si hay demasiadas líneas
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Value' } }
        }
      } 
    };
  };

  if (numObjectives === 0) return <div>No data available</div>;

  const { Component, chartData, options } = getChartConfig();

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    ...options
  };

  return (
    <div className="w-full p-2">
      <div className="card shadow mb-4 border-0 rounded-xl overflow-hidden">
        <div className="card-header py-3 px-4 bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
          <h6 className="m-0 font-bold text-primary">
            Pareto Front ({numObjectives} Objectives)
          </h6>
          <button onClick={downloadPNG} className="text-sm px-3 py-1 bg-[#356C99] text-white rounded hover:bg-[#0D486C]">
            Download PNG
          </button>
        </div>

        <div className="card-body bg-white p-4">
          <div style={{ height: '400px', position: 'relative' }}>
            <Component ref={chartRef} data={chartData} options={commonOptions} />
          </div>
          
          <div className="mt-4 text-xs text-gray-500 italic">
            {numObjectives >= 3 
              ? "Each line represents a configuration. The vertical axes are the objectives." 
              : "Visualization of the trade-off between objectives."}
          </div>
        </div>
      </div>
    </div>
  );
};

ParetoFrontChart.propTypes = {
  data: PropTypes.shape({
    objectives: PropTypes.arrayOf(PropTypes.string),
    solutions: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      values: PropTypes.arrayOf(PropTypes.number),
      config: PropTypes.string
    })),
  }),
};

export default ParetoFrontChart;