import React from "react";

function KpiCard({ title, value, helper, icon, color }) {
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
        {/* Title */}
        <h3 className="
          text-gray-500
          font-semibold text-xs uppercase tracking-wide
          mb-3
        ">
            {title}
        </h3>
        
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


