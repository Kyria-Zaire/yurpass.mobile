import { create } from 'zustand'
import type { EventForHost } from '@yurpass/types'

interface EventStore {
  events: EventForHost[]
  currentEvent: EventForHost | null
  setEvents: (events: EventForHost[]) => void
  setCurrentEvent: (event: EventForHost | null) => void
  updateEventInList: (eventId: string, partial: Partial<EventForHost>) => void
  clear: () => void
}

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  currentEvent: null,

  setEvents: (events) => set({ events }),

  setCurrentEvent: (event) => set({ currentEvent: event }),

  updateEventInList: (eventId, partial) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.publicId === eventId ? { ...e, ...partial } : e,
      ),
      currentEvent:
        state.currentEvent?.publicId === eventId
          ? { ...state.currentEvent, ...partial }
          : state.currentEvent,
    })),

  clear: () => set({ events: [], currentEvent: null }),
}))
