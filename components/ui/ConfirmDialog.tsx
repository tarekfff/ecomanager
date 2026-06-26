'use client'

import Modal from './Modal'
import Button from './Button'
import { colors, fonts } from '@/lib/tokens'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p style={{
        fontSize: 13,
        color: colors.textMd,
        fontFamily: fonts.sans,
        margin: '0 0 20px',
        lineHeight: 1.5,
      }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
