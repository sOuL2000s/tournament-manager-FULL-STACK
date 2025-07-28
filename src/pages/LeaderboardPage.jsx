// src/pages/LeaderboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

export default function LeaderboardPage() {
  const { id: tournamentId } = useParams();
  const [searchParams] = useSearchParams();
  const shareId = searchParams.get('shareId');
  const { user, loading: authLoading } = useAuth();

  const [tournamentName, setTournamentName] = useState('Loading...');
  const [tournamentDetails, setTournamentDetails] = useState(null); // New state for tournament details
  const [leaderboardData, setLeaderboardData] = useState({}); // Changed to object to store data per group
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [tournamentOwnerId, setTournamentOwnerId] = useState(null);

  // Function to determine color for leaderboard rows
  const getRowColor = useCallback((index, teamRank, totalTeams) => {
    if (!tournamentDetails?.enableColors) return '';

    const promotion = parseInt(tournamentDetails.promotionSpots) || 0;
    const europe = parseInt(tournamentDetails.europeLeagueSpots) || 0;
    const relegation = parseInt(tournamentDetails.relegationSpots) || 0;

    // Promotion spots (top N)
    if (promotion > 0 && teamRank <= promotion) {
      return 'bg-green-100 dark:bg-green-900';
    }
    // Europe League spots (next N after promotion)
    if (europe > 0 && teamRank > promotion && teamRank <= (promotion + europe)) {
      return 'bg-blue-100 dark:bg-blue-900';
    }
    // Relegation spots (bottom N)
    if (relegation > 0 && teamRank > (totalTeams - relegation)) {
      return 'bg-red-100 dark:bg-red-900';
    }
    return '';
  }, [tournamentDetails]);

  // --- Effect to fetch Tournament Details and set view-only mode ---
  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament ID provided.");
      setLoading(false);
      return;
    }

    const tournamentDocRef = doc(db, 'tournaments', tournamentId);
    const unsubscribeTournament = onSnapshot(tournamentDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTournamentName(data.name);
        setTournamentDetails(data);
        setTournamentOwnerId(data.userId);

        const currentIsViewOnly = (!!shareId) || (!user && (data.isPublic || false));
        setIsViewOnly(currentIsViewOnly);
      } else {
        setError('Tournament not found.');
        setLoading(false);
      }
    }, (err) => {
      console.error('Error fetching tournament details:', err);
      setError('Failed to load tournament details.');
      setLoading(false);
    });

    return () => unsubscribeTournament();
  }, [tournamentId, shareId, user]);

  // --- Leaderboard Update Logic (now group-aware) ---
  const updateLeaderboard = useCallback(async () => {
    if (!tournamentId || !tournamentDetails || authLoading) {
      console.log('Skipping leaderboard update: Tournament data or auth loading.');
      return;
    }

    // Only allow owner to trigger updates, but viewers can see the result
    const canUpdate = user && user.uid === tournamentOwnerId;

    const teamsCollectionRef = collection(db, `tournaments/${tournamentId}/teams`);
    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    const leaderboardCollectionRef = collection(db, `tournaments/${tournamentId}/leaderboard`);

    try {
      const teamsSnapshot = await getDocs(teamsCollectionRef);
      const fixturesSnapshot = await getDocs(fixturesCollectionRef);

      const allTeams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allFixtures = fixturesSnapshot.docs.map(doc => doc.data());

      const pointsPerWin = tournamentDetails.pointsPerWin !== undefined ? tournamentDetails.pointsPerWin : 3;
      const pointsPerDraw = tournamentDetails.pointsPerDraw !== undefined ? tournamentDetails.pointsPerDraw : 1;

      const newLeaderboardData = {}; // Will hold stats grouped by groupName

      // Initialize team stats for all teams, grouped by their assigned group
      allTeams.forEach(team => {
        const group = team.group || 'Ungrouped'; // Default to 'Ungrouped' if no group assigned
        if (!newLeaderboardData[group]) {
          newLeaderboardData[group] = {};
        }
        newLeaderboardData[group][team.name] = {
          id: team.id,
          name: team.name,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        };
      });

      // Process fixtures and update stats
      allFixtures.forEach(fixture => {
        if (fixture.status === 'completed') {
          const teamA = fixture.teamA;
          const teamB = fixture.teamB;
          const scoreA = Number(fixture.scoreA) || 0;
          const scoreB = Number(fixture.scoreB) || 0;
          const fixtureGroup = fixture.groupId || 'Ungrouped'; // Get group from fixture

          // Ensure teams exist in the current group's stats before updating
          if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamA]) {
            newLeaderboardData[fixtureGroup][teamA].played++;
            newLeaderboardData[fixtureGroup][teamA].goalsFor += scoreA;
            newLeaderboardData[fixtureGroup][teamA].goalsAgainst += scoreB;
          }
          if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamB]) {
            newLeaderboardData[fixtureGroup][teamB].played++;
            newLeaderboardData[fixtureGroup][teamB].goalsFor += scoreB;
            newLeaderboardData[fixtureGroup][teamB].goalsAgainst += scoreA;
          }

          if (scoreA > scoreB) {
            if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamA]) newLeaderboardData[fixtureGroup][teamA].wins++;
            if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamB]) newLeaderboardData[fixtureGroup][teamB].losses++;
          } else if (scoreB > scoreA) {
            if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamB]) newLeaderboardData[fixtureGroup][teamB].wins++;
            if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamA]) newLeaderboardData[fixtureGroup][teamA].losses++;
          } else { // Draw
            if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamA]) newLeaderboardData[fixtureGroup][teamA].draws++;
            if (newLeaderboardData[fixtureGroup] && newLeaderboardData[fixtureGroup][teamB]) newLeaderboardData[fixtureGroup][teamB].draws++;
          }
        }
      });

      const batch = writeBatch(db);
      const finalLeaderboardDisplay = {};

      // Calculate final points and sort teams within each group
      for (const groupName in newLeaderboardData) {
        const teamsInGroup = Object.values(newLeaderboardData[groupName]);
        teamsInGroup.forEach(stats => {
          stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
          stats.points = (stats.wins * pointsPerWin) + (stats.draws * pointsPerDraw);

          // Only write to Firestore if the current user is the owner
          if (canUpdate) {
            const teamLeaderboardDocRef = doc(leaderboardCollectionRef, stats.id);
            batch.set(teamLeaderboardDocRef, stats, { merge: true });
          }
        });

        // Sort teams for display within this group
        teamsInGroup.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          return a.name.localeCompare(b.name);
        });
        finalLeaderboardDisplay[groupName] = teamsInGroup;
      }

      // Commit batch if owner is updating
      if (canUpdate) {
        await batch.commit();
        console.log('Leaderboard updated successfully!');
      }

      setLeaderboardData(finalLeaderboardDisplay);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error updating leaderboard:', err);
      setError('Failed to load leaderboard data.');
      setLoading(false);
    }
  }, [tournamentId, tournamentDetails, authLoading, user, tournamentOwnerId]);

  // Effect to trigger leaderboard update when tournament details or auth state changes
  // This ensures the leaderboard updates when the page loads and when relevant data changes.
  useEffect(() => {
    if (tournamentDetails && !authLoading) {
      updateLeaderboard();
    }
  }, [tournamentDetails, authLoading, updateLeaderboard]);


  const commonNavLinks = (
    <div className="bg-red-600 text-white p-4 font-bold text-lg flex flex-wrap justify-around sm:flex-nowrap">
      <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">LEAGUE</Link>
      <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">FIXTURES</Link>
      <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">TOP SCORERS</Link>
      <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">STATS</Link>
      <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">KNOCKOUT</Link>
      <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">AI PREDICTION</Link>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        {commonNavLinks}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">🏆 Leaderboard ({tournamentName})</h2>
          <p className="text-center text-gray-500 py-8">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        {commonNavLinks}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">🏆 Leaderboard ({tournamentName})</h2>
          <p className="text-center text-red-500 py-8">{error}</p>
        </div>
      </div>
    );
  }

  const sortedGroupNames = Object.keys(leaderboardData).sort((a, b) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {commonNavLinks}

      <div className="flex-grow p-4 sm:p-6 lg:p-8 w-full">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          🏆 Leaderboard: {tournamentName}
        </h2>

        {Object.keys(leaderboardData).length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">
            No leaderboard data available. Add teams and complete some fixtures!
          </p>
        ) : (
          <div className="space-y-10">
            {sortedGroupNames.map(groupName => (
              <div key={groupName} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl sm:text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
                  {groupName !== 'Ungrouped' ? `Group ${groupName} Standings` : 'Overall Standings'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg">Rank</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Team</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">P</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">W</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">D</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">L</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">GF</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">GA</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">GD</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider rounded-tr-lg">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {leaderboardData[groupName].map((team, index) => (
                        <tr key={team.id} className={`${getRowColor(index, index + 1, leaderboardData[groupName].length)} hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{index + 1}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{team.name}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.played}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.wins}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.draws}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.losses}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.goalsFor}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.goalsAgainst}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{team.goalDifference}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{team.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
