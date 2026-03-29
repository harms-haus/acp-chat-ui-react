//! Bridge modes: proxy (live ACP), replay (captured session), and dynamic (client-spawned).

pub mod dynamic;
pub mod proxy;
pub mod replay;

pub use dynamic::{DynamicConfig, run_dynamic_mode};
pub use proxy::{ProxyConfig, run_proxy_mode};
pub use replay::{ReplayConfig, run_replay_mode};

pub enum BridgeModeHandle {
    Dynamic(DynamicConfig),
    Proxy(ProxyConfig),
    Replay(ReplayConfig),
}