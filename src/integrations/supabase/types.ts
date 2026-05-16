export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_date: string
          booking_number: number
          booking_time: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          customer_rating: number | null
          id: string
          rated_at: string | null
          reminder_sent: boolean
          rating_requested: boolean
          rating_requested_at: string | null
          service_id: string
          spin_discount_percent: number
          station_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booking_date: string
          booking_number?: number
          booking_time?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          customer_rating?: number | null
          id?: string
          rated_at?: string | null
          reminder_sent?: boolean
          rating_requested?: boolean
          rating_requested_at?: string | null
          service_id: string
          spin_discount_percent?: number
          station_id: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booking_date?: string
          booking_number?: number
          booking_time?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          customer_rating?: number | null
          id?: string
          rated_at?: string | null
          reminder_sent?: boolean
          rating_requested?: boolean
          rating_requested_at?: string | null
          service_id?: string
          spin_discount_percent?: number
          station_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessions: {
        Row: {
          current_step: string
          customer_phone: string
          expires_at: string
          id: string
          selected_date: string | null
          selected_service_id: string | null
          selected_station_id: string | null
          updated_at: string
        }
        Insert: {
          current_step?: string
          customer_phone: string
          expires_at?: string
          id?: string
          selected_date?: string | null
          selected_service_id?: string | null
          selected_station_id?: string | null
          updated_at?: string
        }
        Update: {
          current_step?: string
          customer_phone?: string
          expires_at?: string
          id?: string
          selected_date?: string | null
          selected_service_id?: string | null
          selected_station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_selected_service_id_fkey"
            columns: ["selected_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sessions_selected_station_id_fkey"
            columns: ["selected_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          booking_amount: number
          booking_id: string
          commission_amount: number
          created_at: string
          id: string
          station_id: string
        }
        Insert: {
          booking_amount: number
          booking_id: string
          commission_amount: number
          created_at?: string
          id?: string
          station_id: string
        }
        Update: {
          booking_amount?: number
          booking_id?: string
          commission_amount?: number
          created_at?: string
          id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string | null
          status?: string
        }
        Relationships: []
      }
      edit_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string | null
          requested_by: string
          reviewed_at: string | null
          station_id: string
          status: Database["public"]["Enums"]["edit_request_status"]
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value?: string | null
          requested_by: string
          reviewed_at?: string | null
          station_id: string
          status?: Database["public"]["Enums"]["edit_request_status"]
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string | null
          requested_by?: string
          reviewed_at?: string | null
          station_id?: string
          status?: Database["public"]["Enums"]["edit_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "edit_requests_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          media_url: string | null
          message_type: string
          status: string
          whatsapp_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          media_url?: string | null
          message_type?: string
          status?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_url?: string | null
          message_type?: string
          status?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          payment_date: string
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          customer_discount: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          station_id: string | null
        }
        Insert: {
          created_at?: string
          customer_discount?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          station_id?: string | null
        }
        Update: {
          created_at?: string
          customer_discount?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_owners: {
        Row: {
          created_at: string
          id: string
          owner_name: string
          owner_phone: string | null
          station_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_name: string
          owner_phone?: string | null
          station_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_name?: string
          owner_phone?: string | null
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_owners_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          address: string | null
          category: string
          commission_rate: number
          created_at: string
          detailed_address: string | null
          id: string
          image_url: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          rating_average: number
          rating_count: number
          scheduling_type: Database["public"]["Enums"]["scheduling_type"]
          slot_duration_minutes: number
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          address?: string | null
          category?: string
          commission_rate?: number
          created_at?: string
          detailed_address?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          rating_average?: number
          rating_count?: number
          scheduling_type?: Database["public"]["Enums"]["scheduling_type"]
          slot_duration_minutes?: number
          working_hours_end?: string
          working_hours_start?: string
        }
        Update: {
          address?: string | null
          category?: string
          commission_rate?: number
          created_at?: string
          detailed_address?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          rating_average?: number
          rating_count?: number
          scheduling_type?: Database["public"]["Enums"]["scheduling_type"]
          slot_duration_minutes?: number
          working_hours_end?: string
          working_hours_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          end_date: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          start_date: string
          station_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          end_date?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string
          station_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          end_date?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string
          station_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: true
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_owner_station_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "station_owner"
      booking_status: "pending" | "pending_owner_approval" | "pending_customer_approval" | "confirmed" | "completed" | "cancelled"
      edit_request_status: "pending" | "approved" | "rejected"
      payment_status: "paid" | "pending" | "failed" | "refunded"
      scheduling_type: "slots" | "instant" | "daily"
      subscription_plan: "basic" | "pro" | "premium"
      subscription_status: "active" | "expired" | "cancelled" | "trial"
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
  public: {
    Enums: {
      app_role: ["admin", "station_owner"],
      booking_status: ["pending", "pending_owner_approval", "pending_customer_approval", "confirmed", "completed", "cancelled"],
      edit_request_status: ["pending", "approved", "rejected"],
      payment_status: ["paid", "pending", "failed", "refunded"],
      scheduling_type: ["slots", "instant", "daily"],
      subscription_plan: ["basic", "pro", "premium"],
      subscription_status: ["active", "expired", "cancelled", "trial"],
    },
  },
} as const
