'use client'
import { useTranslation } from 'react-i18next'
import PickupsPage from '../PickupsPage'

export default function RecusPage() {
  const { t } = useTranslation('orders')
  return (
    <PickupsPage config={{
      status:       'recu',
      title:        t('pickups.recus.title'),
      subtitle:     t('pickups.recus.subtitle'),
      emptyText:    t('pickups.recus.empty'),
      dateField:    'received_at',
      primaryAction: { label: t('pickups.recus.validate'), action: 'validate_processing' },
      showGoBack:   true,
    }} />
  )
}
