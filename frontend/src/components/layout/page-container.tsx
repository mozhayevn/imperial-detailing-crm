import { cn } from "@/src/lib/cn";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px]", className)}>
      {children}
    </div>
  );
}