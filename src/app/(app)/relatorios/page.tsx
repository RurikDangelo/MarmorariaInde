import type { Metadata } from 'next'
import {
  Banknote,
  ClipboardList,
  Download,
  Hammer,
  Layers,
  TrendingDown,
  Users,
} from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Relatórios' }

const REPORTS = [
  {
    slug: 'ordens-de-servico',
    title: 'Ordens de serviço',
    description: 'Todas as OS com cliente, etapa, prazo e valores.',
    icon: ClipboardList,
    permission: 'work_orders.read',
  },
  {
    slug: 'producao',
    title: 'Produção',
    description: 'Apontamentos por etapa, responsável, duração e retrabalho.',
    icon: Hammer,
    permission: 'production.read',
  },
  {
    slug: 'estoque',
    title: 'Estoque',
    description: 'Chapas, retalhos e insumos com medidas, custo e situação.',
    icon: Layers,
    permission: 'stock.read',
  },
  {
    slug: 'desperdicio',
    title: 'Desperdício',
    description: 'Perdas e descartes com motivo, área e custo.',
    icon: TrendingDown,
    permission: 'stock.read',
  },
  {
    slug: 'financeiro',
    title: 'Financeiro',
    description: 'Contas a pagar e a receber com vencimento e situação.',
    icon: Banknote,
    permission: 'financial.read',
  },
  {
    slug: 'clientes',
    title: 'Clientes',
    description: 'Cadastro completo para contato e conferência.',
    icon: Users,
    permission: 'customers.read',
  },
] as const

export default async function ReportsPage() {
  const user = await requirePermission('reports.read')

  const available = REPORTS.filter((report) => user.permissions.has(report.permission))

  return (
    <PageContainer>
      <PageHeader
        title="Relatórios"
        description="Exportações em CSV (separador ponto e vírgula) prontas para abrir no Excel."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.slug}>
              <CardContent className="flex h-full flex-col gap-3 pt-5">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p>
                </div>
                <Button variant="outline" size="sm" asChild className="self-start">
                  <a href={`/api/relatorios/${report.slug}`} download>
                    <Download />
                    Exportar CSV
                  </a>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Os relatórios respeitam suas permissões: você só exporta o que já pode ver no sistema.
      </p>
    </PageContainer>
  )
}
