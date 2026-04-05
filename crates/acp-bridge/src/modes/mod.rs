//! Bridge modes: proxy (live ACP), replay (captured session), replay_v2 (token-timed), and dynamic (client-spawned).

pub mod dynamic;
pub mod proxy;
pub mod replay;
pub mod replay_v2;

pub use dynamic::{DynamicConfig, run_dynamic_mode};
pub use proxy::{ProxyConfig, run_proxy_mode};
pub use replay::{ReplayConfig, run_replay_mode};
pub use replay_v2::{ReplayV2Config, run_replay_v2_mode};

pub enum BridgeModeHandle {
    Dynamic(DynamicConfig),
    Proxy(ProxyConfig),
    Replay(ReplayConfig),
    ReplayV2(ReplayV2Config),
}