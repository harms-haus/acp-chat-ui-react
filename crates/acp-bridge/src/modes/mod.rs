//! Bridge modes: proxy (live ACP) and replay (captured session).

pub mod proxy;
pub mod replay;

pub use proxy::{ProxyConfig, run_proxy_mode};
pub use replay::{ReplayConfig, run_replay_mode};

pub enum BridgeModeHandle {
    Proxy(ProxyConfig),
    Replay(ReplayConfig),
}