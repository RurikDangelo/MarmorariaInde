import type { Metadata } from 'next'
import Link from 'next/link'
import { List, Plus } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { ClearFiltersButton, FilterBar, FilterSelect, SearchInput } from '@/components/shared/filters'
import { Button } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'
import { getAssignableUsers, getKanbanData } from '@/features/work-orders/queries'
import { KanbanBoard } from '@/features/work-orders/components/kanban-board'

export const metadata: Metadata = { title: 'Kanban de OS' }

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('work_orders.read')
  const params = await searchParams

  const [columns, users] = await Promise.all([
    getKanbanData({
      busca: params.busca,
      prioridade: params.prioridade,
      responsavel: params.responsavel,
    }),
    getAssignableUsers(),
  ])

  return (
    <PageContainer size="full">
      <PageHeader
        title="Kanban da produção"
        description="Arraste a OS para mover de etapa. Cada movimento fica registrado na timeline."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/os">
                <List />
                Lista
              </Link>
            </Button>
            {user.permissions.has('work_orders.write') && (
              <Button asChild>
                <Link href="/os/nova">
                  <Plus />
                  Nova OS
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput placeholder="Buscar OS…" />
        <FilterSelect
          paramName="prioridade"
          label="Prioridade"
          allLabel="Todas"
          options={[
            { value: 'URGENTE', label: 'Urgente' },
            { value: 'ALTA', label: 'Alta' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'BAIXA', label: 'Baixa' },
          ]}
        />
        <FilterSelect
          paramName="responsavel"
          label="Responsável"
          allLabel="Todos"
          options={users.map((item) => ({ value: item.id, label: item.full_name }))}
        />
        <ClearFiltersButton keys={['busca', 'prioridade', 'responsavel']} />
      </FilterBar>

      <KanbanBoard columns={columns} canMove={user.permissions.has('work_orders.status')} />
    </PageContainer>
  )
}
