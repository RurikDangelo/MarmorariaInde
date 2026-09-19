import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'

/** Exportação CSV dos relatórios. A RLS continua valendo em cada consulta. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (!user.permissions.has('reports.read')) {
    return NextResponse.json({ error: 'Sem permissão para exportar relatórios' }, { status: 403 })
  }

  const supabase = await createClient()
  let rows: Record<string, unknown>[] = []
  let filename = `relatorio-${tipo}`

  switch (tipo) {
    case 'ordens-de-servico': {
      const { data } = await supabase
        .from('work_orders')
        .select(
          `number, title, status_code, priority, deadline, total_value, received_value, pending_value,
           created_at, finished_at, customer:customers!work_orders_customer_id_fkey ( name )`,
        )
        .order('created_at', { ascending: false })
        .limit(5000)

      rows = (data ?? []).map((row: Record<string, unknown>) => ({
        numero: row.number,
        cliente: (row.customer as { name?: string } | null)?.name ?? '',
        servico: row.title ?? '',
        etapa: row.status_code,
        prioridade: row.priority,
        prazo: row.deadline ?? '',
        valor_total: row.total_value,
        valor_recebido: row.received_value,
        valor_pendente: row.pending_value,
        criada_em: row.created_at,
        finalizada_em: row.finished_at ?? '',
      }))
      filename = 'ordens-de-servico'
      break
    }

    case 'estoque': {
      const { data } = await supabase
        .from('stock_items')
        .select(
          `code, kind, status, length_mm, width_mm, thickness_mm, area_m2, quantity, unit, unit_cost, batch, supplier,
           material:materials!stock_items_material_id_fkey ( name ),
           location:stock_locations!stock_items_location_id_fkey ( name )`,
        )
        .limit(5000)

      rows = (data ?? []).map((row: Record<string, unknown>) => ({
        codigo: row.code ?? '',
        tipo: row.kind,
        material: (row.material as { name?: string } | null)?.name ?? '',
        situacao: row.status,
        comprimento_mm: row.length_mm ?? '',
        largura_mm: row.width_mm ?? '',
        espessura_mm: row.thickness_mm ?? '',
        area_m2: row.area_m2 ?? '',
        quantidade: row.quantity,
        unidade: row.unit,
        custo: row.unit_cost ?? '',
        lote: row.batch ?? '',
        fornecedor: row.supplier ?? '',
        local: (row.location as { name?: string } | null)?.name ?? '',
      }))
      filename = 'estoque'
      break
    }

    case 'desperdicio': {
      const { data } = await supabase
        .from('stock_movements')
        .select(
          `created_at, movement_type, loss_reason, area_m2, total_cost, notes,
           material:materials!stock_movements_material_id_fkey ( name ),
           work_order:work_orders!stock_movements_work_order_id_fkey ( number )`,
        )
        .in('movement_type', ['PERDA', 'DESCARTE'])
        .order('created_at', { ascending: false })
        .limit(5000)

      rows = (data ?? []).map((row: Record<string, unknown>) => ({
        data: row.created_at,
        tipo: row.movement_type,
        motivo: row.loss_reason ?? '',
        material: (row.material as { name?: string } | null)?.name ?? '',
        os: (row.work_order as { number?: string } | null)?.number ?? '',
        area_m2: row.area_m2 ?? '',
        custo: row.total_cost ?? '',
        observacao: row.notes ?? '',
      }))
      filename = 'desperdicio'
      break
    }

    case 'financeiro': {
      if (!user.permissions.has('financial.read')) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
      const { data } = await supabase
        .from('financial_transactions')
        .select(
          `description, kind, amount, due_date, paid_at, status, payment_method,
           category:financial_categories!financial_transactions_category_id_fkey ( name ),
           work_order:work_orders!financial_transactions_work_order_id_fkey ( number )`,
        )
        .order('due_date', { ascending: false })
        .limit(5000)

      rows = (data ?? []).map((row: Record<string, unknown>) => ({
        descricao: row.description,
        tipo: row.kind,
        categoria: (row.category as { name?: string } | null)?.name ?? '',
        os: (row.work_order as { number?: string } | null)?.number ?? '',
        valor: row.amount,
        vencimento: row.due_date,
        pagamento: row.paid_at ?? '',
        situacao: row.status,
        forma: row.payment_method ?? '',
      }))
      filename = 'financeiro'
      break
    }

    case 'producao': {
      const { data } = await supabase
        .from('production_records')
        .select(
          `step_code, status, started_at, finished_at, duration_minutes, is_rework, rework_reason,
           responsible:profiles!production_records_responsible_id_fkey ( full_name ),
           work_order:work_orders!production_records_work_order_id_fkey ( number )`,
        )
        .order('created_at', { ascending: false })
        .limit(5000)

      rows = (data ?? []).map((row: Record<string, unknown>) => ({
        os: (row.work_order as { number?: string } | null)?.number ?? '',
        etapa: row.step_code,
        responsavel: (row.responsible as { full_name?: string } | null)?.full_name ?? '',
        situacao: row.status,
        inicio: row.started_at ?? '',
        termino: row.finished_at ?? '',
        duracao_min: row.duration_minutes ?? '',
        retrabalho: row.is_rework ? 'sim' : 'nao',
        motivo_retrabalho: row.rework_reason ?? '',
      }))
      filename = 'producao'
      break
    }

    case 'clientes': {
      if (!user.permissions.has('customers.read')) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
      const { data } = await supabase
        .from('customers')
        .select('name, document, person_type, phone, whatsapp, email, city, state, district, address, active')
        .order('name')
        .limit(5000)

      rows = (data ?? []) as Record<string, unknown>[]
      filename = 'clientes'
      break
    }

    default:
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  const csv = toCsv(rows)
  const today = new Date().toISOString().slice(0, 10)

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return 'sem dados'
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(';')),
  ].join('\n')
}
