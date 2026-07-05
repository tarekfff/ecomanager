'use client'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { PageHeader, Button } from '@/components/ui'
import ProductForm, { type ProductPayload } from '@/components/products/ProductForm'

export default function NewProductPage() {
  const { t } = useTranslation('products')
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
    if (!res.ok) return { error: data.error ?? t('newProduct.createError'), field: data.field }
    router.push('/dashboard/products')
    return {}
  }

  return (
    <>
      <PageHeader
        title={t('newProduct.title')}
        subtitle={t('newProduct.subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/products')}>
            {t('newProduct.backToList')}
          </Button>
        }
      />
      <ProductForm onSubmit={handleSubmit} submitLabel={t('newProduct.submitLabel')} />
    </>
  )
}
