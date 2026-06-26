'use client'
import { useRouter } from 'next/navigation'
import { PageHeader, Button } from '@/components/ui'
import ProductForm, { type ProductPayload } from '@/components/products/ProductForm'

export default function NewProductPage() {
  const router = useRouter()

  async function handleSubmit(payload: ProductPayload) {
    const res  = await fetch('/api/products', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json() as { id?: string; error?: string; field?: string }
    if (!res.ok) return { error: data.error ?? 'Erreur lors de la création.', field: data.field }
    router.push('/dashboard/products')
    return {}
  }

  return (
    <>
      <PageHeader
        title="Nouveau produit"
        subtitle="Remplissez les informations ci-dessous pour créer un produit."
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/products')}>
            ← Retour à la liste
          </Button>
        }
      />
      <ProductForm onSubmit={handleSubmit} submitLabel="Créer le produit" />
    </>
  )
}
