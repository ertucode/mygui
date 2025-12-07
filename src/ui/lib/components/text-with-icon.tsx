import { type LucideIcon } from "lucide-react";

type TextWithIconProps = {
  icon: LucideIcon;
  children: React.ReactNode;
  iconClassName?: string;
};

export function TextWithIcon({
  icon: Icon,
  children,
  iconClassName = "size-4",
}: TextWithIconProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={iconClassName} />
      {children}
    </div>
  );
}
