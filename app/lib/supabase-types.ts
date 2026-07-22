export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ConversationRow = {
  id: string;
  created_at: string;
  title: string | null;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  created_at: string;
  conversation_id: string;
  role: string;
  content: string;
};

export type UserProfileRow = {
  id: string;
  created_at: string;
  name: string | null;
  preferences: Json;
};

/** Fragment bazy wiedzy (RAG) — embedding jako number[] lub string z PostgREST. */
export type DocumentRow = {
  id: string;
  created_at: string;
  title: string | null;
  content: string | null;
  embedding?: number[] | string | null;
  metadata: Json;
};

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: ConversationRow;
        Insert: {
          id?: string;
          created_at?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string | null;
          updated_at?: string;
        };
      };
      messages: {
        Row: MessageRow;
        Insert: {
          id?: string;
          created_at?: string;
          conversation_id: string;
          role: string;
          content: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          conversation_id?: string;
          role?: string;
          content?: string;
        };
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: {
          id?: string;
          created_at?: string;
          name?: string | null;
          preferences?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string | null;
          preferences?: Json;
        };
      };
      documents: {
        Row: DocumentRow;
        Insert: {
          id?: string;
          created_at?: string;
          title?: string | null;
          content?: string | null;
          embedding?: number[] | string | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string | null;
          content?: string | null;
          embedding?: number[] | string | null;
          metadata?: Json;
        };
      };
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[] | string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          title: string | null;
          content: string | null;
          metadata: Json;
          similarity: number;
        }[];
      };
    };
  };
};
