'use client'
import { useTranslation } from 'react-i18next'
import PickupsPage from '../PickupsPage'

export default function TraitesPage() {
  const { t } = useTranslation('orders')
  return (
    <PickupsPage config={{
      status:    'traite',
      title:     t('pickups.traites.title'),
      subtitle:  t('pickups.traites.subtitle'),
      emptyText: t('pickups.traites.empty'),
      dateField: 'processed_at',
      showGoBack: true,
    }} />
  )
}
