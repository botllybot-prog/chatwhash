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
    PostgrestVersion: "14.5"
  }
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
          owner_note: string | null
          owner_offer: string | null
          proposed_date: string | null
          proposed_time: string | null
          rated_at: string | null
          rating_requested: boolean
          rating_requested_at: string | null
          reminder_sent: boolean | null
          service_id: string
          spin_discount_percent: number
          station_id: string
          status: Database["public"]["Enums"]["booking_status"]
          timeout_notified: boolean
          vehicle_details: string | null
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
          owner_note?: string | null
          owner_offer?: string | null
          proposed_date?: string | null
          proposed_time?: string | null
          rated_at?: string | null
          rating_requested?: boolean
          rating_requested_at?: string | null
          reminder_sent?: boolean | null
          service_id: string
          spin_discount_percent?: number
          station_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          timeout_notified?: boolean
          vehicle_details?: string | null
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
          owner_note?: string | null
          owner_offer?: string | null
          proposed_date?: string | null
          proposed_time?: string | null
          rated_at?: string | null
          rating_requested?: boolean
          rating_requested_at?: string | null
          reminder_sent?: boolean | null
          service_id?: string
          spin_discount_percent?: number
          station_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          timeout_notified?: boolean
          vehicle_details?: string | null
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
      bot_customers: {
        Row: {
          created_at: string | null
          first_seen_at: string | null
          id: string
          is_blocked: boolean | null
          last_booking_at: string | null
          last_seen_at: string | null
          name: string | null
          notes: string | null
          phone: string
          platform: string
          total_bookings: number | null
        }
        Insert: {
          created_at?: string | null
          first_seen_at?: string | null
          id?: string
          is_blocked?: boolean | null
          last_booking_at?: string | null
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          platform?: string
          total_bookings?: number | null
        }
        Update: {
          created_at?: string | null
          first_seen_at?: string | null
          id?: string
          is_blocked?: boolean | null
          last_booking_at?: string | null
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          platform?: string
          total_bookings?: number | null
        }
        Relationships: []
      }
      bot_sessions: {
        Row: {
          conflict_booking_id: string | null
          current_step: string
          customer_phone: string
          expires_at: string
          id: string
          pending_booking_id: string | null
          rating_booking_id: string | null
          selected_date: string | null
          selected_service_id: string | null
          selected_station_id: string | null
          selected_time: string | null
          telegram_chat_id: string | null
          timeout_booking_id: string | null
          timeout_request_id: string | null
          updated_at: string
          vehicle_details: string | null
        }
        Insert: {
          conflict_booking_id?: string | null
          current_step?: string
          customer_phone: string
          expires_at?: string
          id?: string
          pending_booking_id?: string | null
          rating_booking_id?: string | null
          selected_date?: string | null
          selected_service_id?: string | null
          selected_station_id?: string | null
          selected_time?: string | null
          telegram_chat_id?: string | null
          timeout_booking_id?: string | null
          timeout_request_id?: string | null
          updated_at?: string
          vehicle_details?: string | null
        }
        Update: {
          conflict_booking_id?: string | null
          current_step?: string
          customer_phone?: string
          expires_at?: string
          id?: string
          pending_booking_id?: string | null
          rating_booking_id?: string | null
          selected_date?: string | null
          selected_service_id?: string | null
          selected_station_id?: string | null
          selected_time?: string | null
          telegram_chat_id?: string | null
          timeout_booking_id?: string | null
          timeout_request_id?: string | null
          updated_at?: string
          vehicle_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_rating_booking_id_fkey"
            columns: ["rating_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sessions_timeout_request_id_fkey"
            columns: ["timeout_request_id"]
            isOneToOne: false
            referencedRelation: "quick_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          media_key: string | null
          media_name: string | null
          media_type: string | null
          media_url: string | null
          read_at: string | null
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          media_key?: string | null
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          media_key?: string | null
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sender_id?: string
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_members: {
        Row: {
          added_at: string
          customer_phone: string | null
          id: string
          thread_id: string
          user_id: string | null
        }
        Insert: {
          added_at?: string
          customer_phone?: string | null
          id?: string
          thread_id: string
          user_id?: string | null
        }
        Update: {
          added_at?: string
          customer_phone?: string | null
          id?: string
          thread_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string | null
          name: string | null
          station_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          last_message_at?: string | null
          name?: string | null
          station_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          name?: string | null
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_station_id_fkey"
            columns: ["station_id"]
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
          platform: Database["public"]["Enums"]["message_platform"]
          station_id: string | null
          status: string
          telegram_chat_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string | null
          platform?: Database["public"]["Enums"]["message_platform"]
          station_id?: string | null
          status?: string
          telegram_chat_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string | null
          platform?: Database["public"]["Enums"]["message_platform"]
          station_id?: string | null
          status?: string
          telegram_chat_id?: string | null
        }
        Relationships: []
      }
      customer_login_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          customer_phone: string
          expires_at: string
          id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          customer_phone: string
          expires_at: string
          id?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          customer_phone?: string
          expires_at?: string
          id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          body: string
          created_at: string
          customer_phone: string
          id: string
          is_read: boolean
          reference_booking_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_phone: string
          id?: string
          is_read?: boolean
          reference_booking_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_phone?: string
          id?: string
          is_read?: boolean
          reference_booking_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_reference_booking_id_fkey"
            columns: ["reference_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          city: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          is_blocked: boolean
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          is_blocked?: boolean
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          is_blocked?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      customer_web_sessions: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          expires_at: string
          id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone: string
          expires_at: string
          id?: string
          session_token: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          expires_at?: string
          id?: string
          session_token?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          language: string
          phone: string
          platform: string
          role: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          phone: string
          platform: string
          role: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          phone?: string
          platform?: string
          role?: string
          token?: string
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
      employees: {
        Row: {
          can_add_service: boolean
          can_create_owners: boolean
          can_create_stations: boolean
          can_edit_prices: boolean
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          can_add_service?: boolean
          can_create_owners?: boolean
          can_create_stations?: boolean
          can_edit_prices?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          can_add_service?: boolean
          can_create_owners?: boolean
          can_create_stations?: boolean
          can_edit_prices?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
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
          platform: Database["public"]["Enums"]["message_platform"]
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
          platform?: Database["public"]["Enums"]["message_platform"]
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
          platform?: Database["public"]["Enums"]["message_platform"]
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
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      offer_details: {
        Row: {
          body: string | null
          id: string
          media_key: string | null
          media_name: string | null
          media_type: string | null
          media_url: string | null
          offer_id: string
          sort: number
          station_id: string | null
          title: string | null
          url: string | null
          url_type: string
        }
        Insert: {
          body?: string | null
          id?: string
          media_key?: string | null
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          offer_id: string
          sort?: number
          station_id?: string | null
          title?: string | null
          url?: string | null
          url_type: string
        }
        Update: {
          body?: string | null
          id?: string
          media_key?: string | null
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          offer_id?: string
          sort?: number
          station_id?: string | null
          title?: string | null
          url?: string | null
          url_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_details_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_details_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          cities: string
          id: string
          title: string
          type: string
        }
        Insert: {
          cities: string
          id?: string
          title: string
          type: string
        }
        Update: {
          cities?: string
          id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "offer_types"
            referencedColumns: ["id"]
          },
        ]
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
      quick_booking_requests: {
        Row: {
          booking_date: string
          booking_time: string
          chosen_booking_id: string | null
          chosen_station_id: string | null
          created_at: string
          customer_lat: number | null
          customer_lng: number | null
          customer_name: string
          customer_phone: string
          id: string
          service_kind: string
          status: string
          timeout_notified: boolean
        }
        Insert: {
          booking_date: string
          booking_time: string
          chosen_booking_id?: string | null
          chosen_station_id?: string | null
          created_at?: string
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name: string
          customer_phone: string
          id?: string
          service_kind: string
          status?: string
          timeout_notified?: boolean
        }
        Update: {
          booking_date?: string
          booking_time?: string
          chosen_booking_id?: string | null
          chosen_station_id?: string | null
          created_at?: string
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name?: string
          customer_phone?: string
          id?: string
          service_kind?: string
          status?: string
          timeout_notified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quick_booking_requests_chosen_booking_id_fkey"
            columns: ["chosen_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_booking_requests_chosen_station_id_fkey"
            columns: ["chosen_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_booking_targets: {
        Row: {
          booking_id: string
          created_at: string
          distance_km: number
          id: string
          request_id: string
          state: string
          station_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          distance_km?: number
          id?: string
          request_id: string
          state?: string
          station_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          distance_km?: number
          id?: string
          request_id?: string
          state?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_booking_targets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_booking_targets_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quick_booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_booking_targets_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
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
          created_by: string | null
          free_requests_quota: number
          free_requests_used: number
          id: string
          is_active: boolean
          outstanding_debt: number
          owner_name: string
          owner_phone: string | null
          station_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          free_requests_quota?: number
          free_requests_used?: number
          id?: string
          is_active?: boolean
          outstanding_debt?: number
          owner_name: string
          owner_phone?: string | null
          station_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          free_requests_quota?: number
          free_requests_used?: number
          id?: string
          is_active?: boolean
          outstanding_debt?: number
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
          created_by: string | null
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
          suspended_at: string | null
          suspension_reason: string | null
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          address?: string | null
          category?: string
          commission_rate?: number
          created_at?: string
          created_by?: string | null
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
          suspended_at?: string | null
          suspension_reason?: string | null
          working_hours_end?: string
          working_hours_start?: string
        }
        Update: {
          address?: string | null
          category?: string
          commission_rate?: number
          created_at?: string
          created_by?: string | null
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
          suspended_at?: string | null
          suspension_reason?: string | null
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
          exhausted_notified_at: string | null
          id: string
          package_code: string | null
          paid_at: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          request_limit: number | null
          requests_used: number
          start_date: string
          station_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          warning_sent_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          end_date?: string
          exhausted_notified_at?: string | null
          id?: string
          package_code?: string | null
          paid_at?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          request_limit?: number | null
          requests_used?: number
          start_date?: string
          station_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          warning_sent_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          end_date?: string
          exhausted_notified_at?: string | null
          id?: string
          package_code?: string | null
          paid_at?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          request_limit?: number | null
          requests_used?: number
          start_date?: string
          station_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          warning_sent_at?: string | null
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
      is_chat_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      recalculate_station_rating: {
        Args: { target_station_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "station_owner" | "employee"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "pending_customer_approval"
        | "pending_owner_approval"
      edit_request_status: "pending" | "approved" | "rejected"
      message_platform: "whatsapp" | "telegram"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "station_owner", "employee"],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "pending_customer_approval",
        "pending_owner_approval",
      ],
      edit_request_status: ["pending", "approved", "rejected"],
      message_platform: ["whatsapp", "telegram"],
      payment_status: ["paid", "pending", "failed", "refunded"],
      scheduling_type: ["slots", "instant", "daily"],
      subscription_plan: ["basic", "pro", "premium"],
      subscription_status: ["active", "expired", "cancelled", "trial"],
    },
  },
} as const
