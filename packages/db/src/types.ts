export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          lat: number | null
          line1: string
          line2: string | null
          lng: number | null
          property_type: string
          state: string
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          line1: string
          line2?: string | null
          lng?: number | null
          property_type?: string
          state?: string
          updated_at?: string
          user_id: string
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          line1?: string
          line2?: string | null
          lng?: number | null
          property_type?: string
          state?: string
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      appointment_events: {
        Row: {
          actor_id: string | null
          appointment_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["appointment_status"] | null
          id: string
          metadata: Json
          to_status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          metadata?: Json
          to_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          metadata?: Json
          to_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          created_at: string
          custom_note: string | null
          service_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          custom_note?: string | null
          service_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          custom_note?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          address_id: string
          auto_charge_consent: boolean
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          discount_cents: number
          id: string
          is_emergency: boolean
          job_notes: string | null
          job_total_cents: number | null
          promo_code: string | null
          scheduled_end: string
          scheduled_start: string
          service_call_fee_cents: number
          status: Database["public"]["Enums"]["appointment_status"]
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          address_id: string
          auto_charge_consent?: boolean
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          discount_cents?: number
          id?: string
          is_emergency?: boolean
          job_notes?: string | null
          job_total_cents?: number | null
          promo_code?: string | null
          scheduled_end: string
          scheduled_start: string
          service_call_fee_cents?: number
          status?: Database["public"]["Enums"]["appointment_status"]
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          address_id?: string
          auto_charge_consent?: boolean
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          discount_cents?: number
          id?: string
          is_emergency?: boolean
          job_notes?: string | null
          job_total_cents?: number | null
          promo_code?: string | null
          scheduled_end?: string
          scheduled_start?: string
          service_call_fee_cents?: number
          status?: Database["public"]["Enums"]["appointment_status"]
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_slots: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          opens_at: string | null
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          opens_at?: string | null
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          opens_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          customer_unread: number
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          owner_unread: number
          status: string
          updated_at: string
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_unread?: number
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_unread?: number
          status?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_unread?: number
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_unread?: number
          status?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          fcm_token: string
          id: string
          last_seen_at: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fcm_token: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fcm_token?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string | null
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string | null
          sender_role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string
          created_at: string
          discount_cents: number
          id: string
          kind: string | null
          paid_at: string | null
          promo_code: string | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id: string
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string | null
          paid_at?: string | null
          promo_code?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string | null
          paid_at?: string | null
          promo_code?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          marketing_opt_in: boolean
          phone: string | null
          role: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          marketing_opt_in?: boolean
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          amount_off_cents: number | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          percent_off: number | null
          stripe_coupon_id: string | null
          stripe_promotion_code_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_off_cents?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          percent_off?: number | null
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          percent_off?: number | null
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      site_banners: {
        Row: {
          body: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          ends_at: string | null
          headline: string
          id: string
          is_active: boolean
          starts_at: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          ends_at?: string | null
          headline: string
          id?: string
          is_active?: boolean
          starts_at?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          ends_at?: string | null
          headline?: string
          id?: string
          is_active?: boolean
          starts_at?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string
          type: string | null
        }
        Insert: {
          id: string
          processed_at?: string
          type?: string | null
        }
        Update: {
          id?: string
          processed_at?: string
          type?: string | null
        }
        Relationships: []
      }
      sweepstakes: {
        Row: {
          created_at: string
          description: string | null
          drawn_at: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          prize: string | null
          rules_url: string | null
          starts_at: string | null
          title: string
          updated_at: string
          winner_entry_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          drawn_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          prize?: string | null
          rules_url?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          winner_entry_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          drawn_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          prize?: string | null
          rules_url?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          winner_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sweepstakes_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      sweepstakes_entries: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          sweepstakes_id: string
          user_id: string | null
          zip: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          sweepstakes_id: string
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          sweepstakes_id?: string
          user_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sweepstakes_entries_sweepstakes_id_fkey"
            columns: ["sweepstakes_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sweepstakes_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_sessions: {
        Row: {
          appointment_id: string
          created_at: string
          ended_at: string | null
          eta_seconds: number | null
          eta_updated_at: string | null
          id: string
          last_heading: number | null
          last_lat: number | null
          last_lng: number | null
          last_ping_at: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          ended_at?: string | null
          eta_seconds?: number | null
          eta_updated_at?: string | null
          id?: string
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_ping_at?: string | null
          started_at?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          ended_at?: string | null
          eta_seconds?: number | null
          eta_updated_at?: string | null
          id?: string
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_ping_at?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
      mark_conversation_read: {
        Args: { p_conversation_id: string; p_role: string }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status:
        | "requested"
        | "confirmed"
        | "en_route"
        | "in_progress"
        | "completed"
        | "closed"
        | "cancelled"
        | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "requested",
        "confirmed",
        "en_route",
        "in_progress",
        "completed",
        "closed",
        "cancelled",
        "no_show",
      ],
    },
  },
} as const

