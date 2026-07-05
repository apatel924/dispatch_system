// Mock tracking data — front-end demonstration only. No backend.
// Only this demo code returns a sample delivery.
export const DEMO_TRACKING_CODE = 'QRX-28491'

export type TrackingStep = {
  label: string
  time: string
  status: 'complete' | 'current' | 'pending'
}

export type NotificationEvent = {
  title: string
  time: string
}

export type DemoDelivery = {
  code: string
  status: string
  estimatedArrival: string
  deliveryType: string
  driverFirstName: string
  steps: TrackingStep[]
  notifications: NotificationEvent[]
}

export const demoDelivery: DemoDelivery = {
  code: DEMO_TRACKING_CODE,
  status: 'In transit',
  estimatedArrival: 'Today, approx. 18 minutes',
  deliveryType: 'Express — same-day',
  driverFirstName: 'Your assigned driver',
  steps: [
    { label: 'Order received', time: 'Today, 9:45 AM', status: 'complete' },
    { label: 'Driver assigned', time: 'Today, 9:50 AM', status: 'complete' },
    { label: 'Picked up', time: 'Today, 10:02 AM', status: 'complete' },
    { label: 'In transit', time: 'Current step', status: 'current' },
    { label: 'Delivered', time: 'Pending', status: 'pending' },
  ],
  notifications: [
    { title: 'Order received', time: '9:45 AM' },
    { title: 'Driver assigned', time: '9:50 AM' },
    { title: 'Delivery picked up', time: '10:02 AM' },
    { title: 'Driver approaching', time: '10:30 AM' },
  ],
}
