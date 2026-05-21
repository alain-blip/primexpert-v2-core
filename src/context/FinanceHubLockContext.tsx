import { createContext, useContext, type ReactNode } from 'react';

export interface FinanceHubLockContextValue {
  inputsLocked: boolean;
}

const FinanceHubLockContext = createContext<FinanceHubLockContextValue>({
  inputsLocked: false,
});

export function FinanceHubLockProvider({
  inputsLocked,
  children,
}: {
  inputsLocked: boolean;
  children: ReactNode;
}) {
  return (
    <FinanceHubLockContext.Provider value={{ inputsLocked }}>
      {children}
    </FinanceHubLockContext.Provider>
  );
}

export function useFinanceHubLock(): FinanceHubLockContextValue {
  return useContext(FinanceHubLockContext);
}
