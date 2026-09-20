import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
        className,
      )}
      {...props}
    />
  )
}
