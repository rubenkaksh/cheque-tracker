import type { ReactNode } from 'react'
import { Drawer, Grid, Modal } from 'antd'

/** Modal from the md breakpoint up, bottom Drawer below it (same pattern as the New cheque form). */
export default function Popup({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const screens = Grid.useBreakpoint()
  return screens.md ? (
    <Modal title={title} open={open} onCancel={onClose} footer={null} destroyOnHidden>
      {children}
    </Modal>
  ) : (
    <Drawer title={title} open={open} onClose={onClose} size="large" placement="bottom" destroyOnHidden>
      {children}
    </Drawer>
  )
}
