interface StatusDotProps {
  title?: string;
  className?: string;
}

export function StatusDot({ title, className = 'ui-status-dot' }: StatusDotProps) {
  return <span className={className} title={title} />;
}
