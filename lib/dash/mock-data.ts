export type OrderStatus =
  | "New"
  | "Assigned"
  | "Picked Up"
  | "Out for Delivery"
  | "Delivered"
  | "Failed"
  | "Returned"
  | "Scheduled";

export type PaymentStatus = "Paid" | "Pending" | "Unpaid";

export type DriverStatus = "Available" | "Busy" | "Inactive" | "Suspended";

export interface Order {
  id: string;
  external: string;
  customer: string;
  phone: string;
  address: string;
  driver: string | null;
  status: OrderStatus;
  payment: PaymentStatus;
  total: string;
  created: string;
  updated: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: DriverStatus;
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  averageTime: string;
  lastActive: string;
  avatarColor: string;
  initials: string;
  rating?: number;
  successRate?: number;
  deliveries?: number;
  vehicle?: string;
}

export const orders: Order[] = [
  { id: "QRX-10098", external: "UBER-9F23K", customer: "Acme Manufacturing", phone: "(555) 123-4567", address: "1200 Industrial Blvd, Dallas, TX 75201", driver: "James Carter", status: "Out for Delivery", payment: "Paid", total: "$128.50", created: "May 16, 9:12 AM", updated: "May 16, 11:42 AM" },
  { id: "QRX-10097", external: "DOORDASH-7721", customer: "Northside Pharmacy", phone: "(555) 234-5678", address: "4821 Main St, Dallas, TX 75206", driver: "Maria Sanchez", status: "Picked Up", payment: "Paid", total: "$45.20", created: "May 16, 9:03 AM", updated: "May 16, 11:28 AM" },
  { id: "QRX-10096", external: "AMZ-19KD2", customer: "Global Office Supplies", phone: "(555) 345-6789", address: "3100 McKinney Ave, Dallas, TX 75204", driver: "Derrick Brown", status: "Assigned", payment: "Pending", total: "$89.99", created: "May 16, 9:01 AM", updated: "May 16, 9:05 AM" },
  { id: "QRX-10095", external: "—", customer: "City Hospital Supply", phone: "(555) 456-7890", address: "3500 Gaston Ave, Dallas, TX 75246", driver: null, status: "New", payment: "Pending", total: "$215.00", created: "May 16, 8:58 AM", updated: "May 16, 8:58 AM" },
  { id: "QRX-10094", external: "UBER-12HJK", customer: "Downtown Deli", phone: "(555) 567-8901", address: "1500 Elm St, Dallas, TX 75201", driver: "Kevin Johnson", status: "Out for Delivery", payment: "Paid", total: "$32.15", created: "May 16, 8:45 AM", updated: "May 16, 11:35 AM" },
  { id: "QRX-10093", external: "POSTMATES-885", customer: "Tech Solutions Inc.", phone: "(555) 678-9012", address: "1750 N Central Expy, Dallas, TX 75201", driver: "Aisha Patel", status: "Delivered", payment: "Paid", total: "$175.00", created: "May 16, 8:20 AM", updated: "May 16, 10:15 AM" },
  { id: "QRX-10092", external: "AMZ-7K9PL", customer: "Main Street Boutique", phone: "(555) 789-0123", address: "2101 Greenville Ave, Dallas, TX 75206", driver: "Luis Martinez", status: "Delivered", payment: "Paid", total: "$61.75", created: "May 16, 8:18 AM", updated: "May 16, 9:52 AM" },
  { id: "QRX-10091", external: "WALMART-3344", customer: "West End Hardware", phone: "(555) 890-1234", address: "2929 N Fitzhugh Ave, Dallas, TX 75204", driver: "Brian Wilson", status: "Picked Up", payment: "Unpaid", total: "$94.30", created: "May 16, 8:10 AM", updated: "May 16, 9:14 AM" },
  { id: "QRX-10090", external: "GRUBHUB-2211", customer: "Seaside Coffee Co.", phone: "(555) 901-2345", address: "2200 Victory Ave, Dallas, TX 75219", driver: "Maria Sanchez", status: "Out for Delivery", payment: "Paid", total: "$17.80", created: "May 16, 8:05 AM", updated: "May 16, 11:20 AM" },
  { id: "QRX-10089", external: "—", customer: "Peak Performance Gym", phone: "(555) 012-3456", address: "3102 Oak Lawn Ave, Dallas, TX 75219", driver: "James Carter", status: "Delivered", payment: "Paid", total: "$59.99", created: "May 16, 7:55 AM", updated: "May 16, 9:30 AM" },
  { id: "QRX-10088", external: "SAMSCLUB-9988", customer: "Bright Schools District", phone: "(555) 123-9876", address: "6701 Hillcrest Rd, Dallas, TX 75230", driver: "Derrick Brown", status: "Assigned", payment: "Pending", total: "$132.45", created: "May 16, 7:42 AM", updated: "May 16, 8:00 AM" },
  { id: "QRX-10087", external: "AMZ-2PQWE", customer: "Green Valley Market", phone: "(555) 234-8765", address: "5440 W Lovers Ln, Dallas, TX 75209", driver: null, status: "New", payment: "Pending", total: "$28.60", created: "May 16, 7:28 AM", updated: "May 16, 7:28 AM" },
  { id: "QRX-10086", external: "UBER-8JH21", customer: "Smith & Co. Legal", phone: "(555) 345-7654", address: "8181 Preston Rd, Dallas, TX 75225", driver: "Kevin Johnson", status: "Failed", payment: "Unpaid", total: "$0.00", created: "May 16, 7:15 AM", updated: "May 16, 8:02 AM" },
  { id: "QRX-10085", external: "DOORDASH-1122", customer: "Riverside Restaurant", phone: "(555) 456-6543", address: "7800 Bishop Rd, Dallas, TX 75230", driver: "Luis Martinez", status: "Returned", payment: "Pending", total: "$42.10", created: "May 16, 6:50 AM", updated: "May 16, 7:40 AM" },
  { id: "QRX-10084", external: "POSTMATES-771", customer: "Metro Electronics", phone: "(555) 567-5432", address: "1333 W Mockingbird Ln, Dallas, TX 75247", driver: "Aisha Patel", status: "Out for Delivery", payment: "Paid", total: "$199.95", created: "May 16, 6:45 AM", updated: "May 16, 10:50 AM" },
];

export const drivers: Driver[] = [
  { id: "DRV-10012", name: "James Carter", phone: "(555) 234-9876", email: "james.carter@qre.com", status: "Available", activeDeliveries: 1, completedToday: 8, failedToday: 0, averageTime: "24m", lastActive: "2m ago", avatarColor: "bg-info-soft text-info", initials: "JC", rating: 4.9, successRate: 95.8, deliveries: 48, vehicle: "White Ford Transit (QRX-21)" },
  { id: "DRV-10013", name: "Maria Sanchez", phone: "(555) 301-6542", email: "maria.sanchez@qre.com", status: "Busy", activeDeliveries: 3, completedToday: 7, failedToday: 0, averageTime: "26m", lastActive: "4m ago", avatarColor: "bg-warning-soft text-warning-foreground", initials: "MS", rating: 4.8, successRate: 92.9, deliveries: 42 },
  { id: "DRV-10014", name: "Derrick Brown", phone: "(555) 610-8392", email: "derrick.brown@qre.com", status: "Busy", activeDeliveries: 2, completedToday: 6, failedToday: 1, averageTime: "31m", lastActive: "1m ago", avatarColor: "bg-purple-soft text-purple", initials: "DB", rating: 4.7, successRate: 90.3, deliveries: 36 },
  { id: "DRV-10015", name: "Kevin Johnson", phone: "(555) 442-7711", email: "kevin.johnson@qre.com", status: "Busy", activeDeliveries: 2, completedToday: 5, failedToday: 0, averageTime: "27m", lastActive: "3m ago", avatarColor: "bg-orange-soft text-orange", initials: "KJ", rating: 4.8, successRate: 93.8, deliveries: 32 },
  { id: "DRV-10016", name: "Aisha Patel", phone: "(555) 786-2210", email: "aisha.patel@qre.com", status: "Available", activeDeliveries: 0, completedToday: 6, failedToday: 0, averageTime: "22m", lastActive: "6m ago", avatarColor: "bg-success-soft text-success", initials: "AP", rating: 4.9, successRate: 91.1, deliveries: 28 },
  { id: "DRV-10017", name: "Luis Martinez", phone: "(555) 789-0123", email: "luis.martinez@qre.com", status: "Available", activeDeliveries: 1, completedToday: 5, failedToday: 0, averageTime: "23m", lastActive: "7m ago", avatarColor: "bg-info-soft text-info", initials: "LM" },
  { id: "DRV-10018", name: "Brian Wilson", phone: "(555) 890-1234", email: "brian.wilson@qre.com", status: "Busy", activeDeliveries: 2, completedToday: 4, failedToday: 1, averageTime: "30m", lastActive: "2m ago", avatarColor: "bg-warning-soft text-warning-foreground", initials: "BW" },
  { id: "DRV-10019", name: "Sarah Thompson", phone: "(555) 234-5678", email: "sarah.thompson@qre.com", status: "Available", activeDeliveries: 0, completedToday: 4, failedToday: 0, averageTime: "21m", lastActive: "10m ago", avatarColor: "bg-purple-soft text-purple", initials: "ST" },
  { id: "DRV-10020", name: "Michael Lee", phone: "(555) 345-6789", email: "michael.lee@qre.com", status: "Inactive", activeDeliveries: 0, completedToday: 1, failedToday: 0, averageTime: "—", lastActive: "2h ago", avatarColor: "bg-muted text-muted-foreground", initials: "ML" },
  { id: "DRV-10021", name: "Daniel Ramirez", phone: "(555) 456-7890", email: "daniel.ramirez@qre.com", status: "Suspended", activeDeliveries: 0, completedToday: 0, failedToday: 2, averageTime: "—", lastActive: "3d ago", avatarColor: "bg-muted text-muted-foreground", initials: "DR" },
  { id: "DRV-10022", name: "Emily Davis", phone: "(555) 567-8901", email: "emily.davis@qre.com", status: "Available", activeDeliveries: 0, completedToday: 3, failedToday: 0, averageTime: "24m", lastActive: "9m ago", avatarColor: "bg-success-soft text-success", initials: "ED" },
  { id: "DRV-10023", name: "Robert Miller", phone: "(555) 678-9012", email: "robert.miller@qre.com", status: "Busy", activeDeliveries: 2, completedToday: 3, failedToday: 0, averageTime: "29m", lastActive: "5m ago", avatarColor: "bg-orange-soft text-orange", initials: "RM" },
];

export const recentActivity = [
  { icon: "check", tone: "success", title: "Order QRX-10093 delivered successfully", by: "Aisha Patel", time: "10:15 AM" },
  { icon: "truck", tone: "orange", title: "Order QRX-10098 is out for delivery", by: "James Carter", time: "11:42 AM" },
  { icon: "file", tone: "info", title: "New order QRX-10097 created", by: "System", time: "9:03 AM" },
  { icon: "x", tone: "destructive", title: "Order QRX-10086 marked as failed", by: "Kevin Johnson", time: "8:02 AM" },
  { icon: "refresh", tone: "muted", title: "Order QRX-10085 returned", by: "Luis Martinez", time: "7:40 AM" },
];