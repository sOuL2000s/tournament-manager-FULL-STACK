import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

// Wrap the component with forwardRef
// The 'ref' parameter here is CRUCIAL for the parent component's ref to work
const ScoreInputModalContent = forwardRef(function ScoreInputModalContent(
  { fixture, initialScoreA, initialScoreB }, // Props (first argument)
  ref // The ref from the parent (second argument)
) {
  const [localTempScoreA, setLocalTempScoreA] = useState('');
  const [localTempScoreB, setLocalTempScoreB] = useState('');

  useEffect(() => {
    // This effect ensures initial values are set when props change (e.g., modal opens for a new fixture)
    setLocalTempScoreA(initialScoreA !== undefined && initialScoreA !== null ? String(initialScoreA) : '');
    setLocalTempScoreB(initialScoreB !== undefined && initialScoreB !== null ? String(initialScoreB) : '');
  }, [initialScoreA, initialScoreB]);

  // useImperativeHandle allows the parent to call methods on this child component via the ref
  useImperativeHandle(ref, () => ({
    getScoreA: () => localTempScoreA, // Expose a method to get the current state of score A
    getScoreB: () => localTempScoreB, // Expose a method to get the current state of score B
  }));

  // Handle changes in input fields
  const handleScoreAChange = (e) => {
    const value = e.target.value;
    // Allow only digits
    if (/^\d*$/.test(value)) {
      setLocalTempScoreA(value);
    }
  };

  const handleScoreBChange = (e) => {
    const value = e.target.value;
    // Allow only digits
    if (/^\d*$/.test(value)) {
      setLocalTempScoreB(value);
    }
  };

  return (
    // Added responsive padding: p-4 for small screens, md:p-6 for medium and larger
    <div className="p-4 md:p-6">
      {/* Changed to flex-col on small screens, sm:flex-row for horizontal on small-medium and up */}
      {/* Increased gap for better spacing, adjusted mb-6 to mb-8 */}
      <div className="flex flex-col sm:flex-row justify-around items-center gap-6 sm:gap-4 mb-8">
        <div className="text-center w-full sm:w-auto"> {/* Make div take full width on small screens */}
          <label htmlFor="scoreA" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
            {fixture.teamA} Score
          </label>
          <input
            id="scoreA"
            type="number"
            value={localTempScoreA}
            onChange={handleScoreAChange}
            // Adjusted width to w-full on small screens, w-28 on sm and up
            className="w-full sm:w-28 px-3 py-2 border border-gray-300 rounded-md text-center text-xl sm:text-lg font-semibold
                       dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>

        {/* Adjusted font size for separator */}
        <span className="text-3xl sm:text-2xl font-bold text-gray-900 dark:text-white my-4 sm:my-0">-</span>

        <div className="text-center w-full sm:w-auto"> {/* Make div take full width on small screens */}
          <label htmlFor="scoreB" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
            {fixture.teamB} Score
          </label>
          <input
            id="scoreB"
            type="number"
            value={localTempScoreB}
            onChange={handleScoreBChange}
            // Adjusted width to w-full on small screens, w-28 on sm and up
            className="w-full sm:w-28 px-3 py-2 border border-gray-300 rounded-md text-center text-xl sm:text-lg font-semibold
                       dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>
      </div>
    </div>
  );
});

export default ScoreInputModalContent;