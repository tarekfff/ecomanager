import PickupsPage from '../PickupsPage'

export default function AnnulesPage() {
  return (
    <PickupsPage config={{
      status:    'annule',
      title:     'Annulés',
      subtitle:  'Pickups annulés',
      emptyText: 'Aucun pickup annulé',
      dateField: 'cancelled_at',
      showGoBack: true,
    }} />
  )
}
