import PickupsPage from '../PickupsPage'

export default function RecusPage() {
  return (
    <PickupsPage config={{
      status:       'recu',
      title:        'Reçus',
      subtitle:     'Pickups reçus, en attente de traitement',
      emptyText:    'Aucun pickup reçu en attente',
      dateField:    'received_at',
      primaryAction: { label: 'Valider traitement', action: 'validate_processing' },
      showGoBack:   true,
    }} />
  )
}
