export default function Select({ onValueChange, className, ...props }: any) {
  return (
    <select
      className={`border rounded-lg p-2 bg-white dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] outline-none focus:border-[#48B9E6] transition-colors${className ? ' ' + className : ''}`}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...props} 
    />
  );
}
