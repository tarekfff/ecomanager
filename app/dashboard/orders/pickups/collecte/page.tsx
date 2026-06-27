import PickupsPage from '../PickupsPage'

export default function CollectePage() {
  return (
    <PickupsPage config={{
      status:       'collecte',
      title:        'Collecté',
      subtitle:     'Pickups collectés, en attente de réception',
      emptyText:    'Aucun pickup collecté en attente',
      dateField:    'collected_at',
      primaryAction: { label: 'Valider réception', action: 'validate_reception' },
      showGoBack:   true,
    }} />
  )
}
