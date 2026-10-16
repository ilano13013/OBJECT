export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`display inline-flex items-baseline leading-none ${className}`} aria-label="OBJECT.">
      OBJECT<span className="text-lime">.</span>
    </span>
  )
}
