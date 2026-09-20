import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-100 shadow', className)}
      {...props}
    />
  )
}
