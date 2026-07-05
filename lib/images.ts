/**
 * Central registry for public image paths under `/images/`.
 * Update here when adding or moving assets — components import from this file.
 */

export const images = {
  brand: {
    logo: '/images/brand/logo.png',
  },
  heroes: {
    vanDriving: '/images/heroes/van-driving.png',
    packageHandoff: '/images/heroes/package-handoff.png',
    idVerification: '/images/heroes/id-verification.png',
    vanEvening: '/images/heroes/van-evening.png',
  },
  marketing: {
    albertaMap: '/images/marketing/alberta-map.png',
    edmontonSkyline: '/images/marketing/edmonton-skyline.png',
  },
  mockups: {
    trackingUi: '/images/mockups/tracking-ui.png',
    smsMockup: '/images/mockups/sms-mockup.png',
    businessDashboard: '/images/mockups/business-dashboard.png',
    verificationUi: '/images/mockups/verification-ui.png',
  },
} as const

export type ImagePath =
  | (typeof images.brand)[keyof typeof images.brand]
  | (typeof images.heroes)[keyof typeof images.heroes]
  | (typeof images.marketing)[keyof typeof images.marketing]
  | (typeof images.mockups)[keyof typeof images.mockups]
