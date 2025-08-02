import { Pie } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

export default function AttendancePieChart({ rawData, legendToggles, setLegendToggles }) {
  const labels = ["Present", "Absent", "Late", "Half Day"];
  const total = Object.values(rawData).reduce((a, b) => a + b, 0);

  const pieDataValues = labels.map((label) => {
    if (total === 0) return 1;
    if (!legendToggles[label]) return 0;
    if (rawData[label] === 0) return 0.1;
    return rawData[label];
  });

  const chartData = {
    labels,
    datasets: [
      {
        data: pieDataValues,
        backgroundColor: ["#4ade80", "#f87171", "#fbbf24", "#60a5fa"],
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 30,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { size: 12 },
          color: "#374151",
          generateLabels: (chart) => {
            const dataset = chart.data.datasets[0];
            return chart.data.labels.map((label, i) => {
              const toggledOn = legendToggles[label];
              return {
                text: label,
                fillStyle: dataset.backgroundColor[i],
                strokeStyle: dataset.backgroundColor[i],
                lineWidth: 1,
                hidden: !toggledOn,
                index: i,
                fontColor: toggledOn ? "#374151" : "#9ca3af",
                textDecoration: toggledOn ? "none" : "line-through",
              };
            });
          },
        },
        onClick: (_, legendItem) => {
          const label = legendItem.text;
          setLegendToggles((prev) => ({
            ...prev,
            [label]: !prev[label],
          }));
        },
      },
      tooltip: {
        enabled: false,
      },
      datalabels: {
        color: "#ffffff",
        font: { size: 13, weight: "bold" },
        formatter: (value, context) => {
          const label = context.chart.data.labels[context.dataIndex];
          const rawValue = rawData[label];
          const toggledOn = legendToggles[label];

          if (!toggledOn) return "";
          if (total === 0) return `0 (0%) → ${label}`;

          const percentage = ((rawValue / total) * 100).toFixed(1);
          return `${rawValue} (${percentage}%) → ${label}`;
        },
      },
    },
  };

  return (
    <div className="h-120">
      <Pie data={chartData} options={chartOptions} plugins={[ChartDataLabels]} />
    </div>
  );
}
