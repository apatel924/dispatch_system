import {
  Zap,
  CalendarClock,
  Building2,
  ShieldCheck,
  Route,
  Boxes,
  type LucideIcon,
} from 'lucide-react'

export type Service = {
  slug: string
  icon: LucideIcon
  title: string
  short: string
  benefit: string
  forWho: string
  how: string
  benefits: string[]
  availability: string
}

export const services: Service[] = [
  {
    slug: 'same-day',
    icon: Zap,
    title: 'Same-Day Delivery',
    short:
      'Time-sensitive pickups and drop-offs handled quickly across Edmonton.',
    benefit: 'Get urgent items where they need to be, the same day.',
    forWho:
      'Businesses and individuals who need urgent items moved across the city without waiting for next-day couriers.',
    how: 'Submit your delivery details, a driver is assigned, and your package is picked up and delivered with status updates along the way.',
    benefits: [
      'Fast turnaround for urgent items',
      'Live status updates from pickup to drop-off',
      'Proof of delivery on completion',
    ],
    availability: 'Availability depends on pickup location, destination, and timing.',
  },
  {
    slug: 'scheduled',
    icon: CalendarClock,
    title: 'Scheduled Delivery',
    short: 'Plan deliveries in advance for a specific date and time window.',
    benefit: 'Reliable deliveries that fit your schedule.',
    forWho:
      'Anyone who wants to book a delivery ahead of time around appointments, store hours, or recipient availability.',
    how: 'Choose your preferred date and time when requesting a quote. We confirm the window and keep customers notified.',
    benefits: [
      'Book deliveries ahead of time',
      'Preferred date and time windows',
      'Customer notifications throughout',
    ],
    availability: 'Time windows are confirmed based on route and service area.',
  },
  {
    slug: 'business',
    icon: Building2,
    title: 'Business Delivery',
    short: 'Recurring and on-demand delivery support for local businesses.',
    benefit: 'Outsource delivery without adding operational complexity.',
    forWho:
      'Retailers, offices, and local operators who need dependable delivery support without managing their own drivers.',
    how: 'We set up delivery arrangements around your business needs, from one-off jobs to recurring routes.',
    benefits: [
      'Same-day and scheduled options',
      'Recurring business routes',
      'Proof of completion and notifications',
    ],
    availability: 'Custom arrangements available — contact us to discuss.',
  },
  {
    slug: 'multi-stop',
    icon: Route,
    title: 'Multi-Stop Delivery',
    short: 'Multiple pickups or drop-offs handled on a single coordinated run.',
    benefit: 'Efficient routing for several deliveries at once.',
    forWho:
      'Businesses sending to multiple recipients, or customers with several drop-off points in one trip.',
    how: 'Provide your stops when requesting a quote and we coordinate an efficient route across them.',
    benefits: [
      'Several stops on one run',
      'Coordinated, efficient routing',
      'Status updates per delivery',
    ],
    availability: 'Stop count and routing confirmed per request.',
  },
  {
    slug: 'regulated',
    icon: ShieldCheck,
    title: 'Regulated Delivery',
    short:
      'Structured workflows for licensed retailers and regulated businesses.',
    benefit: 'Recipient verification and documented proof of delivery.',
    forWho:
      'Licensed retailers and regulated businesses that require recipient confirmation and verification steps.',
    how: 'We follow a structured workflow including recipient confirmation, verification steps, signature or photo proof, and event logging.',
    benefits: [
      'Named-recipient confirmation',
      'Age and identity verification steps',
      'Signature and photo proof of delivery',
    ],
    availability:
      'Designed to support AGLC-aligned delivery workflows. Requirements vary by legislation and retailer.',
  },
  {
    slug: 'custom-commercial',
    icon: Boxes,
    title: 'Custom Commercial Delivery',
    short: 'Tailored delivery arrangements for specialized requirements.',
    benefit: 'A delivery setup built around how your business operates.',
    forWho:
      'Operations with specific handling, scheduling, or documentation needs that fall outside standard options.',
    how: 'We discuss your requirements and design a delivery arrangement and service agreement to match.',
    benefits: [
      'Tailored to your requirements',
      'Flexible scheduling and handling',
      'Documentation to suit your needs',
    ],
    availability: 'Built around a service agreement — contact us to scope it out.',
  },
]
