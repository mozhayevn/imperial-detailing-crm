export const routes = {
  home: "/",
  login: "/login",

  dashboard: "/dashboard",
  finance: "/finance",
  expenses: "/expenses",

  profile: "/profile#profile",
  profileSecurity: "/profile#security",
  profilePrivacy: "/profile#privacy",

  orders: "/orders",
  newOrder: "/orders/new",
  orderDetails: (orderId: string | number) => `/orders/${orderId}`,
  editOrder: (orderId: string | number) => `/orders/${orderId}/edit`,
  orderPricing: (orderId: string | number) => `/orders/${orderId}/pricing`,
  orderAudit: (orderId: string | number) => `/orders/${orderId}/audit`,

  clients: "/clients",
  newClient: "/clients/new",
  clientDetails: (clientId: string | number) => `/clients/${clientId}`,
  clientHistory: (clientId: string | number) => `/clients/${clientId}/history`,

  cars: "/cars",
  carDetails: (carId: string | number) => `/cars/${carId}`,

  services: "/services",
  servicePackages: "/services/packages",
  materials: "/services/materials",
  materialBrands: "/services/material-brands",

  pricing: "/pricing",

  workBays: "/work-bays",
  workBaySchedule: "/work-bays/schedule",
  workBayAvailability: "/work-bays/availability",

  audits: "/audits",
  orderAudits: "/audits/orders",
  pricingAudits: "/audits/pricing",
  userRoleAudits: "/audits/users",
  securityAudit: "/audits/security",

  users: "/users",
  userProfile: (userId: string | number) => `/users/${userId}`,

  admin: "/admin",
  adminUsers: "/admin/users",
  adminRoles: "/admin/roles",
  adminPermissions: "/admin/permissions",

  leads: "/leads",
  newLead: "/leads/new",
  leadDetails: (leadId: string | number) => `/leads/${leadId}`,
  leadContacts: "/leads/contacts",
  leadContactDetails: (leadContactId: string | number) =>
    `/leads/contacts/${leadContactId}`,
  inboundRequests: "/leads/inbound",
  leadSources: "/leads/sources",

  ai: "/ai",
} as const;