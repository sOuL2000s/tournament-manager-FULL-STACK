import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react'; // Ensure all these are imported

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
    setLocalTempScoreA(value);
  };

  const handleScoreBChange = (e) => {
    const value = e.target.value;
    setLocalTempScoreB(value);
  };

  // This console.log is for debugging: it should print as you type.
  // If it does, then the component is rendering and its local state is updating.
  console.log('ScoreInputModalContent rendering. Local ScoreA:', localTempScoreA, 'Local ScoreB:', localTempScoreB);

  return (
    <div className="flex flex-col gap-3 mb-4">
      <input
        type="text" // Using "text" to allow custom parsing and validation
        placeholder={`Score for ${fixture.teamA}`}
        value={localTempScoreA} // Bind value to local state
        onChange={handleScoreAChange} // Use local handler
        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Score for ${fixture.teamA}`} // Accessibility
      />
      <input
        type="text" // Using "text" to allow custom parsing and validation
        placeholder={`Score for ${fixture.teamB}`}
        value={localTempScoreB} // Bind value to local state
        onChange={handleScoreBChange} // Use local handler
        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Score for ${fixture.teamB}`} // Accessibility
      />
    </div>
  );
});

export default ScoreInputModalContent; // Ensure the forwardRef-wrapped component is exported
