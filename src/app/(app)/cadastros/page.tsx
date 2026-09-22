import type { Metadata } from 'next'
import Link from 'next/link'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_KINDS } from '@/lib/labels'
import { ProductsManager } from '@/features/catalog/components/products-manager'
import { LookupListsManager } from '@/features/catalog/components/lookup-lists-manager'
import type { LookupOption, Product } from '@/types/database'

export const metadata: Metadata = { title: 'Cadastros' }

/**
 * Cadastros da montagem. Tudo aqui tambem pode ser cadastrado na hora, dentro
 * da tela da OS/orcamento; esta tela e para revisar precos e organizar.
 */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requirePermission('stock.read')
  const { aba } = await searchParams
  const canWrite = user.permissions.has('stock.write')
  const canWriteLists = canWrite || user.permissions.has('settings.write')
  const supabase = await createClient()

  const [{ data: products }, { data: lookups }] = await Promise.all([
    supabase.from('products').select('*').order('name').limit(5000).returns<Product[]>(),
    supabase.from('lookup_options').select('*').eq('active', true).order('sort_order').order('label').returns<LookupOption[]>(),
  ])

  return (
    <PageContainer>
      <PageHeader
        title="Cadastros"
        description={
          'Produtos, acabamentos, serviços, revendas, insumos e as listas rápidas da OS. Materiais (pedras) ficam em Estoque.'
        }
        actions={
          <Link href="/estoque" className="text-sm text-primary underline-offset-2 hover:underline">
            Ir para materiais
          </Link>
        }
      />

      <Tabs defaultValue={aba ?? 'PRODUTO'}>
        <TabsList>
          {PRODUCT_KINDS.map((kind) => (
            <TabsTrigger key={kind.value} value={kind.value}>
              {kind.plural}
            </TabsTrigger>
          ))}
          <TabsTrigger value="listas">Listas</TabsTrigger>
        </TabsList>
        {PRODUCT_KINDS.map((kind) => (
          <TabsContent key={kind.value} value={kind.value}>
            <ProductsManager
              kind={kind.value}
              products={(products ?? []).filter((product) => product.kind === kind.value)}
              canWrite={canWrite}
            />
          </TabsContent>
        ))}
        <TabsContent value="listas">
          <LookupListsManager options={lookups ?? []} canWrite={canWriteLists} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
