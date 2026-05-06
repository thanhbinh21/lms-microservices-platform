"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type PopoverAlign = "start" | "center" | "end"
type PopoverSide = "top" | "right" | "bottom" | "left"

type PopoverContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  anchorRef: React.RefObject<HTMLElement | null>
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverContext() {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("Popover components must be used within Popover")
  return ctx
}

type PopoverProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Popover({ open: openProp, defaultOpen = false, onOpenChange, children }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange],
  )

  const triggerRef = React.useRef<HTMLElement | null>(null)
  const anchorRef = React.useRef<HTMLElement | null>(null)

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, anchorRef }}>
      {children}
    </PopoverContext.Provider>
  )
}

type PopoverTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
}

function PopoverTrigger({ asChild = false, children, onClick, ...props }: PopoverTriggerProps) {
  const { open, setOpen, triggerRef } = usePopoverContext()

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented) setOpen(!open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node
      },
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        ;(children as React.ReactElement<any>).props.onClick?.(event)
        handleClick(event)
      },
      "aria-expanded": open,
      "aria-haspopup": "dialog",
    })
  }

  return (
    <button
      type="button"
      ref={(node) => {
        triggerRef.current = node
      }}
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      {...props}
    >
      {children}
    </button>
  )
}

const PopoverAnchor = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => {
    const { anchorRef } = usePopoverContext()
    return (
      <div
        ref={(node) => {
          anchorRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        {...props}
      >
        {children}
      </div>
    )
  },
)
PopoverAnchor.displayName = "PopoverAnchor"

type PopoverContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: PopoverAlign
  side?: PopoverSide
  sideOffset?: number
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", side = "bottom", sideOffset = 4, style, ...props }, ref) => {
    const { open, setOpen, triggerRef, anchorRef } = usePopoverContext()
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const [mounted, setMounted] = React.useState(false)
    const [position, setPosition] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 })

    React.useEffect(() => setMounted(true), [])

    React.useEffect(() => {
      if (!open) return
      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (contentRef.current?.contains(target)) return
        if (triggerRef.current?.contains(target)) return
        setOpen(false)
      }
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false)
      }
      document.addEventListener("mousedown", handlePointerDown)
      document.addEventListener("keydown", handleEscape)
      return () => {
        document.removeEventListener("mousedown", handlePointerDown)
        document.removeEventListener("keydown", handleEscape)
      }
    }, [open, setOpen, triggerRef])

    React.useLayoutEffect(() => {
      if (!open) return
      const target = anchorRef.current ?? triggerRef.current
      const content = contentRef.current
      if (!target || !content) return

      const rect = target.getBoundingClientRect()
      const contentRect = content.getBoundingClientRect()

      let top = rect.bottom + sideOffset
      let left = rect.left + rect.width / 2 - contentRect.width / 2

      if (side === "top") top = rect.top - contentRect.height - sideOffset
      if (side === "left") {
        top = rect.top + rect.height / 2 - contentRect.height / 2
        left = rect.left - contentRect.width - sideOffset
      }
      if (side === "right") {
        top = rect.top + rect.height / 2 - contentRect.height / 2
        left = rect.right + sideOffset
      }

      if (align === "start") left = rect.left
      if (align === "end") left = rect.right - contentRect.width

      setPosition({
        top: Math.max(8, top),
        left: Math.max(8, left),
      })
    }, [open, align, side, sideOffset, triggerRef, anchorRef])

    if (!mounted || !open) return null

    return createPortal(
      <div
        ref={(node) => {
          contentRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          className,
        )}
        style={{ position: "fixed", top: position.top, left: position.left, ...style }}
        data-state={open ? "open" : "closed"}
        data-side={side}
        {...props}
      />,
      document.body,
    )
  },
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
