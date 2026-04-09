import React, { createContext, useContext } from 'react';
import type { SessionController } from '@harms-haus/acp-chat-core';

const EventBusContext = createContext<SessionController | null>(null);

export interface EventProviderProps {
  children: React.ReactNode;
  controller: SessionController;
}

export function EventProvider({ children, controller }: EventProviderProps): React.ReactElement {
  return (
    <EventBusContext.Provider value={controller}>
      {children}
    </EventBusContext.Provider>
  );
}

EventProvider.displayName = 'EventProvider';

export function useEventBus(): SessionController {
  const context = useContext(EventBusContext);
  if (!context) {
    throw new Error('useEventBus must be used within EventProvider');
  }
  return context;
}
