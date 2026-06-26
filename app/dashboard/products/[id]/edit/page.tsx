'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader, Button } from '@/components/ui'
import ProductForm, { type ProductPayload } from '@/components/products/ProductForm'
import { colors, fonts } from '@/lib/tokens'

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

export default function EditProductPage() {
  const router          = useRouter()
  const { id }          = useParams() as { id: string }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [productData,   setProductData]   = useState<any>(null)
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)

  useEffect(() => {
    fetch(`/api/products/${id}`, { headers: authHeader() })
      .then(r => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => { if (data) setProductData(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(payload: ProductPayload) {
    const res  = await fetch(`/api/products/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body:    JSON.stringify(payload),
    })
    const data = await res.json() as { id?: string; error?: string; field?: string }
    if (!res.ok) return { error: data.error ?? 'Erreur lors de la mise à jour.', field: data.field }
    router.push('/dashboard/products')
    return {}
  }

  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textLt, fontFamily: fonts.sans, fontSize: 13,
      }}>
        Chargement…
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        fontFamily: fonts.sans,
      }}>
        <p style={{ fontSize: 14, color: colors.red }}>Produit introuvable.</p>
        <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/products')}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={productData?.name ?? 'Modifier le produit'}
        subtitle="Modifier les informations du produit."
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/products')}>
            ← Retour à la liste
          </Button>
        }
      />
      <ProductForm
        initialData={productData}
        onSubmit={handleSubmit}
        submitLabel="Enregistrer les modifications"
      />
    </>
  )
}
