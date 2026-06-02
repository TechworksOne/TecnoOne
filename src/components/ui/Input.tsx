import React from 'react';

const Input = React.forwardRef<HTMLInputElement, { placeholder?: string; value?: string; onChange?: any; type?: string; className?: string } & any>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={`border rounded-lg p-2 bg-white dark:bg-[#060B14] text-[#14324A] dark:text-[#F8FAFC] border-[#D6EEF8] dark:border-[rgba(72,185,230,0.16)] placeholder:text-[#7F8A99] outline-none focus:border-[#48B9E6] transition-colors${className ? ' ' + className : ''}`} {...props} />;
  }
);

Input.displayName = 'Input';

export default Input;
