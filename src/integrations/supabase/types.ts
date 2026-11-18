// Gerado automaticamente a partir da base de dados (Supabase → gen types typescript).
// Para regenerar: npx supabase gen types typescript --project-id imryfgenvpcjhdsthidg > src/integrations/supabase/types.ts
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          points: number
          reason: string
          team_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          points: number
          reason?: string
          team_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          points?: number
          reason?: string
          team_id?: string
          type?: Database["public"]["Enums"]["adjustment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          challenge: string
          description: string
          event_id: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          seq: number
          text_prompt: string | null
          theme: string
        }
        Insert: {
          challenge: string
          description?: string
          event_id: string
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
          seq: number
          text_prompt?: string | null
          theme?: string
        }
        Update: {
          challenge?: string
          description?: string
          event_id?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          seq?: number
          text_prompt?: string | null
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          active: boolean
          base_lat: number
          base_lng: number
          base_name: string
          coordinator_name: string | null
          coordinator_phone: string | null
          created_at: string
          deadline_at: string
          event_date: string
          id: string
          name: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          base_lat?: number
          base_lng?: number
          base_name?: string
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          deadline_at: string
          event_date: string
          id?: string
          name: string
          starts_at: string
        }
        Update: {
          active?: boolean
          base_lat?: number
          base_lng?: number
          base_name?: string
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          deadline_at?: string
          event_date?: string
          id?: string
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      photo_votes: {
        Row: {
          created_at: string
          staff_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          staff_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          staff_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answered_by: string | null
          checkpoint_id: string
          correct: boolean
          created_at: string
          option: string
          team_id: string
        }
        Insert: {
          answered_by?: string | null
          checkpoint_id: string
          correct: boolean
          created_at?: string
          option: string
          team_id: string
        }
        Update: {
          answered_by?: string | null
          checkpoint_id?: string
          correct?: boolean
          created_at?: string
          option?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          checkpoint_id: string
          options: Json
          question: string
        }
        Insert: {
          checkpoint_id: string
          options: Json
          question: string
        }
        Update: {
          checkpoint_id?: string
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: true
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          name: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          name?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          accuracy_m: number | null
          challenge_points: number | null
          challenge_text: string | null
          checkpoint_id: string
          created_at: string
          distance_m: number | null
          gps_status: Database["public"]["Enums"]["gps_status"]
          id: string
          lat: number | null
          lng: number | null
          out_of_area: boolean
          photo_path: string
          points_photo: number | null
          points_relevance: number | null
          points_text: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_by: string | null
          taken_at: string | null
          teacher_comment: string | null
          team_id: string
        }
        Insert: {
          accuracy_m?: number | null
          challenge_points?: number | null
          challenge_text?: string | null
          checkpoint_id: string
          created_at?: string
          distance_m?: number | null
          gps_status: Database["public"]["Enums"]["gps_status"]
          id: string
          lat?: number | null
          lng?: number | null
          out_of_area?: boolean
          photo_path: string
          points_photo?: number | null
          points_relevance?: number | null
          points_text?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_by?: string | null
          taken_at?: string | null
          teacher_comment?: string | null
          team_id: string
        }
        Update: {
          accuracy_m?: number | null
          challenge_points?: number | null
          challenge_text?: string | null
          checkpoint_id?: string
          created_at?: string
          distance_m?: number | null
          gps_status?: Database["public"]["Enums"]["gps_status"]
          id?: string
          lat?: number | null
          lng?: number | null
          out_of_area?: boolean
          photo_path?: string
          points_photo?: number | null
          points_relevance?: number | null
          points_text?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_by?: string | null
          taken_at?: string | null
          teacher_comment?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
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
          arrival_distance_m: number | null
          arrival_lat: number | null
          arrival_lng: number | null
          arrived_at: string | null
          class_name: string
          code: string
          created_at: string
          deadline_at: string | null
          event_id: string
          id: string
          name: string
          start_seq: number
        }
        Insert: {
          arrival_distance_m?: number | null
          arrival_lat?: number | null
          arrival_lng?: number | null
          arrived_at?: string | null
          class_name?: string
          code: string
          created_at?: string
          deadline_at?: string | null
          event_id: string
          id?: string
          name: string
          start_seq?: number
        }
        Update: {
          arrival_distance_m?: number | null
          arrival_lat?: number | null
          arrival_lng?: number | null
          arrived_at?: string | null
          class_name?: string
          code?: string
          created_at?: string
          deadline_at?: string | null
          event_id?: string
          id?: string
          name?: string
          start_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_staff: {
        Args: { p_email: string; p_name: string; p_role?: string }
        Returns: {
          created_at: string
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_event_photo_paths: {
        Args: { p_event_id: string }
        Returns: string[]
      }
      create_submission: {
        Args: {
          p_accuracy_m?: number
          p_challenge_text?: string
          p_checkpoint_id: string
          p_gps_status?: string
          p_id: string
          p_lat?: number
          p_lng?: number
          p_photo_path: string
          p_taken_at?: string
        }
        Returns: {
          accuracy_m: number | null
          challenge_points: number | null
          challenge_text: string | null
          checkpoint_id: string
          created_at: string
          distance_m: number | null
          gps_status: Database["public"]["Enums"]["gps_status"]
          id: string
          lat: number | null
          lng: number | null
          out_of_area: boolean
          photo_path: string
          points_photo: number | null
          points_relevance: number | null
          points_text: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_by: string | null
          taken_at: string | null
          teacher_comment: string | null
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team: {
        Args: {
          p_class_name?: string
          p_deadline_at?: string
          p_event_id: string
          p_name: string
          p_start_seq?: number
        }
        Returns: {
          arrival_distance_m: number | null
          arrival_lat: number | null
          arrival_lng: number | null
          arrived_at: string | null
          class_name: string
          code: string
          created_at: string
          deadline_at: string | null
          event_id: string
          id: string
          name: string
          start_seq: number
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      distribute_start_seqs: { Args: { p_event_id: string }; Returns: number }
      join_team: { Args: { p_code: string }; Returns: Json }
      leaderboard: {
        Args: { p_event_id: string }
        Returns: {
          arrived_at: string
          challenge_points: number
          class_name: string
          deadline_at: string
          late_minutes: number
          late_penalty: number
          pending_count: number
          presentation_points: number
          quiz_correct: number
          quiz_points: number
          rank: number
          safety_count: number
          safety_points: number
          start_seq: number
          team_id: string
          team_name: string
          teamwork_points: number
          total: number
          validated_count: number
        }[]
      }
      list_staff: {
        Args: never
        Returns: {
          created_at: string
          email: string
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }[]
      }
      mark_arrival: {
        Args: { p_lat?: number; p_lng?: number }
        Returns: string
      }
      my_team_score: {
        Args: never
        Returns: {
          challenge_points: number
          late_minutes: number
          late_penalty: number
          pending_count: number
          presentation_points: number
          quiz_correct: number
          quiz_points: number
          safety_count: number
          safety_points: number
          team_id: string
          teamwork_points: number
          total: number
          validated_count: number
        }[]
      }
      purge_event: {
        Args: { p_delete_event?: boolean; p_event_id: string }
        Returns: Json
      }
      regenerate_team_code: { Args: { p_team_id: string }; Returns: string }
      review_submission: {
        Args: {
          p_comment?: string
          p_id: string
          p_points_photo?: number
          p_points_relevance?: number
          p_points_text?: number
          p_status: string
        }
        Returns: {
          accuracy_m: number | null
          challenge_points: number | null
          challenge_text: string | null
          checkpoint_id: string
          created_at: string
          distance_m: number | null
          gps_status: Database["public"]["Enums"]["gps_status"]
          id: string
          lat: number | null
          lng: number | null
          out_of_area: boolean
          photo_path: string
          points_photo: number | null
          points_relevance: number | null
          points_text: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_by: string | null
          taken_at: string | null
          teacher_comment: string | null
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_adjustment: {
        Args: {
          p_points?: number
          p_reason?: string
          p_team_id: string
          p_type: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          points: number
          reason: string
          team_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        SetofOptions: {
          from: "*"
          to: "adjustments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_team_arrival: {
        Args: { p_arrived_at: string; p_team_id: string }
        Returns: {
          arrival_distance_m: number | null
          arrival_lat: number | null
          arrival_lng: number | null
          arrived_at: string | null
          class_name: string
          code: string
          created_at: string
          deadline_at: string | null
          event_id: string
          id: string
          name: string
          start_seq: number
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_quiz_keys: {
        Args: { p_event_id: string }
        Returns: {
          checkpoint_id: string
          correct_option: string
        }[]
      }
      staff_upsert_quiz: {
        Args: {
          p_checkpoint_id: string
          p_correct: string
          p_options: Json
          p_question: string
        }
        Returns: undefined
      }
      submit_quiz_answer: {
        Args: { p_checkpoint_id: string; p_option: string }
        Returns: Json
      }
      team_last_positions: {
        Args: { p_event_id: string }
        Returns: {
          checkpoint_seq: number
          lat: number
          lng: number
          seen_at: string
          team_id: string
        }[]
      }
    }
    Enums: {
      adjustment_type: "teamwork" | "presentation" | "safety"
      gps_status: "ok" | "denied" | "unavailable"
      staff_role: "teacher" | "admin"
      submission_status: "pending" | "approved" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      adjustment_type: ["teamwork", "presentation", "safety"],
      gps_status: ["ok", "denied", "unavailable"],
      staff_role: ["teacher", "admin"],
      submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
