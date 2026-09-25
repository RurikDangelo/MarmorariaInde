import { PageContainer } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Esqueleto com a mesma grade do dashboard real: cabeçalho, faixas de quatro
 * cartões com título de seção, gráfico 2/3 + lista 1/3. Quando o conteúdo
 * chega, nada salta de lugar.
 *
 * Só aparece na primeira abertura da tela. Trocar o período não passa por aqui
 * — a mudança acontece dentro de uma transição e a tela atual continua no
 * lugar (ver useUrlFilters em components/shared/filters.tsx).
 */
function KpiRowSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="mt-4 h-8 w-36" />
            <Skeleton className="mt-2.5 h-4 w-24" />
          </Card>
        ))}
      </div>
    </section>
  )
}

export default function DashboardLoading() {
  return (
    <PageContainer size="wide" className="gap-8 py-7 sm:py-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-full sm:w-44" />
        </div>
        <Skeleton className="h-3 w-64" />
      </header>

      <KpiRowSkeleton />
      <KpiRowSkeleton />

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="gap-1 px-6 pb-4 pt-6">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-1 h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-6 pb-6">
            <div className="flex gap-8">
              <div>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-6 w-32" />
              </div>
              <div>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-6 w-32" />
              </div>
            </div>
            {/* silhueta da curva: dá a forma sem fingir valores */}
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1 px-6 pb-3 pt-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-4 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-6 pb-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="px-6 pb-4 pt-6">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-4 pb-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[4.25rem] w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-6 pb-4 pt-6">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-4 pb-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>

      <KpiRowSkeleton />
    </PageContainer>
  )
}
