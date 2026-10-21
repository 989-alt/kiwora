import approvedJson from '../../assets/approved.json'
import type { SpeciesId } from './species'

/** Species whose picture set the teacher has signed off (assets/approved.json). */
export function isApproved(id: SpeciesId, table: Partial<Record<string, boolean>> = approvedJson): boolean {
  return table[id] === true
}
