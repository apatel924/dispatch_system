export type Faq = { question: string; answer: string }

export const faqs: Faq[] = [
  {
    question: 'What areas do you deliver to?',
    answer:
      'Quick-Run Express currently focuses on Edmonton and surrounding service areas. Delivery availability depends on pickup location, destination, scheduling, and service requirements. Use the coverage checker or contact us to confirm your area.',
  },
  {
    question: 'How do I track my delivery?',
    answer:
      'Enter your tracking code on the Track Delivery page to see an example of the delivery status, estimated arrival, and notification history.',
  },
  {
    question: 'Do you support regulated deliveries?',
    answer:
      'Yes. We support structured delivery workflows for licensed retailers and regulated businesses, including recipient confirmation, verification steps, signature or photo proof of delivery, and event logging. Requirements vary by applicable legislation and retailer.',
  },
  {
    question: 'Can you handle recurring business deliveries?',
    answer:
      'We work with local businesses on same-day, scheduled, recurring, and multi-stop deliveries. Contact us to discuss a custom arrangement.',
  },
  {
    question: 'How do I get pricing?',
    answer:
      'Submit a request through the Request a Quote page with your delivery details, and we will follow up with the information you need.',
  },
]

export type CoverageItem = { title: string; description: string }

export const coverageItems: CoverageItem[] = [
  {
    title: 'Edmonton city coverage',
    description: 'Active delivery support across Edmonton and nearby areas.',
  },
  {
    title: 'Business delivery availability',
    description: 'Recurring and on-demand routes for local businesses.',
  },
  {
    title: 'Scheduled service',
    description: 'Plan deliveries for a specific date and time window.',
  },
  {
    title: 'Regulated-delivery consultation',
    description: 'Structured workflows for licensed and regulated operators.',
  },
  {
    title: 'Service-area confirmation',
    description: 'We confirm availability based on your pickup and destination.',
  },
]

export const whyQuickRun: CoverageItem[] = [
  {
    title: 'Local Edmonton service',
    description:
      'Built around Edmonton deliveries, with knowledge of the local area.',
  },
  {
    title: 'Clear delivery updates',
    description:
      'Customers receive status updates from pickup through to completion.',
  },
  {
    title: 'Professional drivers',
    description: 'Deliveries handled by drivers who represent your business well.',
  },
  {
    title: 'Verified completion',
    description: 'Signature and photo proof of delivery on completion.',
  },
  {
    title: 'Flexible scheduling',
    description: 'Same-day, scheduled, recurring, and multi-stop options.',
  },
  {
    title: 'Structured regulated workflows',
    description:
      'Recipient confirmation and verification steps for controlled deliveries.',
  },
]

export type Stat = { value: string; label: string; sublabel: string }

export const stats: Stat[] = [
  { value: 'Same-day', label: 'Local delivery', sublabel: 'Across Edmonton & nearby areas' },
  { value: 'Live', label: 'Status updates', sublabel: 'From pickup to completion' },
  { value: 'Proof', label: 'Of every delivery', sublabel: 'Signature & photo capture' },
  { value: 'Built-in', label: 'Verification', sublabel: 'For regulated deliveries' },
]

export type Testimonial = {
  quote: string
  name: string
  role: string
  initials: string
}

export const testimonials: Testimonial[] = [
  {
    quote:
      'Quick-Run Express handles our recurring runs across the city without us having to think about it. The status updates keep our front desk in the loop all day.',
    name: 'Dana M.',
    role: 'Operations Lead, Local Optical Group',
    initials: 'DM',
  },
  {
    quote:
      'The verification workflow is exactly what we needed for compliant deliveries. Recipient confirmation and proof of delivery are captured every single time.',
    name: 'Priya S.',
    role: 'Compliance Manager, Licensed Retailer',
    initials: 'PS',
  },
  {
    quote:
      'Same-day scheduling is straightforward and the drivers are professional. Our customers notice the difference when their order shows up on time.',
    name: 'Marcus T.',
    role: 'Owner, Edmonton Florist',
    initials: 'MT',
  },
]

export const industries = [
  'Retail',
  'Optical & medical offices',
  'Florists',
  'Local e-commerce',
  'Auto parts',
  'Professional services',
  'Specialty retailers',
  'Licensed dispensaries',
]

// Edmonton-area service locations (illustrative coverage list)
export const coverageCities = [
  'Downtown',
  'Sherwood Park',
  'St. Albert',
  'Leduc',
  'Spruce Grove',
  'Beaumont',
  'Nisku',
  'Fort Saskatchewan',
  'Stony Plain',
]

// Edmonton-area postal code prefixes (front-end demo only — not real validation)
export const SERVICE_PREFIXES = ['T5', 'T6']
export const NEARBY_PREFIXES = ['T7', 'T8', 'T9']
