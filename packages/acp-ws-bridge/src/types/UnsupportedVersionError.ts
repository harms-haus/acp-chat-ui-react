/**
 * Error returned when parsing an envelope with an unsupported version.
 */
export type UnsupportedVersionError = {
  /**
   * The version that was received.
   */
  received: number,
  /**
   * The versions that are supported.
   */
  supported: Array<number>,
};
