import { PageContainer } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Esqueleto com a mesma grade do dashboard real: quatro cartões por faixa,
 * gráfico 2/3 + lista 1/3. Quando o conteúdo chega, nada salta de lugar.
 *
 * Só aparece na primeira abertura da tela. Trocar o período não passa por aqui
 * — a mudança acontece dentro de uma transição e a tela atual continua no
 * lugar (ver useUrlFilters em components/shared/filters.tsx).
 */
function CardRowSkeleton() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="flex items-start gap-3 p-4">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-6 w-28" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        </Card>
      ))}
    </section>
  )
}

export default function DashboardLoading() {
  return (
    <PageContainer size="wide">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-full sm:w-44" />
      </div>

      <CardRowSkeleton />
      <CardRowSkeleton />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-52" />
            <Skeleton className="mt-1.5 h-3 w-64" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
            </div>
            {/* silhueta de barras: dá a forma do gráfico sem fingir dados */}
            <div className="flex h-[230px] items-end gap-3 px-2">
              {[52, 74, 38, 88, 61, 46].map((height, index) => (
                <div key={index} className="flex flex-1 items-end justify-center gap-1">
                  <Skeleton className="w-full max-w-[26px] rounded-b-none" style={{ height: `${height}%` }} />
                  <Skeleton
                    className="w-full max-w-[26px] rounded-b-none"
                    style={{ height: `${Math.max(18, height - 22)}%` }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-44" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-3 w-28 shrink-0" />
                <Skeleton className="h-2.5 flex-1 rounded-full" />
                <Skeleton className="h-3 w-6 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="mt-1.5 h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="hidden h-4 w-20 sm:block" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-2.5">
                <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1.5 h-3 w-52" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
