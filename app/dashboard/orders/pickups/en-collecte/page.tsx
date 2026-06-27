import PickupsPage from '../PickupsPage'

export default function EnCollectePage() {
  return (
    <PickupsPage config={{
      status:       'en_collecte',
      title:        'En collecte',
      subtitle:     'Pickups en attente de collecte par le livreur',
      emptyText:    'Aucun pickup en attente de collecte',
      dateField:    'created_at',
      primaryAction: { label: 'Valider collecte', action: 'validate_collect' },
      showCancel:   true,
    }} />
  )
}
