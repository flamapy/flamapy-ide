import { useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Registrar los componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ProductDistributionChart = ({ data }) => {
  const chartRef = useRef(null);

  const downloadPNG = () => {
    const url = chartRef.current?.toBase64Image();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'configuration-distribution.png';
    a.click();
  };
  // Verificamos si los datos ya existen y tienen la estructura esperada
  const { x, y, descriptive_statistics } = data || {};

  if (!x || !y || x.length === 0) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading distribution data...</p>
      </div>
    );
  }
  
  const chartData = {
    labels: x, // Usamos directamente el array x de Flamapy
    datasets: [
      {
        label: 'Number of Configurations',
        data: y, // Usamos directamente el array y de Flamapy
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        lineTension: 0.4, // Suavizado de curva
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.parsed.y} configurations with ${context.label} features`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        title: { display: true, text: 'Configurations count', font: { weight: 'bold' } },
      },
      x: {
        grid: { display: false },
        title: { display: true, text: 'Number of Features', font: { weight: 'bold' } },
      },
    },
  };

  const statDescriptions = {
    "Mean": "The average number of features per configuration.",
    "Standard deviation": "Indicates the variability or spread of the feature counts.",
    "Median": "The middle value in the list of feature counts.",
    "Median absolute deviation": "A robust measure of the variability of the distribution.",
    "Mode": "The most frequent number of features found in the configurations.",
    "Min": "The minimum number of features a satisfiable configuration can have.",
    "Max": "The maximum number of features a satisfiable configuration can have.",
    "Range": "The difference between the maximum and minimum number of features."
};

  return (
    <div className="w-full p-4">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Título */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Configuration Distribution</h3>
          <button
            onClick={downloadPNG}
            className="text-sm px-3 py-1 bg-[#356C99] text-white rounded hover:bg-[#0D486C]"
          >
            Download PNG
          </button>
        </div>

        <div className="p-6">
          {/* Gráfico */}
          <div className="h-[320px] mb-8">
            <Line ref={chartRef} data={chartData} options={options} />
          </div>

          {/* Grid de Estadísticas Descriptivas */}
          {descriptive_statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(descriptive_statistics).map(([key, value]) => (
                <div 
                  key={key} 
                  // Aquí añadimos el title dinámico. Si no existe en el mapa, usa la clave por defecto.
                  title={statDescriptions[key] || key.replace(/_/g, ' ')} 
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 transition-colors hover:bg-slate-100"
                >
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-lg font-mono font-bold text-slate-800">
                    {typeof value === 'number' 
                      ? Number.isInteger(value) ? value : value.toFixed(2) 
                      : value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ProductDistributionChart.propTypes = {
  data: PropTypes.shape({
    x: PropTypes.array,
    y: PropTypes.array,
    descriptive_statistics: PropTypes.object,
  }),
};

export default ProductDistributionChart;