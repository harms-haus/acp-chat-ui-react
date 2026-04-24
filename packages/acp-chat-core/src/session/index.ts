export { SessionController } from "./controller.js";
export type { SessionControllerState, StartAgentConfig, PermissionRequestParams, PermissionOption, ConfigOption, ConfigOptionValue } from "./controller.js";
export { DefaultSessionCaptureInterceptor } from "./capture-interceptor.js";
export type { CapturedSession, CapturedEvent, SessionCaptureInterceptor, CapturedSessionState } from "./capture-interceptor.js";

// Replay functionality moved to harness-ui and Rust controller
// No replay types or controllers in core package
