import { paymentMethodLabel } from '@/lib/labels'
import { formatDate, formatNumber } from '@/lib/utils'
import type { CompanySettings, Customer, PaymentMethod } from '@/types/database'
import type { Composition } from '../../types'
import type { PrintOptions } from '../../print-options'
import { summarizeMaterials } from '../materials-summary'
import { PrintHeader } from './print-header'
import { PrintItem } from './print-item'

export interface PrintInstallment {
  number: number
  count: number
  dueDate: string
  amount: number
  method: PaymentMethod | null
}

const money = (value: number) => formatNumber(value, 2)

/** Folha A4 do orcamento/OS: por ambiente, produto e composicao — com o logo da marmoraria. */
export function DocumentPrint({
  settings,
  title,
  subtitle,
  customer,
  siteDetails,
  composition,
  options,
  totals,
  installments,
  info,
  notes,
  drawingUrls,
  signatures,
}: {
  settings: CompanySettings | null
  title: string
  subtitle?: string
  customer: Customer | null | undefined
  siteDetails?: string | null
  composition: Composition
  options: PrintOptions
  totals: { products: number; freight: number; surcharge: number; discount: number; total: number }
  installments: PrintInstallment[]
  info: { label: string; value: string | null | undefined }[]
  notes?: string | null
  drawingUrls: Record<string, string>
  signatures: [string, string]
}) {
  const valueColumns = Number(options.quantidade) + Number(options.valor_unitario) + Number(options.subtotal)
  const materials = summarizeMaterials(composition.items)

  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 text-[12px] text-black print:max-w-none print:p-0">
      <PrintHeader settings={settings} title={title} subtitle={subtitle} customer={customer} siteDetails={siteDetails} />

      {composition.environments.map((environment) => {
        const items = composition.items.filter((item) => item.environment_id === environment.id)
        if (!items.length) return null
        const environmentTotal = items.reduce((sum, item) => sum + Number(item.total), 0)
        return (
          <section key={environment.id} className="break-inside-avoid-page border-b border-black py-2">
            <h2 className="text-center text-base font-semibold">{environment.name}</h2>
            {environment.description && <p className="text-center text-[11px]">{environment.description}</p>}
            <table className="mt-1 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y border-black text-left">
                  <th className="w-14 py-1 font-semibold">Código</th>
                  <th className="py-1 font-semibold">Descrição</th>
                  <th className="w-14 py-1 text-center font-semibold">Unidade</th>
                  {options.quantidade && <th className="w-20 py-1 text-right font-semibold">QTD Total</th>}
                  {options.valor_unitario && <th className="w-24 py-1 text-right font-semibold">Valor Unitário</th>}
                  {options.subtotal && <th className="w-24 py-1 text-right font-semibold">SubTotal</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <PrintItem key={item.id} item={item} options={options} drawingUrl={drawingUrls[item.id]} />
                ))}
              </tbody>
              {options.valores && (
                <tfoot>
                  <tr className="border-t border-black font-semibold">
                    <td colSpan={3 + Math.max(0, valueColumns - 1)} className="py-1 text-right">
                      Total do ambiente
                    </td>
                    <td className="py-1 text-right tabular">{money(environmentTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>
        )
      })}

      {options.total_material && materials.length > 0 && (
        <section className="break-inside-avoid border-b border-black py-2">
          <h2 className="text-xs font-bold uppercase">Total de material</h2>
          <table className="mt-1 w-full text-[11px]">
            <tbody>
              {materials.map((row) => (
                <tr key={row.key}>
                  <td className="w-14 tabular">{row.code ?? ''}</td>
                  <td>{row.description}{row.thicknessMm ? ` ${row.thicknessMm} mm` : ''}</td>
                  <td className="w-28 text-right tabular">{formatNumber(row.areaWithWaste, 4)} m²</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="grid break-inside-avoid grid-cols-2 gap-6 py-3">
        <div className="flex flex-col gap-0.5 text-[11px]">
          {info
            .filter((row) => row.value)
            .map((row) => (
              <p key={row.label}>
                <span className="font-semibold">{row.label}: </span>
                {row.value}
              </p>
            ))}
          {installments.length > 0 && (
            <table className="mt-2 w-full text-[11px]">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="font-semibold">Título</th>
                  <th className="font-semibold">Vencimento</th>
                  <th className="font-semibold">Espécie</th>
                  {options.valores && <th className="text-right font-semibold">Valor</th>}
                </tr>
              </thead>
              <tbody>
                {installments.map((row) => (
                  <tr key={row.number}>
                    <td className="tabular">{row.number}/{row.count}</td>
                    <td className="tabular">{formatDate(`${row.dueDate}T12:00:00`)}</td>
                    <td>{paymentMethodLabel(row.method)}</td>
                    {options.valores && <td className="text-right tabular">{money(row.amount)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {options.valores && (
          <table className="self-start text-[12px]">
            <tbody>
              {(
                [
                  ['Total dos Produtos', totals.products],
                  ['Frete', totals.freight],
                  ['Outras Despesas', totals.surcharge],
                  ['Desconto (R$)', -totals.discount],
                ] as const
              ).map(([label, value]) => (
                <tr key={label}>
                  <td className="py-0.5 pr-4 text-right">{label}</td>
                  <td className="py-0.5 text-right tabular">{money(value)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-black text-sm font-bold">
                <td className="py-1 pr-4 text-right">Total</td>
                <td className="py-1 text-right tabular">R$ {money(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {notes && (
        <section className="break-inside-avoid border-t border-black py-2 text-[11px]">
          <p className="font-semibold">Observações</p>
          <p className="whitespace-pre-line">{notes}</p>
        </section>
      )}

      <section className="mt-12 grid break-inside-avoid grid-cols-2 gap-10 text-center text-[11px]">
        <div className="border-t border-black pt-1">{signatures[0]}</div>
        <div className="border-t border-black pt-1">{signatures[1]}</div>
      </section>
    </article>
  )
}
