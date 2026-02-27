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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      action_item_completions: {
        Row: {
          completed_at: string
          id: string
          item_index: number
          recording_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          item_index: number
          recording_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          item_index?: number
          recording_id?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      backup_integrity_checks: {
        Row: {
          backups_corrupted: number
          backups_found: number
          backups_missing: number
          checked_at: string
          details: Json | null
          id: string
          run_by: string | null
          status: string
          total_recordings: number
        }
        Insert: {
          backups_corrupted?: number
          backups_found?: number
          backups_missing?: number
          checked_at?: string
          details?: Json | null
          id?: string
          run_by?: string | null
          status?: string
          total_recordings?: number
        }
        Update: {
          backups_corrupted?: number
          backups_found?: number
          backups_missing?: number
          checked_at?: string
          details?: Json | null
          id?: string
          run_by?: string | null
          status?: string
          total_recordings?: number
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          context_id: string | null
          context_type: string
          created_at: string
          id: string
          messages: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type: string
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          message: string
          severity: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          severity?: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          severity?: string
        }
        Relationships: []
      }
      onboarding_status: {
        Row: {
          completed_at: string | null
          created_at: string
          tour_completed: boolean
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          tour_completed?: boolean
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          tour_completed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          project_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          project_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_recordings: {
        Row: {
          added_at: string
          id: string
          project_id: string
          recording_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          project_id: string
          recording_id: string
        }
        Update: {
          added_at?: string
          id?: string
          project_id?: string
          recording_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_recordings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_recordings_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          analysis: Json | null
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recall_calendar_users: {
        Row: {
          bot_avatar_url: string | null
          bot_name: string | null
          created_at: string
          google_connected: boolean
          id: string
          microsoft_connected: boolean
          recall_user_id: string
          recording_preferences: Json | null
          supabase_user_id: string
          updated_at: string
        }
        Insert: {
          bot_avatar_url?: string | null
          bot_name?: string | null
          created_at?: string
          google_connected?: boolean
          id?: string
          microsoft_connected?: boolean
          recall_user_id: string
          recording_preferences?: Json | null
          supabase_user_id: string
          updated_at?: string
        }
        Update: {
          bot_avatar_url?: string | null
          bot_name?: string | null
          created_at?: string
          google_connected?: boolean
          id?: string
          microsoft_connected?: boolean
          recall_user_id?: string
          recording_preferences?: Json | null
          supabase_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          action_items: string[] | null
          calendar_attendees: Json | null
          created_at: string
          deleted_at: string | null
          duration: number | null
          id: string
          key_points: string[] | null
          meeting_id: string
          meeting_url: string | null
          participants: Json | null
          recall_bot_id: string | null
          source: string | null
          status: string
          summary: string | null
          title: string | null
          transcript_text: string | null
          transcript_url: string | null
          updated_at: string
          user_id: string | null
          video_url: string | null
          word_count: number | null
        }
        Insert: {
          action_items?: string[] | null
          calendar_attendees?: Json | null
          created_at?: string
          deleted_at?: string | null
          duration?: number | null
          id?: string
          key_points?: string[] | null
          meeting_id: string
          meeting_url?: string | null
          participants?: Json | null
          recall_bot_id?: string | null
          source?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          transcript_text?: string | null
          transcript_url?: string | null
          updated_at?: string
          user_id?: string | null
          video_url?: string | null
          word_count?: number | null
        }
        Update: {
          action_items?: string[] | null
          calendar_attendees?: Json | null
          created_at?: string
          deleted_at?: string | null
          duration?: number | null
          id?: string
          key_points?: string[] | null
          meeting_id?: string
          meeting_url?: string | null
          participants?: Json | null
          recall_bot_id?: string | null
          source?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          transcript_text?: string | null
          transcript_url?: string | null
          updated_at?: string
          user_id?: string | null
          video_url?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      shared_recordings: {
        Row: {
          created_at: string
          id: string
          recording_id: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          id?: string
          recording_id: string
          shared_by: string
          shared_with: string
        }
        Update: {
          created_at?: string
          id?: string
          recording_id?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_recordings_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_suggestions: {
        Row: {
          created_at: string | null
          id: string
          last_used_at: string | null
          name: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          max_minutes: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_minutes?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_minutes?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          created_at: string | null
          id: string
          max_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          api_key_id: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          last_triggered: string | null
          name: string
          report_type: string
          schedule_day: number | null
          schedule_time: string | null
          threshold_type: string | null
          threshold_value: number | null
          webhook_url: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          name: string
          report_type?: string
          schedule_day?: number | null
          schedule_time?: string | null
          threshold_type?: string | null
          threshold_value?: number | null
          webhook_url: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          name?: string
          report_type?: string
          schedule_day?: number | null
          schedule_time?: string | null
          threshold_type?: string | null
          threshold_value?: number | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      owns_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      owns_recording: {
        Args: { _recording_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "approved"
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
      app_role: ["admin", "user", "approved"],
    },
  },
} as const
