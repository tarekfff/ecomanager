'use client'
import { useTranslation } from 'react-i18next'
import PickupsPage from '../PickupsPage'

export default function CollectePage() {
  const { t } = useTranslation('orders')
  return (
    <PickupsPage config={{
      status:       'collecte',
      title:        t('pickups.collecte.title'),
      subtitle:     t('pickups.collecte.subtitle'),
      emptyText:    t('pickups.collecte.empty'),
      dateField:    'collected_at',
      primaryAction: { label: t('pickups.collecte.validate'), action: 'validate_reception' },
      showGoBack:   true,
    }} />
  )
}
