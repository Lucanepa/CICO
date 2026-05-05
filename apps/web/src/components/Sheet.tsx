import type { ReactNode } from 'react'
import {
  Sheet as ShadSheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

// Backwards-compatible wrapper around the new shadcn-based bottom sheet so
// existing AddFoodSheet / LogBodySheet (which import this file) get the new
// styling for free, without changing their call sites.
export function Sheet({ open, onClose, title, children }: Props) {
  return (
    <ShadSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="center">
        {title && (
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
        )}
        {children}
      </SheetContent>
    </ShadSheet>
  )
}
