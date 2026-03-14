/* eslint-disable react-refresh/only-export-components */
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type PolymorphicProps<C extends ElementType, Props extends object = object> = Props & {
  as?: C
} & Omit<ComponentPropsWithoutRef<C>, keyof Props | 'as'>

type BasicButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  children: ReactNode
  className?: string
}

type BasicDivProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  children: ReactNode
  className?: string
}

const isDisableableElement = (
  element: HTMLElement,
): element is HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  'disabled' in element

/* ── Accessibility ── */

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Legacy hook — now always returns true since GSAP is bundled via npm.
 * Kept for backward compatibility with consumers that gate on `gsapReady`.
 */
export const useGSAPLoader = () => {
  const [loaded] = useState(true)
  return loaded
}

/* ── Scroll Animation Primitives ── */

export const useScrollReveal = (
  options?: {
    y?: number
    duration?: number
    delay?: number
    start?: string
  },
) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (prefersReducedMotion()) {
      gsap.set(ref.current, { opacity: 1, y: 0 })
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: options?.y ?? 40 },
        {
          opacity: 1,
          y: 0,
          duration: options?.duration ?? 0.7,
          delay: options?.delay ?? 0,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ref.current,
            start: options?.start ?? 'top 88%',
          },
        },
      )
    }, ref)

    return () => ctx.revert()
  }, [])

  return ref
}

export const ScrollReveal = ({
  children,
  className,
  y = 40,
  duration = 0.7,
  delay = 0,
  start = 'top 88%',
  ...divProps
}: {
  children: ReactNode
  className?: string
  y?: number
  duration?: number
  delay?: number
  start?: string
} & Omit<ComponentPropsWithoutRef<'div'>, 'children'>) => {
  const ref = useScrollReveal({ y, duration, delay, start })
  return (
    <div ref={ref} className={`scroll-reveal-init ${className ?? ''}`} {...divProps}>
      {children}
    </div>
  )
}

export const useStaggerReveal = (
  itemSelector: string,
  options?: {
    y?: number
    stagger?: number
    duration?: number
    start?: string
  },
) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const items = ref.current.querySelectorAll(itemSelector)
    if (!items.length) return

    if (prefersReducedMotion()) {
      items.forEach((item) => gsap.set(item, { opacity: 1, y: 0 }))
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, y: options?.y ?? 30 },
        {
          opacity: 1,
          y: 0,
          stagger: options?.stagger ?? 0.1,
          duration: options?.duration ?? 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ref.current,
            start: options?.start ?? 'top 85%',
          },
        },
      )
    }, ref)

    return () => ctx.revert()
  }, [])

  return ref
}

export const useCountUp = (
  endValue: number,
  options?: {
    prefix?: string
    suffix?: string
    duration?: number
    decimals?: number
  },
) => {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const el = ref.current
    const formatted = options?.decimals
      ? endValue.toFixed(options.decimals)
      : Math.round(endValue).toLocaleString()
    const finalText = `${options?.prefix ?? ''}${formatted}${options?.suffix ?? ''}`

    if (prefersReducedMotion()) {
      el.textContent = finalText
      return
    }

    const proxy = { val: 0 }

    const ctx = gsap.context(() => {
      gsap.to(proxy, {
        val: endValue,
        duration: options?.duration ?? 1.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
        },
        onUpdate: () => {
          const current = options?.decimals
            ? proxy.val.toFixed(options.decimals)
            : Math.round(proxy.val).toLocaleString()
          el.textContent = `${options?.prefix ?? ''}${current}${options?.suffix ?? ''}`
        },
        onComplete: () => {
          el.textContent = finalText
        },
      })
    })

    return () => ctx.revert()
  }, [endValue])

  return ref
}

/* ── Modal Animation ── */

export const useModalAnimation = (isOpen: boolean, duration = 0.2) => {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const backdropRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
    } else if (shouldRender) {
      if (prefersReducedMotion() || !backdropRef.current) {
        setShouldRender(false)
        return
      }
      gsap.to(backdropRef.current, { opacity: 0, duration, ease: 'power2.in' })
      if (contentRef.current) {
        gsap.to(contentRef.current, {
          opacity: 0,
          y: 15,
          scale: 0.98,
          duration,
          ease: 'power2.in',
          onComplete: () => { setShouldRender(false) },
        })
      } else {
        setShouldRender(false)
      }
    }
  }, [isOpen])

  return { shouldRender, backdropRef, contentRef }
}

/* ── Interactive Primitives ── */

export const useMagnetic = (strength = 0.35) => {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return

    const el = ref.current
    const xTo = gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 1, ease: 'power3.out' })

    const handleMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event
      const { left, top, width, height } = el.getBoundingClientRect()
      const x = clientX - (left + width / 2)
      const y = clientY - (top + height / 2)
      xTo(x * strength)
      yTo(y * strength)
    }

    const handleMouseLeave = () => {
      xTo(0)
      yTo(0)
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [strength])

  return ref
}

export const useGlassShimmer = () => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMouseMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      el.style.setProperty('--mouse-x', `${x}px`)
      el.style.setProperty('--mouse-y', `${y}px`)
    }

    el.addEventListener('mousemove', handleMouseMove)
    return () => el.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return ref
}

export const CustomCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    gsap.set(dot, { xPercent: -50, yPercent: -50 })
    gsap.set(ring, { xPercent: -50, yPercent: -50 })

    const xTo = gsap.quickTo(ring, 'x', { duration: 0.6, ease: 'power3' })
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.6, ease: 'power3' })

    const onMouseMove = (event: MouseEvent) => {
      gsap.set(dot, { x: event.clientX, y: event.clientY })
      xTo(event.clientX)
      yTo(event.clientY)
    }

    const onHoverStart = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-cursor="expand"]')) {
        gsap.to(ring, { scale: 2, duration: 0.3 })
      }
    }

    const onHoverEnd = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-cursor="expand"]')) {
        gsap.to(ring, { scale: 1, duration: 0.3 })
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseover', onHoverStart)
    window.addEventListener('mouseout', onHoverEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseover', onHoverStart)
      window.removeEventListener('mouseout', onHoverEnd)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}

export const SplitText = ({
  children,
  className,
}: {
  children: string
  className?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    if (prefersReducedMotion()) {
      const words = ref.current.querySelectorAll('.word')
      words.forEach((word) => gsap.set(word, { y: '0%', rotateX: 0, opacity: 1 }))
      return
    }

    const ctx = gsap.context(() => {
      const words = ref.current?.querySelectorAll('.word')
      if (!words) return
      gsap.fromTo(
        words,
        { y: '110%', rotateX: -40, opacity: 0 },
        {
          y: '0%',
          rotateX: 0,
          opacity: 1,
          stagger: 0.02,
          duration: 0.8,
          ease: 'power4.out',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 90%',
          },
        },
      )
    }, ref)

    return () => ctx.revert()
  }, [])

  const words = children.split(' ')

  return (
    <div
      ref={ref}
      className={`split-text-wrapper ${className ?? ''}`}
      style={{ overflow: 'hidden', perspective: '1000px' }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="word-wrapper"
          style={{
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'top',
          }}
        >
          <span className="word" style={{ display: 'inline-block', transformOrigin: '0% 100%' }}>
            {word}
          </span>
          {index < words.length - 1 && '\u00A0'}
        </span>
      ))}
    </div>
  )
}

export const MagneticButton = ({ children, className, ...buttonProps }: BasicButtonProps) => {
  const ref = useMagnetic()
  return (
    <button ref={ref} className={className} data-cursor="expand" {...buttonProps}>
      {children}
    </button>
  )
}

export const GlassCard = ({ children, className, ...divProps }: BasicDivProps) => {
  const ref = useGlassShimmer()
  return (
    <div ref={ref} className={`glass-shimmer ${className ?? ''}`} {...divProps}>
      {children}
    </div>
  )
}

type LiquidButtonProps<C extends ElementType = 'button'> = PolymorphicProps<
  C,
  {
    children: ReactNode
    className?: string
  }
>

export const LiquidButton = <C extends ElementType = 'button'>({
  as,
  children,
  className,
  ...props
}: LiquidButtonProps<C>) => {
  const Component = (as ?? 'button') as ElementType
  const isNativeButton = as === undefined || as === 'button'
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return
    const el = ref.current

    const onMouseDown = () => {
      gsap.to(el, { scale: 0.98, duration: 0.1, ease: 'power1.out' })
    }

    const onMouseUp = () => {
      gsap.to(el, {
        scale: 1.05,
        duration: 0.15,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(el, {
            scale: 1,
            duration: 0.4,
            ease: 'elastic.out(1, 0.3)',
            onComplete: () => { gsap.set(el, { clearProps: 'transform' }) },
          })
        },
      })
    }

    const onMouseMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--x', `${event.clientX - rect.left}px`)
      el.style.setProperty('--y', `${event.clientY - rect.top}px`)
    }

    const onClickRipple = (event: MouseEvent) => {
      if (isDisableableElement(el) && el.disabled) return

      const rect = el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const ripple = document.createElement('div')
      ripple.style.position = 'absolute'
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`
      ripple.style.width = '0px'
      ripple.style.height = '0px'
      ripple.style.borderRadius = '50%'
      ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.4)'
      ripple.style.transform = 'translate(-50%, -50%)'
      ripple.style.pointerEvents = 'none'
      ripple.style.zIndex = '1'

      el.appendChild(ripple)
      const size = Math.max(rect.width, rect.height) * 2.5

      gsap.to(ripple, {
        width: size,
        height: size,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => {
          if (el.contains(ripple)) el.removeChild(ripple)
        },
      })
    }

    const ctx = gsap.context(() => {
      el.addEventListener('mousedown', onMouseDown)
      el.addEventListener('mouseup', onMouseUp)
      el.addEventListener('mousemove', onMouseMove)
      el.addEventListener('click', onClickRipple)
    }, ref)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('click', onClickRipple)
      ctx.revert()
    }
  }, [])

  return (
    <Component
      ref={ref as unknown as never}
      className={`liquid-button ${className ?? ''}`}
      {...(isNativeButton ? { type: 'button' } : {})}
      {...props}
    >
      <span className="liquid-content">{children}</span>
    </Component>
  )
}

type VolumetricInputProps<C extends ElementType = 'input'> = PolymorphicProps<
  C,
  {
    children?: ReactNode
    className?: string
  }
>

export const VolumetricInput = <C extends ElementType = 'input'>({
  as,
  className,
  children,
  ...props
}: VolumetricInputProps<C>) => {
  const Component = (as ?? 'input') as ElementType
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current

    const updateGlow = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY)

      if (distance < 150) {
        el.style.setProperty('--glow-x', `${event.clientX - rect.left}px`)
        el.style.setProperty('--glow-y', `${event.clientY - rect.top}px`)
        el.style.setProperty('--glow-opacity', `${1 - Math.min(distance / 150, 1)}`)
      } else {
        el.style.setProperty('--glow-opacity', '0')
      }
    }

    window.addEventListener('mousemove', updateGlow)
    return () => window.removeEventListener('mousemove', updateGlow)
  }, [])

  return (
    <Component
      ref={ref as unknown as never}
      className={`volumetric-input ${className ?? ''}`}
      {...props}
    >
      {children}
    </Component>
  )
}
