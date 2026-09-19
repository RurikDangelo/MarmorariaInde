import { PageContainer } from '@/components/shared/page-header'
import { CardsSkeleton, TableSkeleton } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageContainer size="wide">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <CardsSkeleton />
      <TableSkeleton />
    </PageContainer>
  )
}
