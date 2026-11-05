/**
 * Ship toggles the phone can flip without deleting screens or API clients.
 * Set a flag back to true when that hall capability goes live.
 */

export const hallFeatures = {
  /**
   * Guardian late/return SMS: office Text messages log, SMS templates in
   * Settings, and related office links. Backend routes and mock SMS stay;
   * this only hides the phone UI until a live driver ships.
   */
  guardianSmsUi: false,
} as const;
