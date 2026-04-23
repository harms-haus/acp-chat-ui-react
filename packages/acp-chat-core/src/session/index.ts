export { SessionController } from "./controller.js";
export type { SessionControllerState, StartAgentConfig, PermissionRequestParams, PermissionOption, ConfigOption, ConfigOptionValue } from "./controller.js";
export { DefaultSessionCaptureInterceptor } from "./capture-interceptor.js";
export type { CapturedSession, CapturedEvent, SessionCaptureInterceptor } from "./capture-interceptor.js";

// ReplayController moved to @harms-haus/acp-ws-bridge
// Import from there instead:
// import { ReplayController } from '@harms-haus/acp-ws-bridge';
