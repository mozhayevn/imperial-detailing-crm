import { routes } from "@/src/config/routes";
import type { NavigationItem } from "@/src/types/navigation";

export const mainNavigation: NavigationItem[] = [
  {
    title: "Дашборд",
    href: routes.dashboard,
    icon: "LayoutDashboard",
    description: "Операционная сводка",
  },
  {
    title: "Финансы",
    href: routes.finance,
    icon: "BadgeDollarSign",
    description: "Выручка, оплаты и маржинальность",
  },
  {
    title: "Заказы",
    href: routes.orders,
    icon: "ClipboardList",
    description: "Заказы и производственный поток",
  },
  {
    title: "Клиенты",
    href: routes.clients,
    icon: "Users",
    description: "Профили, авто и история",
  },
  {
    title: "Автомобили",
    href: routes.cars,
    icon: "Car",
    description: "Машины клиентов",
  },
  {
    title: "Услуги",
    href: routes.services,
    icon: "Sparkles",
    description: "Услуги, пакеты, материалы",
  },
  {
    title: "Склад",
    description: "Остатки и складская стоимость",
    href: "/inventory",
  },
  {
    title: "Ценообразование",
    href: "/pricing/rules",
    icon: "BadgeDollarSign",
    description: "Правила, расчеты и фиксация цен",
  },
  {
    title: "Рабочие боксы",
    href: routes.workBays,
    icon: "Warehouse",
    description: "Занятость и расписание",
  },
  {
    title: "Аудит",
    href: routes.audits,
    icon: "History",
    description: "История заказов, цен и ролей",
  },
];

export const adminNavigation: NavigationItem[] = [
  {
    title: "Администрирование",
    href: routes.admin,
    icon: "Shield",
    description: "Пользователи, роли и права",
  },
];

export const futureNavigation: NavigationItem[] = [
  {
    title: "Заявки",
    href: routes.leads,
    icon: "Inbox",
    description: "Будущие заявки из мессенджеров",
    badge: {
      label: "Скоро",
      tone: "primary",
    },
    isFuture: true,
  },
  {
    title: "AI-ассистент",
    href: routes.ai,
    icon: "Bot",
    description: "Будущие AI-подсказки и рекомендации",
    badge: {
      label: "AI",
      tone: "warning",
    },
    isFuture: true,
  },
];