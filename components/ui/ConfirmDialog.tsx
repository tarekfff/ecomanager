'use client'

import { useTranslation } from 'react-i18next'
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
  confirmLabel,
  danger = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
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
          {t('actions.cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
          {confirmLabel ?? t('actions.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
