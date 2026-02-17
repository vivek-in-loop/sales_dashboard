import React from "react";

function KpiCard({ title, value, helper, icon, color, onInfoClick }) {
  return (
    <div
      className="
        bg-white min-w-[160px] h-full rounded-lg
        transition-all duration-300 ease-out
        shadow-sm hover:shadow-md
        hover:-translate-y-1
        p-5
      "
    >
      {/* Content */}
      <div className="flex flex-col h-full">
        {/* Title with optional info button */}
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="
            text-gray-500
            font-semibold text-xs uppercase tracking-wide
          ">
            {title}
          </h3>
          {onInfoClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onInfoClick(); }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
              title="View records"
              aria-label="View records"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Value */}
        <div className="
          text-gray-900
          font-bold
          text-3xl sm:text-4xl md:text-5xl
          leading-tight tracking-tight
          mb-2
        ">
          {value}
        </div>
        
        {/* Helper text */}
        {helper && (
          <div className="mt-auto pt-3 border-t border-gray-100">
            <p className="
              text-gray-400
              text-xs font-medium
            ">
              {helper}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KpiCard;


