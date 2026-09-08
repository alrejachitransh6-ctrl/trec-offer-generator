/**
 * Supabase database types.
 *
 * Hand-maintained for now (migrations are applied via the dashboard SQL editor,
 * not the CLI). When the CLI is set up, regenerate with:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          buyer_name_info: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          buyer_name_info?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          buyer_name_info?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          property_address: string;
          county_id: string;
          legal_description: Json;
          defaults: Json;
          terms: Json;
          override_note: string;
          overrides: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: string;
          property_address: string;
          county_id: string;
          legal_description: Json;
          defaults?: Json;
          terms?: Json;
          override_note?: string;
          overrides?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: string;
          property_address?: string;
          county_id?: string;
          legal_description?: Json;
          defaults?: Json;
          terms?: Json;
          override_note?: string;
          overrides?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
