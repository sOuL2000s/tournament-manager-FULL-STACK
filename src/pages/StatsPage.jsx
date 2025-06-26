// 📁 src/pages/StatsPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; // Import onSnapshot, query, orderBy
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { useParams } from 'react-router-dom'; // Import useParams

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// Dynamic color generation for teams
// Place this function outside of the component to avoid re-creating it on every render.
const generateColors = (count) => {
  const baseColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6', '#06B6D4', '#EC4899', '#A855F7', '#14B8A6'];
  // Add more unique colors if needed beyond the base set
  while (baseColors.length < count) {
    baseColors.push(`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`);
  }
  return baseColors;
};

export default function StatsPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a query to the 'fixtures' subcollection for the specific tournament
      // We are listening to fixtures here as stats are derived from match scores
      const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
      const q = query(fixturesCollectionRef, orderBy('timestamp', 'asc')); // Order matches by timestamp

      // Set up a real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const matchData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Ensure scores are numbers, default to 0 if undefined
          scoreA: doc.data().scoreA || 0,
          scoreB: doc.data().scoreB || 0,
        }));
        setStats(matchData.filter(match => match.status === 'completed')); // Only consider completed matches for stats
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time match stats:', err);
        setError('Failed to load match statistics. Please try again.');
        setLoading(false);
      });

      // Clean up the listener when the component unmounts or tournamentId changes
      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up stats listener:", err);
      setError("Failed to set up stats listener.");
      setLoading(false);
    }
  }, [tournamentId]); // Re-run effect if tournamentId changes

  // Graceful handling if stats is empty or still loading
  if (loading) {
    return <p className="text-center text-gray-500 py-8">Loading match stats...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500 py-8">Error: {error}</p>;
  }

  if (stats.length === 0) {
    return <p className="text-center text-gray-500 py-8">No completed matches available for statistics in this tournament yet.</p>;
  }

  // Calculate team goals from completed matches
  const teamGoals = stats.reduce((acc, match) => {
    acc[match.teamA] = (acc[match.teamA] || 0) + (match.scoreA || 0);
    acc[match.teamB] = (acc[match.teamB] || 0) + (match.scoreB || 0);
    return acc;
  }, {});

  // Calculate total goals and average goals per completed match
  const totalGoals = Object.values(teamGoals).reduce((a, b) => a + b, 0);
  const avgGoals = stats.length > 0 ? (totalGoals / stats.length).toFixed(2) : 0;

  // Get the dynamic colors based on the number of unique teams
  const teamNames = Object.keys(teamGoals);
  const dynamicColors = generateColors(teamNames.length);

  const barData = {
    labels: teamNames,
    datasets: [
      {
        label: 'Goals Scored',
        data: Object.values(teamGoals),
        backgroundColor: dynamicColors,
        borderColor: dynamicColors.map(color => color.replace('0.6', '1')), // Darker border for bars
        borderWidth: 1,
      },
    ],
  };

  const pieData = {
    labels: teamNames,
    datasets: [
      {
        label: 'Goals Distribution',
        data: Object.values(teamGoals),
        backgroundColor: dynamicColors,
        borderColor: '#fff', // White border for pie segments
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow charts to adapt to container size
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'var(--text-color)', // Use CSS variable for text color
        },
      },
      title: {
        display: false,
        text: 'Chart Title',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) { // For bar chart
              label += context.parsed.y;
            } else if (context.parsed.pie !== null) { // For pie chart
              label += context.parsed.pie;
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: 'var(--text-color)', // Use CSS variable for tick labels
        },
        grid: {
          color: 'rgba(128, 128, 128, 0.2)', // Lighter grid lines
        }
      },
      y: {
        ticks: {
          color: 'var(--text-color)',
        },
        grid: {
          color: 'rgba(128, 128, 128, 0.2)',
        }
      }
    }
  };


  return (
    <div className="p-6">
      <style>{`
        /* Define CSS variable for text color based on dark mode */
        html.dark {
          --text-color: #f3f4f6; /* light gray for dark mode */
        }
        html:not(.dark) {
          --text-color: #1f2937; /* dark gray for light mode */
        }
      `}</style>
      <h2 className="text-2xl font-bold mb-4">📊 Player and Match Stats (Tournament: {tournamentId})</h2>

      {/* Average Goals per Match Stat Card */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md text-center mb-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">⚽ Avg. Goals per Match</h4>
        <p className="text-4xl mt-1 font-extrabold text-blue-600 dark:text-blue-400">{avgGoals}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Goals by Team Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-[400px]">
          <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">Goals by Team</h3>
          <Bar data={barData} options={chartOptions} />
        </div>

        {/* Goals Distribution Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-[400px]">
          <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">Goals Distribution</h3>
          <Pie data={pieData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
