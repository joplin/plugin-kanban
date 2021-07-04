import { findAllChildrenNotebook, NoteData, SearchFilter } from './noteData'

type Predicate = (note: NoteData) => boolean

type CustomFilterFactory = (criteria: string) => Promise<Predicate>

const customFilters: { [n: string]: CustomFilterFactory } = {
  async notebookid(id: string) {
    const ids = [id, ...(await findAllChildrenNotebook(id))]

    return (note: NoteData) => ids.includes(note.notebookId)
  }
}

const neg = (pred: Predicate) => (n: NoteData) => !pred(n)

const quoteBuiltinFilter = (crit: string) => crit.includes(' ') ? `"${crit}"` : crit

export default async function(filters: SearchFilter[]): Promise<[string, Predicate]> {
  const predicates: Predicate[] = []
  let builtinFilters: string[] = [];

  for (const f of filters) {
    if (f.name in customFilters) {
      const pred = await customFilters[f.name](f.criteria)
      if (f.negated) predicates.push(neg(pred))
      else predicates.push(pred)
    }
    else builtinFilters.push(`${f.negated ? "-" : ""}${f.name}:${quoteBuiltinFilter(f.criteria)}`)
  }

  const combinedPred: Predicate = (note) => predicates.every(p => p(note))
  const combinedBuiltinFilters = builtinFilters.join(' ')

  return [combinedBuiltinFilters, combinedPred]
}
