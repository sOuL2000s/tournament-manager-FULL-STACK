import React from 'react';

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children, // For custom content
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showConfirmButton = true,
}) {
  if (!isOpen) return null;

  return (
    // Overlay: Fixed position, full screen, semi-transparent black background, high z-index (z-50)
    // This div captures clicks outside the modal content to close it (if onClose is provided and appropriate)
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* Modal Content Container:
          - bg-white dark:bg-gray-800: Background colors for light/dark modes.
          - p-6 md:p-8: Responsive padding.
          - rounded-lg: Rounded corners.
          - shadow-xl: Large shadow for depth.
          - w-full: Takes full width on small screens.
          - max-w-sm md:max-w-md: Responsive max-width.
          - max-h-[90vh] overflow-y-auto: Ensures modal content is scrollable if it exceeds viewport height.
          - text-center: Centers text horizontally.
          - relative z-50: Sets a new stacking context for its children and ensures it's on top.
      */}
      <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto text-center relative z-50">
        <h3 className="text-xl md:text-2xl font-bold mb-4 text-gray-900 dark:text-white">{title || 'Attention'}</h3>
        {message && <p className="text-lg mb-4 text-gray-700 dark:text-gray-300">{message}</p>}

        {/* This is the placeholder for custom content, such as the score input fields.
            The 'children' prop renders whatever JSX is passed into the <Modal> component from its parent.
        */}
        {children}

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          {showConfirmButton && (
            <button
              onClick={onConfirm} // This triggers the confirmation logic (e.g., score update)
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors font-semibold w-full sm:w-auto"
            >
              {confirmText}
            </button>
          )}
          <button
            onClick={onClose} // This triggers the modal to close
            className="bg-gray-400 text-white px-6 py-2 rounded-md hover:bg-gray-500 transition-colors font-semibold w-full sm:w-auto"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}