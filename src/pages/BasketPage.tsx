import { ArrowRight } from 'lucide-react'
import { tk } from '../i18n/tk'
import { PageSkeleton } from '../components/PageSkeleton'

export function BasketPage({ loading, isSignedIn, onOpenProfile }: {
  loading: boolean
  isSignedIn: boolean
  onOpenProfile: () => void
}) {
  if (!loading && !isSignedIn) {
    return (
      <section className="mt-8 border-l-4 border-emerald-800 py-2 pl-4">
        <h2 className="text-lg font-semibold text-stone-900">{tk.basketAuth.title}</h2>
        <p className="mt-1 text-sm text-stone-600">{tk.basketAuth.description}</p>
        <button
          type="button"
          onClick={onOpenProfile}
          className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-900"
        >
          {tk.basketAuth.goToProfile}
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </section>
    )
  }
  return <PageSkeleton />
}
