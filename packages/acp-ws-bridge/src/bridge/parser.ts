import type {
  BridgeEnvelope,
  UnsupportedVersionError,
} from "../generated/index.js";

export const ENVELOPE_VERSION = 1;
export const SUPPORTED_VERSIONS: readonly number[] = [1];

export class BridgeVersionError extends Error {
  public readonly received: number;
  public readonly supported: readonly number[];

  constructor(error: UnsupportedVersionError) {
    super(
      `Unsupported envelope version ${error.received}: supported versions are [${error.supported.join(", ")}]`
    );
    this.name = "BridgeVersionError";
    this.received = error.received;
    this.supported = error.supported;
  }
}

export function isSupportedVersion(version: number): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

export function parseEnvelope(json: string): BridgeEnvelope {
  const parsed = JSON.parse(json) as BridgeEnvelope;
  validateEnvelope(parsed);
  return parsed;
}

export function parseEnvelopeSafe(json: string): BridgeEnvelope | BridgeVersionError {
  try {
    return parseEnvelope(json);
  } catch (error) {
    if (error instanceof BridgeVersionError) {
      return error;
    }
    throw error;
  }
}

export function validateEnvelope(envelope: BridgeEnvelope): void {
  if (!isSupportedVersion(envelope.version)) {
    throw new BridgeVersionError({
      received: envelope.version,
      supported: [...SUPPORTED_VERSIONS],
    });
  }
}

export function createUnsupportedVersionError(received: number): UnsupportedVersionError {
  return {
    received,
    supported: [...SUPPORTED_VERSIONS],
  };
}
