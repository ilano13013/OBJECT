import { ArrowUpRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'ghost'

const base =
  'group relative inline-flex min-h-12 items-center justify-center gap-3 overflow-hidden rounded-full px-6 text-sm font-semibold tracking-tight transition-[transform,background-color,color,box-shadow] duration-300 ease-out-expo active:scale-[0.98] cursor-pointer select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-lime text-obsidian hover:shadow-[0_10px_40px_-8px_rgb(215_255_67/0.55)]',
  ghost: 'text-porcelain ring-1 ring-inset ring-silver/35 hover:ring-porcelain hover:bg-porcelain/5 backdrop-blur-sm',
}

function Inner({ children, icon = true }: { children: ReactNode; icon?: boolean }) {
  return (
    <>
      <span>{children}</span>
      {icon && (
        <ArrowUpRight
          aria-hidden
          className="size-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={2}
        />
      )}
    </>
  )
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; icon?: boolean }

export function LinkButton({ variant = 'primary', icon, className = '', children, ...rest }: LinkButtonProps) {
  return (
    <Link className={`${base} ${variants[variant]} ${className}`} {...rest}>
      <Inner icon={icon}>{children as ReactNode}</Inner>
    </Link>
  )
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; icon?: boolean }

export function Button({ variant = 'primary', icon = false, className = '', children, ...rest }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...rest}>
      <Inner icon={icon}>{children}</Inner>
    </button>
  )
}
