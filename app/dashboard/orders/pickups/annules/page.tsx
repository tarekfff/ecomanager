'use client'
import { useTranslation } from 'react-i18next'
import PickupsPage from '../PickupsPage'

export default function AnnulesPage() {
  const { t } = useTranslation('orders')
  return (
    <PickupsPage config={{
      status:    'annule',
      title:     t('pickups.annules.title'),
      subtitle:  t('pickups.annules.subtitle'),
      emptyText: t('pickups.annules.empty'),
      dateField: 'cancelled_at',
      showGoBack: true,
    }} />
  )
}
