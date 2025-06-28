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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* Modal Content Container: Centered, white/dark background, rounded corners, shadow.
          Its z-index is implicitly higher than the overlay because it's a child element
          within the same stacking context established by the 'z-50' parent. This structure
          is standard and typically doesn't block input. */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center transform scale-100 transition-transform duration-200 ease-out">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title || 'Attention'}</h3>
        {message && <p className="text-lg mb-4 text-gray-700 dark:text-gray-300">{message}</p>}

        {/* This is where the input fields from FixturesPage.jsx will be rendered */}
        {children}

        <div className="flex justify-center gap-4 mt-6">
          {showConfirmButton && (
            <button
              onClick={onConfirm}
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors font-semibold"
            >
              {confirmText}
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-gray-400 text-white px-6 py-2 rounded-md hover:bg-gray-500 transition-colors font-semibold"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
