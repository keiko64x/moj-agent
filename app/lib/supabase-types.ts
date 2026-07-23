export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ConversationRow = {
  id: string;
  created_at: string;
  title: string | null;
  updated_at: string;
  user_id: string | null;
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
  user_id?: string | null;
};

type EmptyRelationships = [];

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
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: EmptyRelationships;
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
        Relationships: EmptyRelationships;
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
        Relationships: EmptyRelationships;
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
          user_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string | null;
          content?: string | null;
          embedding?: number[] | string | null;
          metadata?: Json;
          user_id?: string | null;
        };
        Relationships: EmptyRelationships;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[] | string;
          match_threshold?: number;
          match_count?: number;
          filter_user_id?: string | null;
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
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
