import PickupsPage from '../PickupsPage'

export default function TraitesPage() {
  return (
    <PickupsPage config={{
      status:    'traite',
      title:     'Traités',
      subtitle:  'Pickups traités',
      emptyText: 'Aucun pickup traité',
      dateField: 'processed_at',
      showGoBack: true,
    }} />
  )
}
