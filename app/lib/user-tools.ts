import { tool } from 'ai';
import { z } from 'zod';
import type { DbClient } from '@/app/lib/db-client';
import { updateUserName, updateUserPreference } from '@/app/lib/user-profile';

/** Narzędzia pamięci użytkownika — userId = auth.uid(); client z JWT dla RLS. */
export function createUserMemoryTools(userId: string, client?: DbClient | null) {
  return {
    saveUserName: tool({
      description:
        'Zapisuje imię użytkownika w profilu (Supabase). Wywołaj, gdy użytkownik poda jak się nazywa (np. „Mam na imię Paweł”, „Jestem Anna”). Podaj TYLKO samo imię.',
      inputSchema: z.object({
        name: z.string().min(1).describe('Samo imię, np. Paweł (bez „mam na imię”)'),
      }),
      execute: async ({ name }) => {
        if (!userId) {
          return {
            ok: false,
            error: 'Brak user_id — użytkownik musi być zalogowany',
          };
        }
        try {
          const profile = await updateUserName(userId, name, client);
          if (!profile?.name) {
            return {
              ok: false,
              error:
                'Nie udało się zapisać imienia w bazie (uprawnienia/RLS/JWT). Sprawdź supabase/auth-rls.sql i sesję logowania.',
            };
          }
          return { ok: true, name: profile.name };
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Nieznany błąd zapisu imienia';
          return { ok: false, error: message };
        }
      },
    }),
    saveUserPreference: tool({
      description:
        'Zapisuje preferencję w profilu. Dla jedzenia podawaj TYLKO nazwę dania (np. "pizza", "sushi", "pierogi") — NIGDY całych zdań, komend ani komentarzy.',
      inputSchema: z.object({
        key: z
          .enum(['miasto', 'ulubione_jedzenie', 'hobby'])
          .describe('Klucz: miasto | ulubione_jedzenie | hobby'),
        value: z
          .string()
          .max(40)
          .describe('Krótka wartość: pizza / Szczecin / narty. Max ~2 słowa.'),
      }),
      execute: async ({ key, value }) => {
        if (!userId) return { ok: false, error: 'Brak user_id' };
        const profile = await updateUserPreference(userId, key, value, client);
        if (!profile) return { ok: false, error: 'Nie udało się zapisać preferencji' };
        const prefs =
          profile.preferences && typeof profile.preferences === 'object'
            ? (profile.preferences as Record<string, string>)
            : {};
        const saved = prefs[key];
        if (key === 'ulubione_jedzenie' && !saved) {
          return {
            ok: false,
            error: 'Odrzucono wartość — podaj samą nazwę dania, np. pizza',
          };
        }
        return { ok: true, key, value: saved ?? value, preferences: profile.preferences };
      },
    }),
  };
}
