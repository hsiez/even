const createSpace = (agentId, initialQuery = "") => ({
  agentId,
  activeTabId: "traces",
  nextTrace: 2,
  nextPlayground: 1,
  tabs: [
    {
      id: "traces",
      kind: "traces",
      label: "Traces",
      pinned: true,
      initialQuery,
    },
  ],
});

export function createWorkspace(agentId, initialQuery) {
  return { agentId, spaces: [createSpace(agentId, initialQuery)] };
}

// Product lifecycle only. Base UI handles tab keyboard navigation and selection.
export function workspaceReducer(state, action) {
  if (action.type === "visit")
    return {
      ...state,
      agentId: action.agentId,
      spaces: state.spaces.some((space) => space.agentId === action.agentId)
        ? state.spaces
        : [...state.spaces, createSpace(action.agentId)],
    };
  return {
    ...state,
    spaces: state.spaces.map((space) => {
      if (space.agentId !== (action.agentId ?? state.agentId)) return space;
      if (action.type === "activate")
        return space.tabs.some((tab) => tab.id === action.id)
          ? { ...space, activeTabId: action.id }
          : space;
      if (action.type === "open") {
        const isTrace = action.kind === "traces";
        return {
          ...space,
          activeTabId: action.id,
          nextTrace: space.nextTrace + Number(isTrace),
          nextPlayground: space.nextPlayground + Number(!isTrace),
          tabs: [
            ...space.tabs,
            {
              id: action.id,
              kind: action.kind,
              label: isTrace
                ? `Traces ${space.nextTrace}`
                : `Playground ${space.nextPlayground}`,
            },
          ],
        };
      }
      if (action.type === "close") {
        const index = space.tabs.findIndex((tab) => tab.id === action.id);
        if (index < 0 || space.tabs[index].pinned) return space;
        return {
          ...space,
          tabs: space.tabs.filter((tab) => tab.id !== action.id),
          activeTabId:
            space.activeTabId === action.id
              ? (space.tabs[index + 1] ?? space.tabs[index - 1]).id
              : space.activeTabId,
        };
      }
      return space;
    }),
  };
}
