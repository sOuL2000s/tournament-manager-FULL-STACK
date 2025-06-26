// 📁 src/pages/StatsPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- Dynamic color generation for teams ---
// Place this function outside of the component to avoid re-creating it on every render.
const generateColors = (count) => {
  const baseColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6'];
  while (baseColors.length < count) {
    baseColors.push(`#${Math.floor(Math.random() * 16777215).toString(16)}`);
  }
  return baseColors;
};

export default function StatsPage() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      const matchRef = collection(db, 'matches');
      const snapshot = await getDocs(matchRef);
      const matchData = snapshot.docs.map(doc => doc.data());
      setStats(matchData);
    };

    fetchStats();
  }, []);

  // --- Graceful handling if stats is empty ---
  // Place this at the very beginning of the return statement, before any other JSX,
  // so that it renders the loading message immediately if there's no data.
  if (stats.length === 0) {
    return <p className="text-center text-gray-500">Loading match stats...</p>;
  }

  const teamGoals = stats.reduce((acc, match) => {
    acc[match.teamA] = (acc[match.teamA] || 0) + (match.scoreA || 0);
    acc[match.teamB] = (acc[match.teamB] || 0) + (match.scoreB || 0);
    return acc;
  }, {});

  // --- Optional average goals per match stat card (calculation) ---
  // Place this calculation after `teamGoals` is defined, as it depends on `teamGoals` and `stats`.
  const totalGoals = Object.values(teamGoals).reduce((a, b) => a + b, 0);
  const avgGoals = (totalGoals / stats.length).toFixed(2);


  // Get the dynamic colors based on the number of unique teams
  const teamNames = Object.keys(teamGoals);
  const dynamicColors = generateColors(teamNames.length);


  const barData = {
    labels: teamNames, // Use teamNames here
    datasets: [
      {
        label: 'Goals Scored',
        data: Object.values(teamGoals),
        backgroundColor: dynamicColors, // Apply dynamic colors
      },
    ],
  };

  const pieData = {
    labels: teamNames, // Use teamNames here
    datasets: [
      {
        label: 'Goals Distribution',
        data: Object.values(teamGoals),
        backgroundColor: dynamicColors, // Apply dynamic colors
      },
    ],
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📊 Player and Match Stats</h2>

      {/* --- Optional average goals per match stat card (JSX) --- */}
      {/* Place this div wherever you want the stat card to appear, for example, above the charts. */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow text-center mb-6">
        <h4 className="text-xl font-semibold">⚽ Avg. Goals per Match</h4>
        <p className="text-3xl mt-1 font-bold text-blue-500">{avgGoals}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">Goals by Team (Bar Chart)</h3>
          <Bar data={barData} />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Goals Distribution (Pie Chart)</h3>
          <Pie data={pieData} />
        </div>
      </div>
    </div>
  );
}