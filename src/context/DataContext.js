import React, { createContext, useContext, useState } from "react";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [emailData, setEmailData] = useState({
    successful: [],
    failed: [],
    stats: null,
    sdrStats: [],
  });

  const [callsData, setCallsData] = useState(null);
  const [combinedData, setCombinedData] = useState(null);

  const value = {
    emailData,
    setEmailData,
    callsData,
    setCallsData,
    combinedData,
    setCombinedData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useDataContext must be used within a DataProvider");
  }
  return ctx;
}


