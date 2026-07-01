'use client'
import { useTranslation } from 'react-i18next'
import PickupsPage from '../PickupsPage'

export default function EnCollectePage() {
  const { t } = useTranslation('orders')
  return (
    <PickupsPage config={{
      status:       'en_collecte',
      title:        t('pickups.enCollecte.title'),
      subtitle:     t('pickups.enCollecte.subtitle'),
      emptyText:    t('pickups.enCollecte.empty'),
      dateField:    'created_at',
      primaryAction: { label: t('pickups.enCollecte.validate'), action: 'validate_collect' },
      showCancel:   true,
    }} />
  )
}
