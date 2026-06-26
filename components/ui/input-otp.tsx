'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { cn } from '@/lib/utils';

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />;
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context?.slots[index];
  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:ring-[3px]',
        className,
      )}
      {...props}
    >
      {slot?.char}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
