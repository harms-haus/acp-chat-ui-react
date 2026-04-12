/**
 * Custom render utilities for React Testing Library.
 *
 * Provides a custom render function that wraps components with necessary providers.
 */

import React from 'react';
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';
import { EventProvider } from '../events/EventProvider.js';
import { AcpStore, createAcpStore } from '../store/index.js';
import type { SessionController } from '@harms-haus/acp-chat-core';

/**
 * Result of custom render, extends Testing Library RenderResult.
 */
export interface CustomRenderResult extends RenderResult {
  /** ACP store instance. */
  store: AcpStore;
  /** Session controller instance. */
  controller: SessionController;
}

/**
 * Options for custom render.
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Session controller to provide. Must be provided; customRender throws if omitted. */
  sessionController?: SessionController;
  /** ACP Store instance. If omitted, creates one from session controller. */
  acpStore?: AcpStore;
  /** Additional providers to wrap around ACP providers. */
  additionalProviders?: React.JSXElementConstructor<{ children: React.ReactNode }>[];
}

/**
 * AllProviders component wraps children with all necessary ACP providers.
 */
function AllProviders({
  children,
  sessionController,
  acpStore,
}: {
  children: React.ReactNode;
  sessionController: SessionController;
  acpStore: AcpStore;
}) {
  return (
    <EventProvider controller={sessionController}>
      {/* Note: AcpStore uses useSyncExternalStore, no Provider component needed */}
      {/* We expose the store via a test context if needed for direct access */}
      <StoreContext.Provider value={acpStore}>
        {children}
      </StoreContext.Provider>
    </EventProvider>
  );
}

/**
 * Context for exposing the ACP store in tests.
 * This is only used in tests to access the store directly.
 */
const StoreContext = React.createContext<AcpStore | null>(null);

/**
 * Helper hook to access the ACP store in test components.
 * Only works within customRender.
 *
 * @example
 * ```tsx
 * function TestComponent() {
 *   const store = useTestStore();
 *   const messages = store.getMessages();
 *   return <div>{messages.length} messages</div>;
 * }
 * ```
 */
export function useTestStore(): AcpStore {
  const store = React.useContext(StoreContext);
  if (!store) {
    throw new Error('useTestStore must be used within customRender');
  }
  return store;
}

export function customRender(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): CustomRenderResult {
  const {
    sessionController: providedController,
    acpStore: providedStore,
    additionalProviders,
    ...rtlOptions
  } = options;

  if (!providedController) {
    throw new Error(
      'sessionController is required. Use mockChatCore() from @/test-utils/mocks to create one.'
    );
  }

  const acpStore = providedStore ?? createAcpStore(providedController!, {
    notificationCadenceMs: 0,
    enableBatching: false,
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    let content = <AllProviders sessionController={providedController!} acpStore={acpStore}>{children}</AllProviders>;

    if (additionalProviders) {
      for (const Provider of additionalProviders) {
        content = <Provider>{content}</Provider>;
      }
    }

    return content;
  }

  const elementWithStore = React.isValidElement<{ store?: AcpStore }>(ui) 
    && ui.props.store == null
    ? React.cloneElement(ui, { store: acpStore })
    : ui;

  return {
    ...rtlRender(elementWithStore, { wrapper: Wrapper, ...rtlOptions }),
    store: acpStore,
    controller: providedController,
  };
}
