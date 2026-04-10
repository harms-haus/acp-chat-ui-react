//! Bridge modes: dynamic (auto-detect) and replay (token-timed).

pub mod dynamic;
pub mod replay;
pub mod replay_streaming;

pub use dynamic::{DynamicConfig, run_dynamic_mode};
pub use replay::{ReplayConfig, PermissionResponse, run_replay_mode, run_replay_mode_with_message, stream_replay_after_init};

pub enum BridgeModeHandle {
    Dynamic(DynamicConfig),
    Replay(ReplayConfig),
}