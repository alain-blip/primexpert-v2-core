import React, { createContext, useContext, useMemo } from 'react';

export type WorkhubTabId = string;

export interface WorkhubNavValue {
  setActiveTab: (tab: WorkhubTabId) => void;
}

const WorkhubNavContext = createContext<WorkhubNavValue | null>(null);

export function WorkhubNavProvider({
  children,
  setActiveTab,
}: {
  children: React.ReactNode;
  setActiveTab: (tab: WorkhubTabId) => void;
}) {
  const value = useMemo(() => ({ setActiveTab }), [setActiveTab]);
  return (
    <WorkhubNavContext.Provider value={value}>{children}</WorkhubNavContext.Provider>
  );
}

export function useWorkhubNav(): WorkhubNavValue | null {
  return useContext(WorkhubNavContext);
}
