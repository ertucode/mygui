type TextWithIconProps = {
  icon?: $Maybe<React.ComponentType<{ className?: string }>>;
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
      {Icon && <Icon className={iconClassName} />}
      {children}
    </div>
  );
}
