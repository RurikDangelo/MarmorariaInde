import { redirect } from 'next/navigation'

/** A OS e editada na propria tela dela (tela unica). Links antigos continuam funcionando. */
export default async function EditWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/os/${id}`)
}
