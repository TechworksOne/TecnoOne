export default function Skeleton({
  className = "h-6 w-full bg-gray-200 rounded animate-pulse",
}: {
  className?: string;
}) {
  return <div className={className}></div>;
}
