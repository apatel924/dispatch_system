export const siteConfig = {
  name: 'Quick-Run Express',
  shortName: 'Quick-Run',
  description:
    'Dependable same-day, scheduled, business, and regulated delivery services throughout Edmonton, Alberta.',
  // NOTE: placeholder contact details — replace with confirmed client information.
  phone: '(000) 000-0000',
  phoneHref: '+10000000000',
  email: 'hello@quickrunexpress.ca',
  hours: 'Mon–Fri 8:00 AM – 6:00 PM · Sat 9:00 AM – 2:00 PM',
  hoursShort: 'Mon–Fri 8a–6p · Sat 9a–2p',
  addressLine1: 'Edmonton, Alberta',
  addressLine2: 'Service area across Edmonton & surrounding communities',
  city: 'Edmonton, Alberta',
}

export type NavLink = { label: string; href: string }

export const navLinks: NavLink[] = [
  { label: 'Services', href: '/main-website/services' },
  { label: 'Business Delivery', href: '/main-website/business-delivery' },
  { label: 'Regulated Delivery', href: '/main-website/regulated-delivery' },
  { label: 'How It Works', href: '/main-website/how-it-works' },
  { label: 'Coverage', href: '/main-website/coverage' },
  { label: 'Track Delivery', href: '/main-website/track' },
  { label: 'Contact', href: '/main-website/contact' },
]

export const footerSections = [
  {
    title: 'Services',
    links: [
      { label: 'Same-Day Delivery', href: '/main-website/services' },
      { label: 'Scheduled Delivery', href: '/main-website/services' },
      { label: 'Business Delivery', href: '/main-website/business-delivery' },
      { label: 'Regulated Delivery', href: '/main-website/regulated-delivery' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'How It Works', href: '/main-website/how-it-works' },
      { label: 'Coverage', href: '/main-website/coverage' },
      { label: 'Track Delivery', href: '/main-website/track' },
      { label: 'Request a Quote', href: '/main-website/quote' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Contact', href: '/main-website/contact' },
      { label: 'Privacy Policy', href: '/main-website/contact' },
      { label: 'Terms of Service', href: '/main-website/contact' },
      { label: 'Accessibility', href: '/main-website/contact' },
    ],
  },
]
