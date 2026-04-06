//! Bridge modes: proxy (live ACP), replay_v2 (token-timed), and dynamic (client-spawned).

pub mod dynamic;
pub mod proxy;
pub mod replay_v2;

pub use dynamic::{DynamicConfig, run_dynamic_mode};
pub use proxy::{ProxyConfig, run_proxy_mode};
pub use replay_v2::{ReplayV2Config, PermissionResponse, run_replay_v2_mode, stream_replay_after_init};

pub enum BridgeModeHandle {
    Dynamic(DynamicConfig),
    Proxy(ProxyConfig),
    ReplayV2(ReplayV2Config),
}