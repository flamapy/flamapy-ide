import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Registramos los componentes necesarios para un gráfico de barras
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const FeatureInclusionProbabilitiesChart = ({ data }) => {
  // Extraemos x, y y colors del objeto recibido
  // Se espera una estructura: { x: [], y: [], colors: [] }
  const { x, y, colors } = data || {};

  if (!x || !y || x.length === 0) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-500 font-medium">Calculating probabilities...</p>
      </div>
    );
  }

  const chartData = {
    labels: x,
    datasets: [
      {
        label: '% Features',
        data: y,
        backgroundColor: colors || '#4e73df', // Usa los colores de Flamapy o un azul por defecto
        borderColor: '#000000',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Ocultamos la leyenda automática porque haremos una manual abajo
      },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (context) => ` ${context.parsed.y}% features`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100, // Al ser porcentajes, suele ser útil fijar el máximo en 100
        title: {
          display: true,
          text: '% Features',
          font: { weight: 'bold' }
        },
      },
      x: {
        title: {
          display: true,
          text: 'Probability of being included in a satisfiable configuration',
          font: { weight: 'bold' }
        },
      },
    },
    barThickness: 30, // Ajustado para que no sea tan fino como el '4' original si hay pocas barras
  };

  return (
    <div className="w-full p-2">
      <div className="card shadow mb-4 border-0 rounded-xl overflow-hidden">
        {/* Header con estilo similar al anterior */}
        <div className="card-header py-3 bg-gray-50 border-b border-gray-200 d-flex flex-row align-items-center justify-content-between">
          <h6 className="m-0 font-weight-bold text-primary">
            Feature Inclusion Probabilities
          </h6>
        </div>

        <div className="card-body bg-white p-4">
          {/* Contenedor del Gráfico */}
          <div style={{ height: '300px', position: 'relative' }}>
            <Bar data={chartData} options={options} />
          </div>

          {/* Leyenda Manual Personalizada */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {/* Dead Features - Rojo */}
            <div 
              className="p-3 bg-red-50 rounded-lg border border-red-200 min-w-[150px] text-center transition-colors hover:bg-red-100"
              title="Features that are never included in any satisfiable configuration"
            >
              <span className="block text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">
                Dead features
              </span>
            </div>

            {/* Optional Features - Ámbar/Amarillo */}
            <div 
              className="p-3 bg-amber-50 rounded-lg border border-amber-200 min-w-[150px] text-center transition-colors hover:bg-amber-100"
              title="Unconstraint features with 0.5 (50%) probability of being selected in a satisfiable configuration"
            >
              <span className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                Pure optional features
              </span>
            </div>

            {/* Core Features - Verde */}
            <div 
              className="p-3 bg-green-50 rounded-lg border border-green-200 min-w-[150px] text-center transition-colors hover:bg-green-100"
              title="Features that are included in all satisfiable configurations"
            >
              <span className="block text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">
                Core features
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureInclusionProbabilitiesChart;