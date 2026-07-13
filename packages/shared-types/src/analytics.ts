/** Canonical analytics event names + feature-flag keys shared by all clients. */

export const AnalyticsEvent = {
  SignedUp: 'signed_up',
  LoggedIn: 'logged_in',
  OnboardingCompleted: 'onboarding_completed',
  PhotoUploaded: 'photo_uploaded',
  CharacterCreated: 'character_created',
  ComicStarted: 'comic_started',
  ComicGenerated: 'comic_generated',
  ComicFailed: 'comic_failed',
  ComicShared: 'comic_shared',
  ComicExported: 'comic_exported',
  PaywallViewed: 'paywall_viewed',
  CheckoutStarted: 'checkout_started',
  PurchaseCompleted: 'purchase_completed',
} as const;
export type AnalyticsEvent = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export const FeatureFlag = {
  MobileCameraCapture: 'mobile_camera_capture',
  PanelRegeneration: 'panel_regeneration',
  PerUserLora: 'per_user_lora',
  PrintOnDemand: 'print_on_demand',
  NewStyleWatercolor: 'new_style_watercolor',
} as const;
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];
