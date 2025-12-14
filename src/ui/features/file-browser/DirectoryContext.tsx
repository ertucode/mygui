import { createContext, useContext } from "react";

export function DirectoryContextProvider({
  children,
  directoryId,
}: {
  children: React.ReactNode;
  directoryId: string;
}) {
  return (
    <DirectoryContext.Provider value={{ directoryId }}>
      {children}
    </DirectoryContext.Provider>
  );
}

export type DirectoryContextValue = {
  directoryId: string;
};

const DirectoryContext = createContext<DirectoryContextValue>(undefined as any);

export function useDirectoryContext() {
  return useContext(DirectoryContext);
}
