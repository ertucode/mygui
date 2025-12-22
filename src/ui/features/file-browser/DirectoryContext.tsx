import { createContext, useContext } from "react";
import { DirectoryId } from "./directoryStore/DirectoryBase";

export function DirectoryContextProvider({
  children,
  directoryId,
}: {
  children: React.ReactNode;
  directoryId: DirectoryId;
}) {
  return (
    <DirectoryContext.Provider value={{ directoryId }}>
      {children}
    </DirectoryContext.Provider>
  );
}

export type DirectoryContextValue = {
  directoryId: DirectoryId;
};

const DirectoryContext = createContext<DirectoryContextValue>(undefined as any);

export function useDirectoryContext() {
  return useContext(DirectoryContext);
}
