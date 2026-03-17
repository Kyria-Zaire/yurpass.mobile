import { apiFetch } from './auth.service'
import type { MyTicketResponse } from '@yurpass/types'

// ─── My Ticket ───────────────────────────────────────────

export async function getMyTicket(
  participationId: string,
): Promise<{ success: boolean; data: MyTicketResponse }> {
  return apiFetch(`/me/participations/${participationId}`)
}
