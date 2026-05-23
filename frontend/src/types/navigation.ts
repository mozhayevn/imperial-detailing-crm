export type NavigationBadgeTone =
  | "default"
  | "primary"
  | "warning"
  | "danger"
  | "success";

export type NavigationItem = {
  title: string;
  href: string;
  icon?: string;
  description?: string;
  badge?: {
    label: string;
    tone?: NavigationBadgeTone;
  };
  isFuture?: boolean;
  children?: NavigationItem[];
};