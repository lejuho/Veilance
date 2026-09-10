import { createContext, useContext } from 'react';
import type { Workspace } from '../../../shared/graphScope';
export type { Workspace } from '../../../shared/graphScope';
export { isWorkspace } from '../../../shared/graphScope';
export const WorkspaceContext = createContext<Workspace>('batteryMfr');
export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceSwitchContext = createContext<(viewer: Workspace) => void>(() => {});
