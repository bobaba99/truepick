/* eslint-disable react-refresh/only-export-components */
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from 'react'

type GsapSetter = (value: number) => void
type GsapVars = Record<string, unknown>
type GsapContext = { revert: () => void }

type GsapApi = {
  quickTo: (target: object | null, property: string, vars: GsapVars) => GsapSetter
  set: (target: object | null, vars: GsapVars) => void
  to: (target: object | null, vars: GsapVars) => void
  fromTo: (target: object | null, fromVars: GsapVars, toVars: GsapVars) => void
  context: (callback: () => void, scope?: object | null) => GsapContext
  registerPlugin: (plugin: unknown) => void
}

declare global {
  interface Window {
    gsap?: GsapApi
    ScrollTrigger?: unknown
  }
}

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

export const useGSAPLoader = () => {
  const [loaded, setLoaded] = useState(
    () => Boolean(window.gsap && window.ScrollTrigger),
  )

  useEffect(() => {
    if (window.gsap && window.ScrollTrigger) {
      return
    }

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.body.appendChild(script)
      })

    void Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js'),
    ])
      .then(() => {
        setTimeout(() => {
          if (window.gsap && window.ScrollTrigger) {
            window.gsap.registerPlugin(window.ScrollTrigger)
            setLoaded(true)
          }
        }, 50)
      })
      .catch((error) => console.error('GSAP load failed', error))
  }, [])

  return loaded
}

export const useMagnetic = (strength = 0.35) => {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!window.gsap || !ref.current) return

    const el = ref.current
    const xTo = window.gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' })
    const yTo = window.gsap.quickTo(el, 'y', { duration: 1, ease: 'power3.out' })

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
    if (!window.gsap) return

    const dot = dotRef.current
    const ring = ringRef.current
    window.gsap.set(dot, { xPercent: -50, yPercent: -50 })
    window.gsap.set(ring, { xPercent: -50, yPercent: -50 })

    const xTo = window.gsap.quickTo(ring, 'x', { duration: 0.6, ease: 'power3' })
    const yTo = window.gsap.quickTo(ring, 'y', { duration: 0.6, ease: 'power3' })

    const onMouseMove = (event: MouseEvent) => {
      window.gsap?.set(dot, { x: event.clientX, y: event.clientY })
      xTo(event.clientX)
      yTo(event.clientY)
    }

    const onHoverStart = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-cursor="expand"]')) {
        window.gsap?.to(ring, { scale: 2, duration: 0.3 })
      }
    }

    const onHoverEnd = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-cursor="expand"]')) {
        window.gsap?.to(ring, { scale: 1, duration: 0.3 })
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
    if (!window.gsap || !window.ScrollTrigger || !ref.current) return

    const ctx = window.gsap.context(() => {
      const words = ref.current?.querySelectorAll('.word')
      window.gsap?.fromTo(
        words as unknown as object | null,
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
    if (!window.gsap || !ref.current) return
    const el = ref.current

    const onMouseDown = () => {
      window.gsap?.to(el, { scale: 0.98, duration: 0.1, ease: 'power1.out' })
    }

    const onMouseUp = () => {
      window.gsap?.to(el, {
        scale: 1.05,
        duration: 0.15,
        ease: 'power2.out',
        onComplete: () => {
          window.gsap?.to(el, {
            scale: 1,
            duration: 0.4,
            ease: 'elastic.out(1, 0.3)',
            onComplete: () => window.gsap?.set(el, { clearProps: 'transform' }),
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

      window.gsap?.to(ripple, {
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

    const ctx = window.gsap.context(() => {
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
    if (!window.gsap || !ref.current) return
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