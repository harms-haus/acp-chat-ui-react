pub mod contract;

pub use contract::{
    BridgeEnvelope, BridgeMessage, BridgeStatus, UnsupportedVersionError, ENVELOPE_VERSION,
    SUPPORTED_VERSIONS,
};
