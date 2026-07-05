export type WorkflowStep = {
  number: string
  title: string
  description: string
}

// Regulated-delivery sticky workflow steps
export const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Order submitted',
    description:
      'A delivery request is received with recipient and verification requirements.',
  },
  {
    number: '02',
    title: 'Driver assigned',
    description: 'A driver is assigned and the delivery is prepared for pickup.',
  },
  {
    number: '03',
    title: 'Customer notified',
    description:
      'The recipient receives status updates as the delivery moves toward them.',
  },
  {
    number: '04',
    title: 'Named recipient confirmed',
    description:
      'The driver confirms the delivery is going to the named recipient on the order.',
  },
  {
    number: '05',
    title: 'Required verification recorded',
    description:
      'Age and identity checks are completed and recorded where required.',
  },
  {
    number: '06',
    title: 'Signature or photo captured',
    description:
      'A signature or delivery photo is captured as proof of delivery.',
  },
  {
    number: '07',
    title: 'Completion event logged',
    description:
      'The delivery completion is recorded in the system with a timestamp.',
  },
  {
    number: '08',
    title: 'Failed delivery documented',
    description:
      'If a delivery cannot be completed, the reason is documented for the retailer.',
  },
]

// Simple 4-step how-it-works
export const howItWorksSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Submit the delivery',
    description:
      'Share pickup, destination, and any verification requirements through a quick request.',
  },
  {
    number: '02',
    title: 'A driver is assigned',
    description: 'We review the request and assign a driver for pickup.',
  },
  {
    number: '03',
    title: 'The customer receives updates',
    description:
      'Status updates keep recipients informed from pickup to arrival.',
  },
  {
    number: '04',
    title: 'Delivery and verification completed',
    description:
      'Required recipient checks are completed and proof of delivery is captured.',
  },
]

// Extended how-it-works (page)
export const howItWorksExtended: WorkflowStep[] = [
  {
    number: '01',
    title: 'Delivery request submitted',
    description: 'You provide the delivery details and any special requirements.',
  },
  {
    number: '02',
    title: 'Order reviewed and assigned',
    description: 'We review the request and assign an available driver.',
  },
  {
    number: '03',
    title: 'Pickup completed',
    description: 'The driver collects the package from the pickup location.',
  },
  {
    number: '04',
    title: 'Customer notified',
    description: 'The recipient is notified that the delivery is on its way.',
  },
  {
    number: '05',
    title: 'Delivery tracked',
    description: 'Progress is tracked and shared throughout the route.',
  },
  {
    number: '06',
    title: 'Required recipient checks completed',
    description: 'Any verification steps are completed at the door where required.',
  },
  {
    number: '07',
    title: 'Delivery confirmed',
    description: 'Proof of delivery is captured and the completion is logged.',
  },
]
