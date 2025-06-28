// 📁 src/pages/StatsPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { useParams, Link } from 'react-router-dom';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// Dynamic color generation for teams - moved outside for better performance
// This ensures colors are generated once per unique team set and are visually distinct.
const generateColors = (count) => {
  const baseColors = [
    '#3B82F6', // blue-500
    '#10B981', // green-500
    '#F59E0B', // yellow-500
    '#EF4444', // red-500
    '#6366F1', // indigo-500
    '#8B5CF6', // purple-500
    '#06B6D4', // cyan-500
    '#EC4899', // pink-500
    '#A855F7', // fuchsia-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#6B7280', // gray-500
  ];
  // Extend with more vibrant random colors if needed to cover all teams
  const colors = [...baseColors];
  while (colors.length < count) {
    // Generate a random bright color (HSL for better control)
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * (100 - 70) + 70); // 70-100% saturation
    const lightness = Math.floor(Math.random() * (70 - 40) + 40); // 40-70% lightness
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
};

export default function StatsPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [tournamentName, setTournamentName] = useState('Loading...'); // State for tournament name
  const [stats, setStats] = useState([]); // Stores completed fixture data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Effect to fetch the specific tournament's name
  useEffect(() => {
    if (!tournamentId) {
      setTournamentName('No Tournament ID');
      setError("Tournament ID is missing.");
      return;
    }
    const fetchTournamentName = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);
        if (tournamentSnap.exists()) {
          setTournamentName(tournamentSnap.data().name);
        } else {
          setTournamentName('Tournament Not Found');
          setError('The requested tournament does not exist.');
        }
      } catch (err) {
        console.error('Error fetching tournament name:', err);
        setTournamentName('Error loading name');
        setError('Failed to load tournament name.');
      }
    };
    fetchTournamentName();
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false); // Stop loading if no tournament ID
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
      // Ordering by timestamp is good for consistency, ensures index usage if applicable
      const q = query(fixturesCollectionRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const matchData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Ensure scores are numbers, default to 0 if undefined, null, or non-numeric
          scoreA: Number(doc.data().scoreA) || 0,
          scoreB: Number(doc.data().scoreB) || 0,
        }));
        // Filter for only completed matches for statistics
        setStats(matchData.filter(match => match.status === 'completed'));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time match stats:', err);
        setError('Failed to load match statistics. Please try again.');
        setLoading(false);
      });

      return () => unsubscribe(); // Clean up the listener
    } catch (err) {
      console.error("Error setting up stats listener:", err);
      setError("Failed to set up stats listener.");
      setLoading(false);
    }
  }, [tournamentId]);

  // Handle loading and error states for the main content
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Top Navigation Bar */}
        <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
          <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
          <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
          <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
          <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
          <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
          <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
        </div>
        <div className="p-6 max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">📊 Tournament Statistics ({tournamentName})</h2>
          <p className="text-center text-gray-500 py-8">Loading match stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Top Navigation Bar */}
        <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
          <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
          <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
          <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
          <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
          <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
          <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
        </div>
        <div className="p-6 max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">📊 Tournament Statistics ({tournamentName})</h2>
          <p className="text-center text-red-500 py-8">Error: {error}</p>
        </div>
      </div>
    );
  }

  // If no completed matches, display a message
  if (stats.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Top Navigation Bar */}
        <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
          <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
          <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
          <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
          <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
          <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
          <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
        </div>
        <div className="p-6 max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">📊 Tournament Statistics ({tournamentName})</h2>
          <p className="text-center text-gray-500 py-8">No completed matches available for statistics in this tournament yet. Play some matches!</p>
        </div>
      </div>
    );
  }

  // Calculate team goals from completed matches
  const teamGoals = stats.reduce((acc, match) => {
    // Ensure that match.scoreA and match.scoreB are treated as numbers
    acc[match.teamA] = (acc[match.teamA] || 0) + (Number(match.scoreA) || 0);
    acc[match.teamB] = (acc[match.teamB] || 0) + (Number(match.scoreB) || 0);
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
        borderColor: dynamicColors.map(color => color.replace(')', ', 0.8)')), // Slightly darker border for contrast
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
        display: false, // Title is handled by H3 tag in JSX
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += context.raw; // For pie and bar, raw gives the direct value
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
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full">
        {/* CSS Variable Definition (consider moving to global CSS for better maintainability) */}
        <style>{`
          /* Define CSS variable for text color based on dark mode */
          html.dark {
            --text-color: #f3f4f6; /* light gray for dark mode */
          }
          html:not(.dark) {
            --text-color: #1f2937; /* dark gray for light mode */
          }
        `}</style>
        <h2 className="text-2xl font-bold mb-4 text-center">📊 Tournament Statistics ({tournamentName})</h2>

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
    </div>
  );
}
