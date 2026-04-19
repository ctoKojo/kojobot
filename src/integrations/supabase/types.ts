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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_closure_groups: {
        Row: {
          closure_id: string
          group_id: string
          id: string
        }
        Insert: {
          closure_id: string
          group_id: string
          id?: string
        }
        Update: {
          closure_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_closure_groups_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "academy_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_closure_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_closures: {
        Row: {
          affects_all_groups: boolean
          created_at: string
          created_by: string
          end_date: string
          id: string
          reason: string | null
          reason_ar: string | null
          start_date: string
        }
        Insert: {
          affects_all_groups?: boolean
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          reason?: string | null
          reason_ar?: string | null
          start_date: string
        }
        Update: {
          affects_all_groups?: boolean
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          reason?: string | null
          reason_ar?: string | null
          start_date?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          condition_type: string
          condition_value: Json
          created_at: string
          description: string | null
          description_ar: string | null
          icon_name: string
          id: string
          is_active: boolean
          key: string
          title: string
          title_ar: string
          xp_reward: number
        }
        Insert: {
          condition_type: string
          condition_value?: Json
          created_at?: string
          description?: string | null
          description_ar?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean
          key: string
          title: string
          title_ar: string
          xp_reward?: number
        }
        Update: {
          condition_type?: string
          condition_value?: Json
          created_at?: string
          description?: string | null
          description_ar?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean
          key?: string
          title?: string
          title_ar?: string
          xp_reward?: number
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      age_groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          max_age: number
          min_age: number
          name: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_age: number
          min_age: number
          name: string
          name_ar: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_age?: number
          min_age?: number
          name?: string
          name_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      approved_financial_rpcs: {
        Row: {
          added_at: string
          added_by: string | null
          description: string | null
          rpc_name: string
          version: number
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          description?: string | null
          rpc_name: string
          version?: number
        }
        Update: {
          added_at?: string
          added_by?: string | null
          description?: string | null
          rpc_name?: string
          version?: number
        }
        Relationships: []
      }
      assessment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: Database["public"]["Enums"]["assessment_event_type"]
          id: string
          payload: Json
          quiz_version_id: string | null
          submission_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: Database["public"]["Enums"]["assessment_event_type"]
          id?: string
          payload?: Json
          quiz_version_id?: string | null
          submission_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: Database["public"]["Enums"]["assessment_event_type"]
          id?: string
          payload?: Json
          quiz_version_id?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_events_quiz_version_id_fkey"
            columns: ["quiz_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_overrides: {
        Row: {
          assignment_id: string
          created_at: string
          due_date: string | null
          id: string
          makeup_session_id: string | null
          source: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          makeup_session_id?: string | null
          source?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          makeup_session_id?: string | null
          source?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_overrides_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_overrides_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_overrides_makeup_session_id_fkey"
            columns: ["makeup_session_id"]
            isOneToOne: false
            referencedRelation: "makeup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          feedback: string | null
          feedback_ar: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_auto_generated: boolean
          score: number | null
          status: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          feedback?: string | null
          feedback_ar?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_auto_generated?: boolean
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          feedback?: string | null
          feedback_ar?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_auto_generated?: boolean
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["assignment_id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          curriculum_snapshot: Json | null
          description: string | null
          description_ar: string | null
          due_date: string
          group_id: string | null
          id: string
          is_active: boolean | null
          is_auto_generated: boolean
          max_score: number | null
          session_id: string | null
          student_id: string | null
          title: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          curriculum_snapshot?: Json | null
          description?: string | null
          description_ar?: string | null
          due_date: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean
          max_score?: number | null
          session_id?: string | null
          student_id?: string | null
          title: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          curriculum_snapshot?: Json | null
          description?: string | null
          description_ar?: string | null
          due_date?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean
          max_score?: number | null
          session_id?: string | null
          student_id?: string | null
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          compensation_status: string
          id: string
          makeup_session_id: string | null
          notes: string | null
          recorded_at: string
          recorded_by: string
          session_id: string
          status: string
          student_id: string
        }
        Insert: {
          compensation_status?: string
          id?: string
          makeup_session_id?: string | null
          notes?: string | null
          recorded_at?: string
          recorded_by: string
          session_id: string
          status?: string
          student_id: string
        }
        Update: {
          compensation_status?: string
          id?: string
          makeup_session_id?: string | null
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
          session_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_makeup_session_id_fkey"
            columns: ["makeup_session_id"]
            isOneToOne: false
            referencedRelation: "makeup_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_alerts: {
        Row: {
          account_id: string
          account_type: Database["public"]["Enums"]["balance_account_type"]
          acknowledged_at: string | null
          acknowledged_by: string | null
          cached_balance: number
          computed_balance: number
          detected_at: string
          detected_by: string | null
          detected_by_method: Database["public"]["Enums"]["balance_alert_method"]
          difference: number
          id: string
          notes: string | null
          rebuilt_at: string | null
          rebuilt_by: string | null
          status: Database["public"]["Enums"]["balance_alert_status"]
        }
        Insert: {
          account_id: string
          account_type: Database["public"]["Enums"]["balance_account_type"]
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          cached_balance: number
          computed_balance: number
          detected_at?: string
          detected_by?: string | null
          detected_by_method: Database["public"]["Enums"]["balance_alert_method"]
          difference: number
          id?: string
          notes?: string | null
          rebuilt_at?: string | null
          rebuilt_by?: string | null
          status?: Database["public"]["Enums"]["balance_alert_status"]
        }
        Update: {
          account_id?: string
          account_type?: Database["public"]["Enums"]["balance_account_type"]
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          cached_balance?: number
          computed_balance?: number
          detected_at?: string
          detected_by?: string | null
          detected_by_method?: Database["public"]["Enums"]["balance_alert_method"]
          difference?: number
          id?: string
          notes?: string | null
          rebuilt_at?: string | null
          rebuilt_by?: string | null
          status?: Database["public"]["Enums"]["balance_alert_status"]
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_control: boolean
          is_system: boolean
          name: string
          name_ar: string
          normal_side: Database["public"]["Enums"]["normal_side_type"]
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_control?: boolean
          is_system?: boolean
          name: string
          name_ar: string
          normal_side: Database["public"]["Enums"]["normal_side_type"]
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_control?: boolean
          is_system?: boolean
          name?: string
          name_ar?: string
          normal_side?: Database["public"]["Enums"]["normal_side_type"]
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          age_group_id: string | null
          concepts_mastered: string[] | null
          created_at: string
          current_step: string | null
          id: string
          last_kojo_question: string | null
          last_message_at: string | null
          level_id: string | null
          persona: string
          praise_flags: string[] | null
          status: string
          student_id: string
          summary: string | null
          summary_message_count: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          age_group_id?: string | null
          concepts_mastered?: string[] | null
          created_at?: string
          current_step?: string | null
          id?: string
          last_kojo_question?: string | null
          last_message_at?: string | null
          level_id?: string | null
          persona?: string
          praise_flags?: string[] | null
          status?: string
          student_id: string
          summary?: string | null
          summary_message_count?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          age_group_id?: string | null
          concepts_mastered?: string[] | null
          created_at?: string
          current_step?: string | null
          id?: string
          last_kojo_question?: string | null
          last_message_at?: string | null
          level_id?: string | null
          persona?: string
          praise_flags?: string[] | null
          status?: string
          student_id?: string
          summary?: string | null
          summary_message_count?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_conversations_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          safety_flags: Json | null
          sources_used: Json | null
          tokens_estimate: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          safety_flags?: Json | null
          sources_used?: Json | null
          tokens_estimate?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          safety_flags?: Json | null
          sources_used?: Json | null
          tokens_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_rate_limits: {
        Row: {
          daily_count: number
          daily_reset_at: string
          id: string
          minute_count: number
          minute_reset_at: string
          student_id: string
        }
        Insert: {
          daily_count?: number
          daily_reset_at?: string
          id?: string
          minute_count?: number
          minute_reset_at?: string
          student_id: string
        }
        Update: {
          daily_count?: number
          daily_reset_at?: string
          id?: string
          minute_count?: number
          minute_reset_at?: string
          student_id?: string
        }
        Relationships: []
      }
      chatbot_reports: {
        Row: {
          context_messages: Json | null
          conversation_id: string
          created_at: string
          id: string
          reported_message_id: string
          student_id: string
        }
        Insert: {
          context_messages?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          reported_message_id: string
          student_id: string
        }
        Update: {
          context_messages?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          reported_message_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "chatbot_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scan_runs: {
        Row: {
          avg_scan_lag_seconds: number | null
          errors: Json | null
          execution_time_ms: number | null
          finished_at: string | null
          id: string
          metadata: Json | null
          scan_type: string
          sessions_scanned: number | null
          started_at: string
          warnings_auto_resolved: number | null
          warnings_created: number | null
          warnings_skipped: number | null
        }
        Insert: {
          avg_scan_lag_seconds?: number | null
          errors?: Json | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          scan_type?: string
          sessions_scanned?: number | null
          started_at?: string
          warnings_auto_resolved?: number | null
          warnings_created?: number | null
          warnings_skipped?: number | null
        }
        Update: {
          avg_scan_lag_seconds?: number | null
          errors?: Json | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          scan_type?: string
          sessions_scanned?: number | null
          started_at?: string
          warnings_auto_resolved?: number | null
          warnings_created?: number | null
          warnings_skipped?: number | null
        }
        Relationships: []
      }
      content_access_rules: {
        Row: {
          attendance_mode: string
          can_view_assignment: boolean | null
          can_view_full_video: boolean | null
          can_view_quiz: boolean | null
          can_view_slides: boolean | null
          can_view_summary_video: boolean | null
          created_at: string
          effective_from: string | null
          id: string
          is_active: boolean | null
          subscription_type: string
          updated_at: string
        }
        Insert: {
          attendance_mode: string
          can_view_assignment?: boolean | null
          can_view_full_video?: boolean | null
          can_view_quiz?: boolean | null
          can_view_slides?: boolean | null
          can_view_summary_video?: boolean | null
          created_at?: string
          effective_from?: string | null
          id?: string
          is_active?: boolean | null
          subscription_type: string
          updated_at?: string
        }
        Update: {
          attendance_mode?: string
          can_view_assignment?: boolean | null
          can_view_full_video?: boolean | null
          can_view_quiz?: boolean | null
          can_view_slides?: boolean | null
          can_view_summary_video?: boolean | null
          created_at?: string
          effective_from?: string | null
          id?: string
          is_active?: boolean | null
          subscription_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_session_assets: {
        Row: {
          created_at: string
          id: string
          last_error_text: string | null
          processing_status: string
          session_id: string
          student_pdf_filename: string | null
          student_pdf_path: string | null
          student_pdf_size: number | null
          student_pdf_text: string | null
          student_pdf_text_updated_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error_text?: string | null
          processing_status?: string
          session_id: string
          student_pdf_filename?: string | null
          student_pdf_path?: string | null
          student_pdf_size?: number | null
          student_pdf_text?: string | null
          student_pdf_text_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error_text?: string | null
          processing_status?: string
          session_id?: string
          student_pdf_filename?: string | null
          student_pdf_path?: string | null
          student_pdf_size?: number | null
          student_pdf_text?: string | null
          student_pdf_text_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_session_assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "curriculum_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_sessions: {
        Row: {
          age_group_id: string
          assignment_attachment_type: string | null
          assignment_attachment_url: string | null
          assignment_description: string | null
          assignment_description_ar: string | null
          assignment_max_score: number | null
          assignment_title: string | null
          assignment_title_ar: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          full_video_url: string | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          level_id: string
          published_at: string | null
          quiz_id: string | null
          session_number: number
          slides_url: string | null
          student_pdf_filename: string | null
          student_pdf_path: string | null
          student_pdf_size: number | null
          student_pdf_text: string | null
          student_pdf_text_updated_at: string | null
          summary_video_url: string | null
          title: string
          title_ar: string
          updated_at: string
          version: number
        }
        Insert: {
          age_group_id: string
          assignment_attachment_type?: string | null
          assignment_attachment_url?: string | null
          assignment_description?: string | null
          assignment_description_ar?: string | null
          assignment_max_score?: number | null
          assignment_title?: string | null
          assignment_title_ar?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          full_video_url?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          level_id: string
          published_at?: string | null
          quiz_id?: string | null
          session_number: number
          slides_url?: string | null
          student_pdf_filename?: string | null
          student_pdf_path?: string | null
          student_pdf_size?: number | null
          student_pdf_text?: string | null
          student_pdf_text_updated_at?: string | null
          summary_video_url?: string | null
          title?: string
          title_ar?: string
          updated_at?: string
          version?: number
        }
        Update: {
          age_group_id?: string
          assignment_attachment_type?: string | null
          assignment_attachment_url?: string | null
          assignment_description?: string | null
          assignment_description_ar?: string | null
          assignment_max_score?: number | null
          assignment_title?: string | null
          assignment_title_ar?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          full_video_url?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          level_id?: string
          published_at?: string | null
          quiz_id?: string | null
          session_number?: number
          slides_url?: string | null
          student_pdf_filename?: string | null
          student_pdf_path?: string | null
          student_pdf_size?: number | null
          student_pdf_text?: string | null
          student_pdf_text_updated_at?: string | null
          summary_video_url?: string | null
          title?: string
          title_ar?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_sessions_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_sessions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          cached_balance: number
          cached_balance_at: string
          control_account_id: string
          created_at: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          cached_balance?: number
          cached_balance_at?: string
          control_account_id: string
          created_at?: string
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          cached_balance?: number
          cached_balance_at?: string
          control_account_id?: string
          created_at?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_control_account_id_fkey"
            columns: ["control_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vw_user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_accounts: {
        Row: {
          cached_balance: number
          cached_balance_at: string
          control_account_id: string
          created_at: string
          employee_id: string
          id: string
          updated_at: string
        }
        Insert: {
          cached_balance?: number
          cached_balance_at?: string
          control_account_id: string
          created_at?: string
          employee_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          cached_balance?: number
          cached_balance_at?: string
          control_account_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_accounts_control_account_id_fkey"
            columns: ["control_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "vw_user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_salaries: {
        Row: {
          base_salary: number
          created_at: string
          effective_from: string
          employee_id: string
          employee_type: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          base_salary: number
          created_at?: string
          effective_from?: string
          employee_id: string
          employee_type?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          effective_from?: string
          employee_id?: string
          employee_type?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_criteria: {
        Row: {
          age_group_id: string
          created_at: string | null
          description: string | null
          description_ar: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          key: string
          max_score: number
          name: string
          name_ar: string
          rubric_levels: Json
        }
        Insert: {
          age_group_id: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          key: string
          max_score: number
          name: string
          name_ar: string
          rubric_levels?: Json
        }
        Update: {
          age_group_id?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          key?: string
          max_score?: number
          name?: string
          name_ar?: string
          rubric_levels?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_live_progress: {
        Row: {
          answered_count: number
          current_question_index: number
          draft_answers: Json
          draft_updated_at: string | null
          draft_version: number
          id: string
          last_activity_at: string
          quiz_assignment_id: string
          started_at: string
          status: string
          student_id: string
          total_questions: number
        }
        Insert: {
          answered_count?: number
          current_question_index?: number
          draft_answers?: Json
          draft_updated_at?: string | null
          draft_version?: number
          id?: string
          last_activity_at?: string
          quiz_assignment_id: string
          started_at?: string
          status?: string
          student_id: string
          total_questions?: number
        }
        Update: {
          answered_count?: number
          current_question_index?: number
          draft_answers?: Json
          draft_updated_at?: string | null
          draft_version?: number
          id?: string
          last_activity_at?: string
          quiz_assignment_id?: string
          started_at?: string
          status?: string
          student_id?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_live_progress_quiz_assignment_id_fkey"
            columns: ["quiz_assignment_id"]
            isOneToOne: false
            referencedRelation: "quiz_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_live_progress_quiz_assignment_id_fkey"
            columns: ["quiz_assignment_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["quiz_assignment_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          description_ar: string | null
          expense_date: string
          financial_period_month: string
          id: string
          is_recurring: boolean
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          receipt_status: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url: string | null
          recorded_by: string
          transfer_type:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description: string
          description_ar?: string | null
          expense_date?: string
          financial_period_month?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          receipt_status?: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url?: string | null
          recorded_by: string
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          description_ar?: string | null
          expense_date?: string
          financial_period_month?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          receipt_status?: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url?: string | null
          recorded_by?: string
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Relationships: []
      }
      financial_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          period_month: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          review_started_at: string | null
          review_started_by: string | null
          status: Database["public"]["Enums"]["financial_period_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          period_month: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_started_at?: string | null
          review_started_by?: string | null
          status?: Database["public"]["Enums"]["financial_period_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          period_month?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_started_at?: string | null
          review_started_by?: string | null
          status?: Database["public"]["Enums"]["financial_period_status"]
          updated_at?: string
        }
        Relationships: []
      }
      group_level_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_session: number | null
          group_id: string
          id: string
          level_id: string
          started_at: string | null
          total_sessions: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_session?: number | null
          group_id: string
          id?: string
          level_id: string
          started_at?: string | null
          total_sessions?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_session?: number | null
          group_id?: string
          id?: string
          level_id?: string
          started_at?: string | null
          total_sessions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_level_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_level_progress_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      group_student_progress: {
        Row: {
          created_at: string | null
          current_level_id: string
          current_track_id: string | null
          exam_retry_count: number
          exam_scheduled_at: string | null
          exam_submitted_at: string | null
          graded_at: string | null
          group_id: string
          id: string
          level_completed_at: string | null
          level_started_at: string | null
          next_level_id: string | null
          notes: string | null
          outcome: string | null
          status: string
          status_changed_at: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_level_id: string
          current_track_id?: string | null
          exam_retry_count?: number
          exam_scheduled_at?: string | null
          exam_submitted_at?: string | null
          graded_at?: string | null
          group_id: string
          id?: string
          level_completed_at?: string | null
          level_started_at?: string | null
          next_level_id?: string | null
          notes?: string | null
          outcome?: string | null
          status?: string
          status_changed_at?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_level_id?: string
          current_track_id?: string | null
          exam_retry_count?: number
          exam_scheduled_at?: string | null
          exam_submitted_at?: string | null
          graded_at?: string | null
          group_id?: string
          id?: string
          level_completed_at?: string | null
          level_started_at?: string | null
          next_level_id?: string | null
          notes?: string | null
          outcome?: string | null
          status?: string
          status_changed_at?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_student_progress_current_level_id_fkey"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_student_progress_current_track_id_fkey"
            columns: ["current_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_student_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_student_progress_next_level_id_fkey"
            columns: ["next_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      group_students: {
        Row: {
          group_id: string
          id: string
          is_active: boolean | null
          joined_at: string
          student_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          student_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          age_group_id: string | null
          attendance_mode: string | null
          created_at: string
          duration_minutes: number
          group_type: Database["public"]["Enums"]["group_type"]
          has_started: boolean | null
          id: string
          instructor_id: string | null
          is_active: boolean | null
          last_delivered_content_number: number | null
          level_id: string | null
          level_status: string | null
          name: string
          name_ar: string
          owed_sessions_count: number | null
          schedule_day: string
          schedule_time: string
          session_link: string | null
          start_date: string | null
          starting_session_number: number | null
          status: string
          updated_at: string
        }
        Insert: {
          age_group_id?: string | null
          attendance_mode?: string | null
          created_at?: string
          duration_minutes?: number
          group_type?: Database["public"]["Enums"]["group_type"]
          has_started?: boolean | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          last_delivered_content_number?: number | null
          level_id?: string | null
          level_status?: string | null
          name: string
          name_ar: string
          owed_sessions_count?: number | null
          schedule_day: string
          schedule_time: string
          session_link?: string | null
          start_date?: string | null
          starting_session_number?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          age_group_id?: string | null
          attendance_mode?: string | null
          created_at?: string
          duration_minutes?: number
          group_type?: Database["public"]["Enums"]["group_type"]
          has_started?: boolean | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          last_delivered_content_number?: number | null
          level_id?: string | null
          level_status?: string | null
          name?: string
          name_ar?: string
          owed_sessions_count?: number | null
          schedule_day?: string
          schedule_time?: string
          session_link?: string | null
          start_date?: string | null
          starting_session_number?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_performance_metrics: {
        Row: {
          avg_grading_time_hours: number
          avg_reply_time_hours: number
          created_at: string
          id: string
          instructor_id: string
          month: string
          quality_score: number
          total_groups: number
          total_reminders: number
          total_students: number
          total_warnings: number
          updated_at: string
        }
        Insert: {
          avg_grading_time_hours?: number
          avg_reply_time_hours?: number
          created_at?: string
          id?: string
          instructor_id: string
          month: string
          quality_score?: number
          total_groups?: number
          total_reminders?: number
          total_students?: number
          total_warnings?: number
          updated_at?: string
        }
        Update: {
          avg_grading_time_hours?: number
          avg_reply_time_hours?: number
          created_at?: string
          id?: string
          instructor_id?: string
          month?: string
          quality_score?: number
          total_groups?: number
          total_reminders?: number
          total_students?: number
          total_warnings?: number
          updated_at?: string
        }
        Relationships: []
      }
      instructor_schedules: {
        Row: {
          created_at: string
          day_of_week: string
          end_time: string | null
          id: string
          instructor_id: string
          is_working_day: boolean
          notes: string | null
          notes_ar: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          end_time?: string | null
          id?: string
          instructor_id: string
          is_working_day?: boolean
          notes?: string | null
          notes_ar?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          end_time?: string | null
          id?: string
          instructor_id?: string
          is_working_day?: boolean
          notes?: string | null
          notes_ar?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instructor_warnings: {
        Row: {
          created_at: string | null
          id: string
          instructor_id: string
          is_active: boolean | null
          issued_by: string | null
          reason: string
          reason_ar: string | null
          reference_id: string | null
          reference_type: string | null
          resolved_at: string | null
          resolved_reason: string | null
          session_id: string | null
          severity: string
          updated_at: string
          warning_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instructor_id: string
          is_active?: boolean | null
          issued_by?: string | null
          reason: string
          reason_ar?: string | null
          reference_id?: string | null
          reference_type?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          session_id?: string | null
          severity?: string
          updated_at?: string
          warning_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instructor_id?: string
          is_active?: boolean | null
          issued_by?: string | null
          reason?: string
          reason_ar?: string | null
          reference_id?: string | null
          reference_type?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          session_id?: string | null
          severity?: string
          updated_at?: string
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_warnings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "instructor_warnings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_warnings_backup_20260418: {
        Row: {
          created_at: string | null
          id: string | null
          instructor_id: string | null
          is_active: boolean | null
          issued_by: string | null
          reason: string | null
          reason_ar: string | null
          reference_id: string | null
          reference_type: string | null
          resolved_at: string | null
          resolved_reason: string | null
          session_id: string | null
          severity: string | null
          updated_at: string | null
          warning_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          instructor_id?: string | null
          is_active?: boolean | null
          issued_by?: string | null
          reason?: string | null
          reason_ar?: string | null
          reference_id?: string | null
          reference_type?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          session_id?: string | null
          severity?: string | null
          updated_at?: string | null
          warning_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          instructor_id?: string | null
          is_active?: boolean | null
          issued_by?: string | null
          reason?: string | null
          reason_ar?: string | null
          reference_id?: string | null
          reference_type?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          session_id?: string | null
          severity?: string | null
          updated_at?: string | null
          warning_type?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          description_ar: string | null
          entry_date: string
          financial_period_month: string
          id: string
          posted_at: string | null
          posted_by: string | null
          reversal_of_entry_id: string | null
          reversed_by_entry_id: string | null
          source: Database["public"]["Enums"]["journal_source_type"]
          source_id: string | null
          status: Database["public"]["Enums"]["journal_entry_status"]
          total_credit: number
          total_debit: number
          updated_at: string
          voucher_no: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          description_ar?: string | null
          entry_date: string
          financial_period_month: string
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          reversal_of_entry_id?: string | null
          reversed_by_entry_id?: string | null
          source: Database["public"]["Enums"]["journal_source_type"]
          source_id?: string | null
          status?: Database["public"]["Enums"]["journal_entry_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
          voucher_no: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          description_ar?: string | null
          entry_date?: string
          financial_period_month?: string
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          reversal_of_entry_id?: string | null
          reversed_by_entry_id?: string | null
          source?: Database["public"]["Enums"]["journal_source_type"]
          source_id?: string | null
          status?: Database["public"]["Enums"]["journal_entry_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
          voucher_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_reversal_of_entry_id_fkey"
            columns: ["reversal_of_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_entry_id_fkey"
            columns: ["reversed_by_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          credit: number
          customer_account_id: string | null
          debit: number
          description: string | null
          employee_account_id: string | null
          financial_period_month: string
          id: string
          journal_entry_id: string
          line_no: number
          posted_at: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          customer_account_id?: string | null
          debit?: number
          description?: string | null
          employee_account_id?: string | null
          financial_period_month: string
          id?: string
          journal_entry_id: string
          line_no: number
          posted_at?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          customer_account_id?: string | null
          debit?: number
          description?: string | null
          employee_account_id?: string | null
          financial_period_month?: string
          id?: string
          journal_entry_id?: string
          line_no?: number
          posted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_employee_account_id_fkey"
            columns: ["employee_account_id"]
            isOneToOne: false
            referencedRelation: "employee_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_features: {
        Row: {
          created_at: string
          desc_ar: string
          desc_en: string
          icon_name: string
          id: string
          is_active: boolean
          sort_order: number
          title_ar: string
          title_en: string
        }
        Insert: {
          created_at?: string
          desc_ar?: string
          desc_en?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title_ar?: string
          title_en?: string
        }
        Update: {
          created_at?: string
          desc_ar?: string
          desc_en?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: []
      }
      landing_plan_benefits: {
        Row: {
          id: string
          plan_id: string
          sort_order: number
          text_ar: string
          text_en: string
        }
        Insert: {
          id?: string
          plan_id: string
          sort_order?: number
          text_ar?: string
          text_en?: string
        }
        Update: {
          id?: string
          plan_id?: string
          sort_order?: number
          text_ar?: string
          text_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_plan_benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "landing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_plans: {
        Row: {
          billing_period_ar: string
          billing_period_en: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          max_students: number | null
          mode: string
          name_ar: string
          name_en: string
          price_before_discount: number
          price_currency: string
          price_number: number
          price_online: number
          price_online_before_discount: number
          session_duration_minutes: number | null
          sessions_per_month: number | null
          slug: string | null
          sort_order: number
        }
        Insert: {
          billing_period_ar?: string
          billing_period_en?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          max_students?: number | null
          mode?: string
          name_ar?: string
          name_en?: string
          price_before_discount?: number
          price_currency?: string
          price_number?: number
          price_online?: number
          price_online_before_discount?: number
          session_duration_minutes?: number | null
          sessions_per_month?: number | null
          slug?: string | null
          sort_order?: number
        }
        Update: {
          billing_period_ar?: string
          billing_period_en?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          max_students?: number | null
          mode?: string
          name_ar?: string
          name_en?: string
          price_before_discount?: number
          price_currency?: string
          price_number?: number
          price_online?: number
          price_online_before_discount?: number
          session_duration_minutes?: number | null
          sessions_per_month?: number | null
          slug?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      landing_settings: {
        Row: {
          address_ar: string | null
          address_en: string | null
          cta_text_ar: string
          cta_text_en: string
          cta_url: string
          email: string | null
          footer_text_ar: string
          footer_text_en: string
          hero_subtitle_ar: string
          hero_subtitle_en: string
          hero_title_ar: string
          hero_title_en: string
          id: string
          logo_url: string | null
          phone: string | null
          social_links: Json
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          cta_text_ar?: string
          cta_text_en?: string
          cta_url?: string
          email?: string | null
          footer_text_ar?: string
          footer_text_en?: string
          hero_subtitle_ar?: string
          hero_subtitle_en?: string
          hero_title_ar?: string
          hero_title_en?: string
          id?: string
          logo_url?: string | null
          phone?: string | null
          social_links?: Json
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          cta_text_ar?: string
          cta_text_en?: string
          cta_url?: string
          email?: string | null
          footer_text_ar?: string
          footer_text_en?: string
          hero_subtitle_ar?: string
          hero_subtitle_en?: string
          hero_title_ar?: string
          hero_title_en?: string
          id?: string
          logo_url?: string | null
          phone?: string | null
          social_links?: Json
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      landing_track_groups: {
        Row: {
          age_group: string
          id: string
          intro_ar: string
          intro_en: string
          sort_order: number
          title_ar: string
          title_en: string
        }
        Insert: {
          age_group: string
          id?: string
          intro_ar?: string
          intro_en?: string
          sort_order?: number
          title_ar?: string
          title_en?: string
        }
        Update: {
          age_group?: string
          id?: string
          intro_ar?: string
          intro_en?: string
          sort_order?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: []
      }
      landing_track_steps: {
        Row: {
          desc_ar: string
          desc_en: string
          group_id: string
          id: string
          path_type: string
          specializations: Json | null
          step_number: number
          title_ar: string
          title_en: string
        }
        Insert: {
          desc_ar?: string
          desc_en?: string
          group_id: string
          id?: string
          path_type?: string
          specializations?: Json | null
          step_number: number
          title_ar?: string
          title_en?: string
        }
        Update: {
          desc_ar?: string
          desc_en?: string
          group_id?: string
          id?: string
          path_type?: string
          specializations?: Json | null
          step_number?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_track_steps_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "landing_track_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          end_date: string | null
          id: string
          parent_id: string
          reason: string
          request_date: string
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: string
          student_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          parent_id: string
          reason: string
          request_date: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
          student_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          parent_id?: string
          reason?: string
          request_date?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "leave_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      level_grades: {
        Row: {
          created_at: string | null
          evaluation_avg: number | null
          final_exam_score: number | null
          graded_by: string | null
          group_id: string
          id: string
          level_id: string
          notes: string | null
          outcome: string | null
          percentage: number | null
          student_id: string
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          evaluation_avg?: number | null
          final_exam_score?: number | null
          graded_by?: string | null
          group_id: string
          id?: string
          level_id: string
          notes?: string | null
          outcome?: string | null
          percentage?: number | null
          student_id: string
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          evaluation_avg?: number | null
          final_exam_score?: number | null
          graded_by?: string | null
          group_id?: string
          id?: string
          level_id?: string
          notes?: string | null
          outcome?: string | null
          percentage?: number | null
          student_id?: string
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "level_grades_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_grades_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          certificate_config: Json | null
          certificate_template_path: string | null
          created_at: string
          eval_weight: number
          exam_weight: number
          expected_sessions_count: number
          final_exam_quiz_id: string | null
          id: string
          is_active: boolean | null
          level_order: number
          min_exam_score: number
          name: string
          name_ar: string
          parent_level_id: string | null
          pass_threshold: number | null
          track: string | null
          track_id: string | null
          updated_at: string
        }
        Insert: {
          certificate_config?: Json | null
          certificate_template_path?: string | null
          created_at?: string
          eval_weight?: number
          exam_weight?: number
          expected_sessions_count?: number
          final_exam_quiz_id?: string | null
          id?: string
          is_active?: boolean | null
          level_order: number
          min_exam_score?: number
          name: string
          name_ar: string
          parent_level_id?: string | null
          pass_threshold?: number | null
          track?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          certificate_config?: Json | null
          certificate_template_path?: string | null
          created_at?: string
          eval_weight?: number
          exam_weight?: number
          expected_sessions_count?: number
          final_exam_quiz_id?: string | null
          id?: string
          is_active?: boolean | null
          level_order?: number
          min_exam_score?: number
          name?: string
          name_ar?: string
          parent_level_id?: string | null
          pass_threshold?: number | null
          track?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_final_exam_quiz_id_fkey"
            columns: ["final_exam_quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levels_parent_level_id_fkey"
            columns: ["parent_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levels_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_sessions: {
        Row: {
          assigned_instructor_id: string | null
          completed_at: string | null
          created_at: string
          curriculum_session_id: string | null
          group_id: string
          id: string
          is_free: boolean
          level_id: string | null
          makeup_type: string
          notes: string | null
          original_session_id: string | null
          reason: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          student_confirmed: boolean | null
          student_id: string
        }
        Insert: {
          assigned_instructor_id?: string | null
          completed_at?: string | null
          created_at?: string
          curriculum_session_id?: string | null
          group_id: string
          id?: string
          is_free?: boolean
          level_id?: string | null
          makeup_type?: string
          notes?: string | null
          original_session_id?: string | null
          reason: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          student_confirmed?: boolean | null
          student_id: string
        }
        Update: {
          assigned_instructor_id?: string | null
          completed_at?: string | null
          created_at?: string
          curriculum_session_id?: string | null
          group_id?: string
          id?: string
          is_free?: boolean
          level_id?: string | null
          makeup_type?: string
          notes?: string | null
          original_session_id?: string | null
          reason?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          student_confirmed?: boolean | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeup_sessions_curriculum_session_id_fkey"
            columns: ["curriculum_session_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_sessions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_sessions_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "makeup_sessions_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          age_group_id: string | null
          attendance_mode: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          level_id: string | null
          material_type: string
          original_filename: string | null
          subscription_type: string | null
          title: string
          title_ar: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          age_group_id?: string | null
          attendance_mode?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          file_type?: string
          file_url: string
          id?: string
          is_active?: boolean
          level_id?: string | null
          material_type?: string
          original_filename?: string | null
          subscription_type?: string | null
          title: string
          title_ar: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          age_group_id?: string | null
          attendance_mode?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          level_id?: string | null
          material_type?: string
          original_filename?: string | null
          subscription_type?: string | null
          title?: string
          title_ar?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          sender_id?: string
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
          action_url: string | null
          category: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          message_ar: string
          title: string
          title_ar: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          message_ar: string
          title: string
          title_ar: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          message_ar?: string
          title?: string
          title_ar?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      online_attendance_logs: {
        Row: {
          attendance_status_initial: string
          created_at: string
          first_joined_at: string
          group_id: string
          heartbeat_count: number
          id: string
          last_seen_at: string
          session_id: string
          status: string
          student_id: string
        }
        Insert: {
          attendance_status_initial: string
          created_at?: string
          first_joined_at?: string
          group_id: string
          heartbeat_count?: number
          id?: string
          last_seen_at?: string
          session_id: string
          status?: string
          student_id: string
        }
        Update: {
          attendance_status_initial?: string
          created_at?: string
          first_joined_at?: string
          group_id?: string
          heartbeat_count?: number
          id?: string
          last_seen_at?: string
          session_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_attendance_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_attendance_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "online_attendance_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_link_audit: {
        Row: {
          action: string
          code_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          parent_id: string
          student_id: string
        }
        Insert: {
          action: string
          code_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          parent_id: string
          student_id: string
        }
        Update: {
          action?: string
          code_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_link_audit_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "parent_link_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_link_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          student_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          student_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          student_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relationship?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          created_at: string
          gl_account_id: string
          id: string
          is_active: boolean
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          transfer_type:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Insert: {
          created_at?: string
          gl_account_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Update: {
          created_at?: string
          gl_account_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          financial_period_month: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_type: string
          receipt_status: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url: string | null
          recorded_by: string
          student_id: string
          subscription_id: string
          transfer_type:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Insert: {
          amount: number
          created_at?: string
          financial_period_month?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_type?: string
          receipt_status?: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url?: string | null
          recorded_by: string
          student_id: string
          subscription_id: string
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Update: {
          amount?: number
          created_at?: string
          financial_period_month?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_type?: string
          receipt_status?: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url?: string | null
          recorded_by?: string
          student_id?: string
          subscription_id?: string
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
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
      payroll_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["payroll_adjustment_type"]
          amount: number
          applied_in_period: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          employee_id: string
          id: string
          payroll_run_id: string | null
          payroll_run_line_id: string | null
          reason: string
          reason_ar: string | null
          status: string
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["payroll_adjustment_type"]
          amount: number
          applied_in_period: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          employee_id: string
          id?: string
          payroll_run_id?: string | null
          payroll_run_line_id?: string | null
          reason: string
          reason_ar?: string | null
          status?: string
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["payroll_adjustment_type"]
          amount?: number
          applied_in_period?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
          payroll_run_id?: string | null
          payroll_run_line_id?: string | null
          reason?: string
          reason_ar?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_payroll_run_line_id_fkey"
            columns: ["payroll_run_line_id"]
            isOneToOne: false
            referencedRelation: "payroll_run_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_run_lines: {
        Row: {
          base_salary: number
          created_at: string
          employee_id: string
          employee_type: string
          id: string
          net_amount: number
          notes: string | null
          payroll_run_id: string
          salary_payment_id: string | null
          total_bonuses: number
          total_deductions: number
        }
        Insert: {
          base_salary: number
          created_at?: string
          employee_id: string
          employee_type: string
          id?: string
          net_amount: number
          notes?: string | null
          payroll_run_id: string
          salary_payment_id?: string | null
          total_bonuses?: number
          total_deductions?: number
        }
        Update: {
          base_salary?: number
          created_at?: string
          employee_id?: string
          employee_type?: string
          id?: string
          net_amount?: number
          notes?: string | null
          payroll_run_id?: string
          salary_payment_id?: string | null
          total_bonuses?: number
          total_deductions?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_run_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          employee_count: number
          employee_group: Database["public"]["Enums"]["payroll_employee_group"]
          id: string
          notes: string | null
          paid_at: string | null
          period_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payroll_run_status"]
          total_bonuses: number
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          employee_count?: number
          employee_group?: Database["public"]["Enums"]["payroll_employee_group"]
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_run_status"]
          total_bonuses?: number
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          employee_count?: number
          employee_group?: Database["public"]["Enums"]["payroll_employee_group"]
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_run_status"]
          total_bonuses?: number
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: []
      }
      performance_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          instructor_id: string
          is_archived: boolean
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          instructor_id: string
          is_archived?: boolean
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          instructor_id?: string
          is_archived?: boolean
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      placement_v2_attempt_questions: {
        Row: {
          attempt_id: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          order_index: number
          question_id: number
          section: string
          section_skill: string
          student_answer: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          order_index: number
          question_id: number
          section: string
          section_skill: string
          student_answer?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          order_index?: number
          question_id?: number
          section?: string
          section_skill?: string
          student_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placement_v2_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "placement_v2_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_v2_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "placement_v2_student_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_v2_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "placement_v2_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_v2_attempts: {
        Row: {
          approved_level_id: string | null
          attempt_number: number
          confidence_level: string | null
          created_at: string | null
          id: string
          needs_manual_review: boolean | null
          recommended_level_id: string | null
          recommended_track: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_id: string | null
          section_a_max: number | null
          section_a_passed: boolean | null
          section_a_score: number | null
          section_b_max: number | null
          section_b_passed: boolean | null
          section_b_score: number | null
          section_c_hardware_max: number | null
          section_c_hardware_score: number | null
          section_c_software_max: number | null
          section_c_software_score: number | null
          started_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          approved_level_id?: string | null
          attempt_number?: number
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          needs_manual_review?: boolean | null
          recommended_level_id?: string | null
          recommended_track?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string | null
          section_a_max?: number | null
          section_a_passed?: boolean | null
          section_a_score?: number | null
          section_b_max?: number | null
          section_b_passed?: boolean | null
          section_b_score?: number | null
          section_c_hardware_max?: number | null
          section_c_hardware_score?: number | null
          section_c_software_max?: number | null
          section_c_software_score?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          approved_level_id?: string | null
          attempt_number?: number
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          needs_manual_review?: boolean | null
          recommended_level_id?: string | null
          recommended_track?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string | null
          section_a_max?: number | null
          section_a_passed?: boolean | null
          section_a_score?: number | null
          section_b_max?: number | null
          section_b_passed?: boolean | null
          section_b_score?: number | null
          section_c_hardware_max?: number | null
          section_c_hardware_score?: number | null
          section_c_software_max?: number | null
          section_c_software_score?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placement_v2_attempts_approved_level_id_fkey"
            columns: ["approved_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_v2_attempts_recommended_level_id_fkey"
            columns: ["recommended_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_v2_attempts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "placement_v2_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_v2_questions: {
        Row: {
          code_snippet: string | null
          correct_answer: string
          created_at: string | null
          difficulty: string
          explanation_ar: string | null
          id: number
          image_url: string | null
          is_active: boolean
          is_archived: boolean
          options: Json
          question_text_ar: string
          review_status: string
          section: string
          skill: string
          success_rate: number
          track_category: string | null
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          code_snippet?: string | null
          correct_answer: string
          created_at?: string | null
          difficulty?: string
          explanation_ar?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean
          is_archived?: boolean
          options: Json
          question_text_ar: string
          review_status?: string
          section: string
          skill: string
          success_rate?: number
          track_category?: string | null
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          code_snippet?: string | null
          correct_answer?: string
          created_at?: string | null
          difficulty?: string
          explanation_ar?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean
          is_archived?: boolean
          options?: Json
          question_text_ar?: string
          review_status?: string
          section?: string
          skill?: string
          success_rate?: number
          track_category?: string | null
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: []
      }
      placement_v2_schedules: {
        Row: {
          closes_at: string
          created_at: string | null
          id: string
          notes: string | null
          opens_at: string
          scheduled_by: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          closes_at: string
          created_at?: string | null
          id?: string
          notes?: string | null
          opens_at: string
          scheduled_by: string
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          closes_at?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          opens_at?: string
          scheduled_by?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      placement_v2_settings: {
        Row: {
          allow_retake: boolean
          created_at: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          max_attempts: number
          pass_threshold_section_a: number
          pass_threshold_section_b: number
          section_a_question_count: number
          section_b_question_count: number
          section_c_question_count: number
          track_margin: number
          updated_at: string | null
        }
        Insert: {
          allow_retake?: boolean
          created_at?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_attempts?: number
          pass_threshold_section_a?: number
          pass_threshold_section_b?: number
          section_a_question_count?: number
          section_b_question_count?: number
          section_c_question_count?: number
          track_margin?: number
          updated_at?: string | null
        }
        Update: {
          allow_retake?: boolean
          created_at?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_attempts?: number
          pass_threshold_section_a?: number
          pass_threshold_section_b?: number
          section_a_question_count?: number
          section_b_question_count?: number
          section_c_question_count?: number
          track_margin?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          attendance_mode: string
          created_at: string
          discount_percentage: number
          group_type: Database["public"]["Enums"]["group_type"]
          id: string
          is_active: boolean
          max_students: number
          min_students: number
          name: string
          name_ar: string
          price_1_month: number
          price_3_months: number
          price_before_discount: number
          updated_at: string
        }
        Insert: {
          attendance_mode?: string
          created_at?: string
          discount_percentage?: number
          group_type: Database["public"]["Enums"]["group_type"]
          id?: string
          is_active?: boolean
          max_students?: number
          min_students?: number
          name: string
          name_ar: string
          price_1_month: number
          price_3_months: number
          price_before_discount: number
          updated_at?: string
        }
        Update: {
          attendance_mode?: string
          created_at?: string
          discount_percentage?: number
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          is_active?: boolean
          max_students?: number
          min_students?: number
          name?: string
          name_ar?: string
          price_1_month?: number
          price_3_months?: number
          price_before_discount?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_group_id: string | null
          attendance_mode: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          employment_status:
            | Database["public"]["Enums"]["employment_status"]
            | null
          full_name: string
          full_name_ar: string | null
          hourly_rate: number | null
          id: string
          is_approved: boolean | null
          is_paid_trainee: boolean | null
          level_id: string | null
          needs_renewal: boolean | null
          phone: string | null
          specialization: string | null
          specialization_ar: string | null
          subscription_type:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          updated_at: string
          user_id: string
          work_type: string | null
        }
        Insert: {
          age_group_id?: string | null
          attendance_mode?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          employment_status?:
            | Database["public"]["Enums"]["employment_status"]
            | null
          full_name: string
          full_name_ar?: string | null
          hourly_rate?: number | null
          id?: string
          is_approved?: boolean | null
          is_paid_trainee?: boolean | null
          level_id?: string | null
          needs_renewal?: boolean | null
          phone?: string | null
          specialization?: string | null
          specialization_ar?: string | null
          subscription_type?:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id: string
          work_type?: string | null
        }
        Update: {
          age_group_id?: string | null
          attendance_mode?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          employment_status?:
            | Database["public"]["Enums"]["employment_status"]
            | null
          full_name?: string
          full_name_ar?: string | null
          hourly_rate?: number | null
          id?: string
          is_approved?: boolean | null
          is_paid_trainee?: boolean | null
          level_id?: string | null
          needs_renewal?: boolean | null
          phone?: string | null
          specialization?: string | null
          specialization_ar?: string | null
          subscription_type?:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_assignment_overrides: {
        Row: {
          created_at: string
          due_date: string | null
          extra_minutes: number
          id: string
          makeup_session_id: string | null
          quiz_assignment_id: string
          source: string
          start_time: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          extra_minutes?: number
          id?: string
          makeup_session_id?: string | null
          quiz_assignment_id: string
          source?: string
          start_time?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          extra_minutes?: number
          id?: string
          makeup_session_id?: string | null
          quiz_assignment_id?: string
          source?: string
          start_time?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_assignment_overrides_makeup_session_id_fkey"
            columns: ["makeup_session_id"]
            isOneToOne: false
            referencedRelation: "makeup_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignment_overrides_quiz_assignment_id_fkey"
            columns: ["quiz_assignment_id"]
            isOneToOne: false
            referencedRelation: "quiz_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignment_overrides_quiz_assignment_id_fkey"
            columns: ["quiz_assignment_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["quiz_assignment_id"]
          },
        ]
      }
      quiz_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          curriculum_snapshot: Json | null
          due_date: string | null
          extra_minutes: number
          group_id: string | null
          id: string
          is_active: boolean | null
          is_auto_generated: boolean
          quiz_id: string
          session_id: string | null
          start_time: string | null
          student_id: string | null
        }
        Insert: {
          assigned_by: string
          created_at?: string
          curriculum_snapshot?: Json | null
          due_date?: string | null
          extra_minutes?: number
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean
          quiz_id: string
          session_id?: string | null
          start_time?: string | null
          student_id?: string | null
        }
        Update: {
          assigned_by?: string
          created_at?: string
          curriculum_snapshot?: Json | null
          due_date?: string | null
          extra_minutes?: number
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean
          quiz_id?: string
          session_id?: string | null
          start_time?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignments_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "quiz_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_attempts: {
        Row: {
          answer: string | null
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          grading_status: string
          id: string
          is_correct: boolean | null
          is_correct_auto: boolean | null
          is_correct_final: boolean | null
          manual_override_at: string | null
          manual_override_by: string | null
          max_score: number
          override_reason_code:
            | Database["public"]["Enums"]["manual_override_reason"]
            | null
          override_reason_note: string | null
          question_id: string
          score: number | null
          student_id: string
          submission_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          is_correct?: boolean | null
          is_correct_auto?: boolean | null
          is_correct_final?: boolean | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          max_score?: number
          override_reason_code?:
            | Database["public"]["Enums"]["manual_override_reason"]
            | null
          override_reason_note?: string | null
          question_id: string
          score?: number | null
          student_id: string
          submission_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          is_correct?: boolean | null
          is_correct_auto?: boolean | null
          is_correct_final?: boolean | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          max_score?: number
          override_reason_code?:
            | Database["public"]["Enums"]["manual_override_reason"]
            | null
          override_reason_note?: string | null
          question_id?: string
          score?: number | null
          student_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions_student_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_attempts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          code_snippet: string | null
          correct_answer: string | null
          created_at: string
          id: string
          image_url: string | null
          model_answer: string | null
          options: Json | null
          order_index: number
          points: number
          question_text: string
          question_text_ar: string
          question_type: string
          quiz_id: string
          rubric: Json | null
        }
        Insert: {
          code_snippet?: string | null
          correct_answer?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          model_answer?: string | null
          options?: Json | null
          order_index?: number
          points?: number
          question_text: string
          question_text_ar: string
          question_type?: string
          quiz_id: string
          rubric?: Json | null
        }
        Update: {
          code_snippet?: string | null
          correct_answer?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          model_answer?: string | null
          options?: Json | null
          order_index?: number
          points?: number
          question_text?: string
          question_text_ar?: string
          question_type?: string
          quiz_id?: string
          rubric?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submission_audit: {
        Row: {
          created_at: string
          grading_audit: Json
          id: string
          questions_full_snapshot: Json
          quiz_version_id: string | null
          schema_version: number
          submission_id: string
        }
        Insert: {
          created_at?: string
          grading_audit?: Json
          id?: string
          questions_full_snapshot: Json
          quiz_version_id?: string | null
          schema_version?: number
          submission_id: string
        }
        Update: {
          created_at?: string
          grading_audit?: Json
          id?: string
          questions_full_snapshot?: Json
          quiz_version_id?: string | null
          schema_version?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submission_audit_quiz_version_id_fkey"
            columns: ["quiz_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submission_audit_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "quiz_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submissions: {
        Row: {
          answers: Json
          graded_at: string | null
          graded_by: string | null
          grading_status: string
          id: string
          is_auto_generated: boolean
          manual_score: number | null
          max_score: number | null
          percentage: number | null
          questions_snapshot: Json | null
          quiz_assignment_id: string
          quiz_version_id: string | null
          score: number | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          answers: Json
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          is_auto_generated?: boolean
          manual_score?: number | null
          max_score?: number | null
          percentage?: number | null
          questions_snapshot?: Json | null
          quiz_assignment_id: string
          quiz_version_id?: string | null
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          answers?: Json
          graded_at?: string | null
          graded_by?: string | null
          grading_status?: string
          id?: string
          is_auto_generated?: boolean
          manual_score?: number | null
          max_score?: number | null
          percentage?: number | null
          questions_snapshot?: Json | null
          quiz_assignment_id?: string
          quiz_version_id?: string | null
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_quiz_assignment_id_fkey"
            columns: ["quiz_assignment_id"]
            isOneToOne: false
            referencedRelation: "quiz_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_quiz_assignment_id_fkey"
            columns: ["quiz_assignment_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["quiz_assignment_id"]
          },
          {
            foreignKeyName: "quiz_submissions_quiz_version_id_fkey"
            columns: ["quiz_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_versions: {
        Row: {
          content_hash: string | null
          created_at: string
          created_by: string | null
          grading_schema_version: number
          id: string
          question_order: string[] | null
          questions_full: Json
          questions_safe: Json
          quiz_config: Json
          quiz_id: string
          schema_version: number
          scoring_rules: Json
          time_limit_minutes: number | null
          version_number: number
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          grading_schema_version?: number
          id?: string
          question_order?: string[] | null
          questions_full: Json
          questions_safe: Json
          quiz_config: Json
          quiz_id: string
          schema_version?: number
          scoring_rules?: Json
          time_limit_minutes?: number | null
          version_number: number
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          grading_schema_version?: number
          id?: string
          question_order?: string[] | null
          questions_full?: Json
          questions_safe?: Json
          quiz_config?: Json
          quiz_id?: string
          schema_version?: number
          scoring_rules?: Json
          time_limit_minutes?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_versions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          age_group_id: string | null
          created_at: string
          created_by: string
          description: string | null
          description_ar: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          is_auto_generated: boolean
          level_id: string | null
          passing_score: number
          title: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          age_group_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          description_ar?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean
          level_id?: string | null
          passing_score?: number
          title: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          age_group_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          description_ar?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean
          level_id?: string | null
          passing_score?: number
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_events: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          description_ar: string | null
          employee_id: string
          event_type: string
          id: string
          is_reversal: boolean
          metadata: Json
          month: string
          reference_id: string | null
          reversed_event_id: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          employee_id: string
          event_type: string
          id?: string
          is_reversal?: boolean
          metadata?: Json
          month: string
          reference_id?: string | null
          reversed_event_id?: string | null
          source: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          employee_id?: string
          event_type?: string
          id?: string
          is_reversal?: boolean
          metadata?: Json
          month?: string
          reference_id?: string | null
          reversed_event_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_events_reversed_event_id_fkey"
            columns: ["reversed_event_id"]
            isOneToOne: false
            referencedRelation: "salary_events"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_month_snapshots: {
        Row: {
          base_amount: number
          employee_id: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          month: string
          net_amount: number
          status: string
          total_bonuses: number
          total_deductions: number
          total_earnings: number
          updated_at: string
        }
        Insert: {
          base_amount?: number
          employee_id: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          month: string
          net_amount?: number
          status?: string
          total_bonuses?: number
          total_deductions?: number
          total_earnings?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          employee_id?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          month?: string
          net_amount?: number
          status?: string
          total_bonuses?: number
          total_deductions?: number
          total_earnings?: number
          updated_at?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          base_amount: number
          bonus: number
          bonus_reason: string | null
          bonus_reason_ar: string | null
          created_at: string
          deduction_reason: string | null
          deduction_reason_ar: string | null
          deductions: number
          employee_id: string
          financial_period_month: string
          id: string
          month: string
          net_amount: number | null
          notes: string | null
          paid_by: string | null
          paid_date: string | null
          payment_method: string | null
          receipt_status: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url: string | null
          salary_id: string | null
          status: string
          transfer_type:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Insert: {
          base_amount?: number
          bonus?: number
          bonus_reason?: string | null
          bonus_reason_ar?: string | null
          created_at?: string
          deduction_reason?: string | null
          deduction_reason_ar?: string | null
          deductions?: number
          employee_id: string
          financial_period_month?: string
          id?: string
          month: string
          net_amount?: number | null
          notes?: string | null
          paid_by?: string | null
          paid_date?: string | null
          payment_method?: string | null
          receipt_status?: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url?: string | null
          salary_id?: string | null
          status?: string
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Update: {
          base_amount?: number
          bonus?: number
          bonus_reason?: string | null
          bonus_reason_ar?: string | null
          created_at?: string
          deduction_reason?: string | null
          deduction_reason_ar?: string | null
          deductions?: number
          employee_id?: string
          financial_period_month?: string
          id?: string
          month?: string
          net_amount?: number | null
          notes?: string | null
          paid_by?: string | null
          paid_date?: string | null
          payment_method?: string | null
          receipt_status?: Database["public"]["Enums"]["receipt_status_type"]
          receipt_url?: string | null
          salary_id?: string | null
          status?: string
          transfer_type?:
            | Database["public"]["Enums"]["transfer_method_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_salary_id_fkey"
            columns: ["salary_id"]
            isOneToOne: false
            referencedRelation: "employee_salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_themes: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          start_date: string
          theme_key: string
          timezone: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          start_date: string
          theme_key: string
          timezone?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          start_date?: string
          theme_key?: string
          timezone?: string
        }
        Relationships: []
      }
      security_violations: {
        Row: {
          attempted_by_role: string | null
          attempted_by_user: string | null
          created_at: string
          details: Json | null
          id: string
          operation: string
          query_snippet: string | null
          table_name: string
          violation_type: string
        }
        Insert: {
          attempted_by_role?: string | null
          attempted_by_user?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          operation: string
          query_snippet?: string | null
          table_name: string
          violation_type: string
        }
        Update: {
          attempted_by_role?: string | null
          attempted_by_user?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          operation?: string
          query_snippet?: string | null
          table_name?: string
          violation_type?: string
        }
        Relationships: []
      }
      session_cancellation_logs: {
        Row: {
          cancelled_at: string
          cancelled_by: string | null
          closure_id: string
          id: string
          notification_sent: boolean
          notification_sent_at: string | null
          replacement_session_id: string | null
          session_id: string
        }
        Insert: {
          cancelled_at?: string
          cancelled_by?: string | null
          closure_id: string
          id?: string
          notification_sent?: boolean
          notification_sent_at?: string | null
          replacement_session_id?: string | null
          session_id: string
        }
        Update: {
          cancelled_at?: string
          cancelled_by?: string | null
          closure_id?: string
          id?: string
          notification_sent?: boolean
          notification_sent_at?: string | null
          replacement_session_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_cancellation_logs_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "academy_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cancellation_logs_replacement_session_id_fkey"
            columns: ["replacement_session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_cancellation_logs_replacement_session_id_fkey"
            columns: ["replacement_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cancellation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_cancellation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_evaluations: {
        Row: {
          assignment_max_score: number | null
          assignment_score: number | null
          created_at: string | null
          criteria_snapshot: Json
          evaluated_by: string
          id: string
          max_behavior_score: number
          max_total_score: number | null
          notes: string | null
          percentage: number | null
          quiz_max_score: number | null
          quiz_score: number | null
          scores: Json
          session_id: string
          student_feedback_tags: string[] | null
          student_id: string
          total_behavior_score: number
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          assignment_max_score?: number | null
          assignment_score?: number | null
          created_at?: string | null
          criteria_snapshot: Json
          evaluated_by: string
          id?: string
          max_behavior_score?: number
          max_total_score?: number | null
          notes?: string | null
          percentage?: number | null
          quiz_max_score?: number | null
          quiz_score?: number | null
          scores: Json
          session_id: string
          student_feedback_tags?: string[] | null
          student_id: string
          total_behavior_score?: number
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          assignment_max_score?: number | null
          assignment_score?: number | null
          created_at?: string | null
          criteria_snapshot?: Json
          evaluated_by?: string
          id?: string
          max_behavior_score?: number
          max_total_score?: number | null
          notes?: string | null
          percentage?: number | null
          quiz_max_score?: number | null
          quiz_score?: number | null
          scores?: Json
          session_id?: string
          student_feedback_tags?: string[] | null
          student_id?: string
          total_behavior_score?: number
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_staff_attendance: {
        Row: {
          actual_hours: number
          created_at: string
          id: string
          session_id: string
          staff_id: string
          status: string
        }
        Insert: {
          actual_hours: number
          created_at?: string
          id?: string
          session_id: string
          staff_id: string
          status?: string
        }
        Update: {
          actual_hours?: number
          created_at?: string
          id?: string
          session_id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_staff_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_staff_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          attendance_mode: string | null
          cancellation_reason: string | null
          content_number: number | null
          created_at: string
          duration_minutes: number
          group_id: string
          id: string
          is_makeup: boolean
          last_compliance_scan_at: string | null
          level_id: string | null
          makeup_session_id: string | null
          notes: string | null
          session_date: string
          session_link: string | null
          session_number: number | null
          session_time: string
          status: string
          topic: string | null
          topic_ar: string | null
          updated_at: string
        }
        Insert: {
          attendance_mode?: string | null
          cancellation_reason?: string | null
          content_number?: number | null
          created_at?: string
          duration_minutes?: number
          group_id: string
          id?: string
          is_makeup?: boolean
          last_compliance_scan_at?: string | null
          level_id?: string | null
          makeup_session_id?: string | null
          notes?: string | null
          session_date: string
          session_link?: string | null
          session_number?: number | null
          session_time: string
          status?: string
          topic?: string | null
          topic_ar?: string | null
          updated_at?: string
        }
        Update: {
          attendance_mode?: string | null
          cancellation_reason?: string | null
          content_number?: number | null
          created_at?: string
          duration_minutes?: number
          group_id?: string
          id?: string
          is_makeup?: boolean
          last_compliance_scan_at?: string | null
          level_id?: string | null
          makeup_session_id?: string | null
          notes?: string | null
          session_date?: string
          session_link?: string | null
          session_number?: number | null
          session_time?: string
          status?: string
          topic?: string | null
          topic_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_makeup_session_id_fkey"
            columns: ["makeup_session_id"]
            isOneToOne: true
            referencedRelation: "makeup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          student_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          student_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      student_certificates: {
        Row: {
          certificate_code: string
          created_at: string
          error_message: string | null
          group_id: string
          id: string
          issued_at: string | null
          level_id: string
          level_name_snapshot: string
          printed_at: string | null
          printed_by: string | null
          retry_count: number
          status: string
          storage_path: string | null
          student_id: string
          student_name_snapshot: string
          updated_at: string
        }
        Insert: {
          certificate_code?: string
          created_at?: string
          error_message?: string | null
          group_id: string
          id?: string
          issued_at?: string | null
          level_id: string
          level_name_snapshot: string
          printed_at?: string | null
          printed_by?: string | null
          retry_count?: number
          status?: string
          storage_path?: string | null
          student_id: string
          student_name_snapshot: string
          updated_at?: string
        }
        Update: {
          certificate_code?: string
          created_at?: string
          error_message?: string | null
          group_id?: string
          id?: string
          issued_at?: string | null
          level_id?: string
          level_name_snapshot?: string
          printed_at?: string | null
          printed_by?: string | null
          retry_count?: number
          status?: string
          storage_path?: string | null
          student_id?: string
          student_name_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_certificates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_certificates_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      student_level_transitions: {
        Row: {
          created_at: string | null
          created_by: string
          from_level_id: string
          group_id: string
          id: string
          reason: string | null
          student_id: string
          to_level_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          from_level_id: string
          group_id: string
          id?: string
          reason?: string | null
          student_id: string
          to_level_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          from_level_id?: string
          group_id?: string
          id?: string
          reason?: string | null
          student_id?: string
          to_level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_level_transitions_from_level_id_fkey"
            columns: ["from_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_level_transitions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_level_transitions_to_level_id_fkey"
            columns: ["to_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      student_makeup_credits: {
        Row: {
          created_at: string
          id: string
          level_id: string
          student_id: string
          total_free_allowed: number
          updated_at: string
          used_free: number
        }
        Insert: {
          created_at?: string
          id?: string
          level_id: string
          student_id: string
          total_free_allowed?: number
          updated_at?: string
          used_free?: number
        }
        Update: {
          created_at?: string
          id?: string
          level_id?: string
          student_id?: string
          total_free_allowed?: number
          updated_at?: string
          used_free?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_makeup_credits_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      student_streaks: {
        Row: {
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          student_id: string
          updated_at: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_track_choices: {
        Row: {
          chosen_at: string | null
          chosen_by: string
          chosen_track_id: string
          created_at: string | null
          from_level_id: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          chosen_at?: string | null
          chosen_by: string
          chosen_track_id: string
          created_at?: string | null
          from_level_id: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          chosen_at?: string | null
          chosen_by?: string
          chosen_track_id?: string
          created_at?: string | null
          from_level_id?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_track_choices_chosen_track_id_fkey"
            columns: ["chosen_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_track_choices_from_level_id_fkey"
            columns: ["from_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_track_choices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      student_xp_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          level_id: string | null
          reference_id: string | null
          student_id: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          level_id?: string | null
          reference_id?: string | null
          student_id: string
          xp_amount: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          level_id?: string | null
          reference_id?: string | null
          student_id?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_xp_events_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_requests: {
        Row: {
          amount_cents: number | null
          attendance_mode: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          paymob_order_id: string | null
          phone: string
          plan_id: string | null
          status: string
        }
        Insert: {
          amount_cents?: number | null
          attendance_mode?: string
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          paymob_order_id?: string | null
          phone: string
          plan_id?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number | null
          attendance_mode?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          paymob_order_id?: string | null
          phone?: string
          plan_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "landing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          discount_percentage: number
          end_date: string | null
          id: string
          installment_amount: number | null
          is_suspended: boolean
          level_id: string | null
          next_payment_date: string | null
          notes: string | null
          paid_amount: number
          payment_type: string
          pricing_plan_id: string | null
          remaining_amount: number | null
          start_date: string | null
          status: string
          student_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number
          end_date?: string | null
          id?: string
          installment_amount?: number | null
          is_suspended?: boolean
          level_id?: string | null
          next_payment_date?: string | null
          notes?: string | null
          paid_amount?: number
          payment_type?: string
          pricing_plan_id?: string | null
          remaining_amount?: number | null
          start_date?: string | null
          status?: string
          student_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number
          end_date?: string | null
          id?: string
          installment_amount?: number | null
          is_suspended?: boolean
          level_id?: string | null
          next_payment_date?: string | null
          notes?: string | null
          paid_amount?: number
          payment_type?: string
          pricing_plan_id?: string | null
          remaining_amount?: number | null
          start_date?: string | null
          status?: string
          student_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          avg_execution_time_ms: number
          created_at: string
          date: string
          errors_count: number
          id: string
          total_deductions: number
          total_reminders: number
          total_warnings: number
        }
        Insert: {
          avg_execution_time_ms?: number
          created_at?: string
          date: string
          errors_count?: number
          id?: string
          total_deductions?: number
          total_reminders?: number
          total_warnings?: number
        }
        Update: {
          avg_execution_time_ms?: number
          created_at?: string
          date?: string
          errors_count?: number
          id?: string
          total_deductions?: number
          total_reminders?: number
          total_warnings?: number
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          content_ar: string | null
          content_en: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          parent_id: string | null
          parent_name: string
          parent_name_ar: string | null
          rating: number
          show_on_landing: boolean | null
          sort_order: number | null
        }
        Insert: {
          content_ar?: string | null
          content_en?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          parent_id?: string | null
          parent_name: string
          parent_name_ar?: string | null
          rating?: number
          show_on_landing?: boolean | null
          sort_order?: number | null
        }
        Update: {
          content_ar?: string | null
          content_en?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          parent_id?: string | null
          parent_name?: string
          parent_name_ar?: string | null
          rating?: number
          show_on_landing?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      tracks: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
      warning_deduction_rules: {
        Row: {
          action: string
          created_at: string
          deduction_amount: number
          id: string
          is_active: boolean
          severity: string
          updated_at: string
          version: number
          warning_count: number
          warning_type: string
        }
        Insert: {
          action?: string
          created_at?: string
          deduction_amount?: number
          id?: string
          is_active?: boolean
          severity?: string
          updated_at?: string
          version?: number
          warning_count?: number
          warning_type: string
        }
        Update: {
          action?: string
          created_at?: string
          deduction_amount?: number
          id?: string
          is_active?: boolean
          severity?: string
          updated_at?: string
          version?: number
          warning_count?: number
          warning_type?: string
        }
        Relationships: []
      }
      warnings: {
        Row: {
          assignment_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          issued_by: string
          reason: string
          reason_ar: string | null
          student_id: string
          warning_type: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          issued_by: string
          reason: string
          reason_ar?: string | null
          student_id: string
          warning_type?: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          issued_by?: string
          reason?: string
          reason_ar?: string | null
          student_id?: string
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "warnings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warnings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["assignment_id"]
          },
        ]
      }
    }
    Views: {
      curriculum_overview_latest: {
        Row: {
          age_group_id: string | null
          completion_percentage: number | null
          expected_sessions_count: number | null
          filled_sessions: number | null
          is_published: boolean | null
          latest_version: number | null
          level_id: string | null
          published_at: string | null
          total_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_sessions_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_sessions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      final_exam_candidates: {
        Row: {
          avatar_url: string | null
          current_level_id: string | null
          exam_retry_count: number | null
          exam_scheduled_at: string | null
          exam_submitted_at: string | null
          final_exam_quiz_id: string | null
          full_name: string | null
          full_name_ar: string | null
          graded_at: string | null
          group_id: string | null
          group_name: string | null
          group_name_ar: string | null
          level_name: string | null
          level_name_ar: string | null
          outcome: string | null
          progress_id: string | null
          status: string | null
          status_changed_at: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_student_progress_current_level_id_fkey"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_student_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levels_final_exam_quiz_id_fkey"
            columns: ["final_exam_quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_account_balances_monthly: {
        Row: {
          account_id: string | null
          last_activity_at: string | null
          line_count: number | null
          net_balance: number | null
          period_month: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_v2_student_view: {
        Row: {
          attempt_number: number | null
          created_at: string | null
          final_level_id: string | null
          id: string | null
          needs_manual_review: boolean | null
          result_available: boolean | null
          section_a_max: number | null
          section_a_score: number | null
          section_b_max: number | null
          section_b_score: number | null
          started_at: string | null
          status: string | null
          student_id: string | null
          submitted_at: string | null
        }
        Insert: {
          attempt_number?: number | null
          created_at?: string | null
          final_level_id?: never
          id?: string | null
          needs_manual_review?: boolean | null
          result_available?: never
          section_a_max?: never
          section_a_score?: never
          section_b_max?: never
          section_b_score?: never
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          attempt_number?: number | null
          created_at?: string | null
          final_level_id?: never
          id?: string | null
          needs_manual_review?: boolean | null
          result_available?: never
          section_a_max?: never
          section_a_score?: never
          section_b_max?: never
          section_b_score?: never
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
        }
        Relationships: []
      }
      quiz_questions_student_view: {
        Row: {
          code_snippet: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          options: Json | null
          order_index: number | null
          points: number | null
          question_text: string | null
          question_text_ar: string | null
          question_type: string | null
          quiz_id: string | null
        }
        Insert: {
          code_snippet?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text?: string | null
          question_text_ar?: string | null
          question_type?: string | null
          quiz_id?: string | null
        }
        Update: {
          code_snippet?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text?: string | null
          question_text_ar?: string | null
          question_type?: string | null
          quiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      session_details: {
        Row: {
          assignment_id: string | null
          assignment_title: string | null
          assignment_title_ar: string | null
          duration_minutes: number | null
          group_id: string | null
          group_name: string | null
          group_name_ar: string | null
          instructor_id: string | null
          quiz_assignment_id: string | null
          quiz_id: string | null
          quiz_title: string | null
          quiz_title_ar: string | null
          session_date: string | null
          session_id: string | null
          session_number: number | null
          session_time: string | null
          status: string | null
          topic: string | null
          topic_ar: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_assignments_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      student_session_evaluations_view: {
        Row: {
          assignment_max_score: number | null
          assignment_score: number | null
          created_at: string | null
          evaluated_by: string | null
          id: string | null
          max_behavior_score: number | null
          max_total_score: number | null
          percentage: number | null
          quiz_max_score: number | null
          quiz_score: number | null
          scores: Json | null
          session_id: string | null
          student_feedback_tags: string[] | null
          student_id: string | null
          total_behavior_score: number | null
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          assignment_max_score?: number | null
          assignment_score?: number | null
          created_at?: string | null
          evaluated_by?: string | null
          id?: string | null
          max_behavior_score?: number | null
          max_total_score?: number | null
          percentage?: number | null
          quiz_max_score?: number | null
          quiz_score?: number | null
          scores?: Json | null
          session_id?: string | null
          student_feedback_tags?: string[] | null
          student_id?: string | null
          total_behavior_score?: number | null
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          assignment_max_score?: number | null
          assignment_score?: number | null
          created_at?: string | null
          evaluated_by?: string | null
          id?: string | null
          max_behavior_score?: number | null
          max_total_score?: number | null
          percentage?: number | null
          quiz_max_score?: number | null
          quiz_score?: number | null
          scores?: Json | null
          session_id?: string | null
          student_feedback_tags?: string[] | null
          student_id?: string | null
          total_behavior_score?: number | null
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_details"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_user_identity: {
        Row: {
          avatar_url: string | null
          date_of_birth: string | null
          email: string | null
          employment_status:
            | Database["public"]["Enums"]["employment_status"]
            | null
          full_name: string | null
          full_name_ar: string | null
          hourly_rate: number | null
          is_approved: boolean | null
          is_paid_trainee: boolean | null
          level_id: string | null
          needs_renewal: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          specialization: string | null
          specialization_ar: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acknowledge_balance_alert: {
        Args: { p_alert_id: string; p_notes?: string }
        Returns: undefined
      }
      approve_payroll_adjustment: {
        Args: { p_adjustment_id: string }
        Returns: undefined
      }
      approve_payroll_run: { Args: { p_run_id: string }; Returns: undefined }
      archive_group: { Args: { p_group_id: string }; Returns: undefined }
      assign_student_to_group: {
        Args: { p_new_group_id: string; p_student_id: string }
        Returns: Json
      }
      assign_subscription_dates: {
        Args: { p_group_id: string; p_student_id: string }
        Returns: Json
      }
      assign_subscription_dates_bulk: {
        Args: { p_group_id: string }
        Returns: Json
      }
      attach_expense_receipt: {
        Args: { p_expense_id: string; p_receipt_path: string }
        Returns: undefined
      }
      attach_payment_receipt: {
        Args: { p_payment_id: string; p_receipt_path: string }
        Returns: undefined
      }
      attach_salary_receipt: {
        Args: { p_receipt_path: string; p_salary_payment_id: string }
        Returns: undefined
      }
      auto_resolve_warning: {
        Args: {
          p_reason?: string
          p_session_id: string
          p_warning_type: string
        }
        Returns: number
      }
      backfill_quiz_audit_batch: { Args: { p_limit?: number }; Returns: number }
      calculate_student_renewal_status: {
        Args: { p_user_id: string }
        Returns: Json
      }
      can_view_payment_receipt: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      cancel_payroll_run: {
        Args: { p_reason: string; p_run_id: string }
        Returns: undefined
      }
      check_and_increment_chatbot_rate: {
        Args: { p_student_id: string }
        Returns: Json
      }
      check_attendance_achievements: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      check_balance_integrity: {
        Args: {
          p_account_id: string
          p_account_type: Database["public"]["Enums"]["balance_account_type"]
          p_cached: number
          p_method?: Database["public"]["Enums"]["balance_alert_method"]
        }
        Returns: boolean
      }
      check_exam_sla_timeouts: { Args: never; Returns: Json }
      check_group_completion: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      check_payroll_reconciliation_for_close: {
        Args: { p_period_month: string }
        Returns: boolean
      }
      check_quiz_achievements: {
        Args: { p_percentage: number; p_student_id: string }
        Returns: undefined
      }
      check_sibling_discount: { Args: { p_student_id: string }; Returns: Json }
      check_streak_achievements: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      clone_curriculum: {
        Args: {
          p_source_age_group_id: string
          p_source_level_id: string
          p_source_version: number
          p_target_age_group_id: string
          p_target_level_id: string
        }
        Returns: Json
      }
      compare_curriculum_versions: {
        Args: {
          p_age_group_id: string
          p_level_id: string
          p_version_a: number
          p_version_b: number
        }
        Returns: Json
      }
      complete_makeup_session: { Args: { p_session_id: string }; Returns: Json }
      compute_customer_balance: {
        Args: { p_customer_account_id: string }
        Returns: number
      }
      compute_employee_balance: {
        Args: { p_employee_account_id: string }
        Returns: number
      }
      compute_level_grade_for_student: {
        Args: { p_group_id: string; p_student_id: string }
        Returns: Json
      }
      compute_level_grades_batch: {
        Args: { p_group_id: string }
        Returns: Json
      }
      compute_placement_v2_confidence: {
        Args: {
          p_hw_pct: number
          p_pass_a: number
          p_pass_b: number
          p_section_a_pct: number
          p_section_b_pct: number
          p_sw_pct: number
          p_track_margin: number
        }
        Returns: string
      }
      compute_quality_score: {
        Args: {
          p_avg_grading: number
          p_avg_reply: number
          p_reminders: number
          p_total_students: number
          p_warnings: number
        }
        Returns: number
      }
      create_curriculum_quiz: { Args: { p_session_id: string }; Returns: Json }
      create_group_makeup_sessions: {
        Args: {
          p_group_id: string
          p_makeup_type: string
          p_original_session_id: string
          p_reason: string
          p_student_ids: string[]
        }
        Returns: Json
      }
      create_level_final_exam: { Args: { p_level_id: string }; Returns: Json }
      create_makeup_session: {
        Args: {
          p_group_id: string
          p_makeup_type: string
          p_original_session_id: string
          p_reason: string
          p_student_id: string
        }
        Returns: Json
      }
      create_payroll_adjustment: {
        Args: {
          p_adjustment_type: Database["public"]["Enums"]["payroll_adjustment_type"]
          p_amount: number
          p_applied_in_period: string
          p_employee_id: string
          p_reason: string
          p_reason_ar?: string
        }
        Returns: string
      }
      create_payroll_run: {
        Args: {
          p_employee_group?: Database["public"]["Enums"]["payroll_employee_group"]
          p_period_month: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_orphan_users: {
        Args: never
        Returns: {
          classification: string
          created_at: string
          email: string
          provider: string
          user_id: string
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_financial_period: { Args: { p_date: string }; Returns: string }
      freeze_quiz_version: { Args: { p_quiz_id: string }; Returns: string }
      generate_voucher_no: {
        Args: {
          p_date?: string
          p_source: Database["public"]["Enums"]["journal_source_type"]
        }
        Returns: string
      }
      get_coa_tree: {
        Args: never
        Returns: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          current_balance: number
          id: string
          is_active: boolean
          is_control: boolean
          is_system: boolean
          name: string
          name_ar: string
          normal_side: Database["public"]["Enums"]["normal_side_type"]
          parent_id: string
        }[]
      }
      get_conversation_participant_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          full_name_ar: string
          user_id: string
        }[]
      }
      get_curriculum_with_access: {
        Args: {
          p_age_group_id: string
          p_attendance_mode?: string
          p_level_id: string
          p_session_number: number
          p_subscription_type?: string
        }
        Returns: {
          age_group_id: string
          assignment_attachment_type: string
          assignment_attachment_url: string
          assignment_description: string
          assignment_description_ar: string
          assignment_max_score: number
          assignment_title: string
          assignment_title_ar: string
          can_view_assignment: boolean
          can_view_full_video: boolean
          can_view_quiz: boolean
          can_view_slides: boolean
          can_view_summary_video: boolean
          description: string
          description_ar: string
          full_video_url: string
          id: string
          is_published: boolean
          level_id: string
          published_at: string
          quiz_id: string
          session_number: number
          slides_url: string
          student_pdf_available: boolean
          student_pdf_filename: string
          student_pdf_path: string
          student_pdf_size: number
          summary_video_url: string
          title: string
          title_ar: string
          version: number
        }[]
      }
      get_customer_ledger: {
        Args: { p_limit?: number; p_student_id: string }
        Returns: {
          credit: number
          debit: number
          description: string
          description_ar: string
          entry_date: string
          je_id: string
          posted_at: string
          running_balance: number
          source: Database["public"]["Enums"]["journal_source_type"]
          source_id: string
          voucher_no: string
        }[]
      }
      get_effective_assignment_due: {
        Args: { p_assignment_id: string; p_student_id: string }
        Returns: {
          due_date: string
          source: string
        }[]
      }
      get_effective_quiz_window: {
        Args: { p_quiz_assignment_id: string; p_student_id: string }
        Returns: {
          due_date: string
          extra_minutes: number
          source: string
          start_time: string
        }[]
      }
      get_employee_ledger: {
        Args: { p_employee_id: string; p_limit?: number }
        Returns: {
          credit: number
          debit: number
          description: string
          description_ar: string
          entry_date: string
          je_id: string
          posted_at: string
          running_balance: number
          source: Database["public"]["Enums"]["journal_source_type"]
          source_id: string
          voucher_no: string
        }[]
      }
      get_group_level_status: { Args: { p_group_id: string }; Returns: Json }
      get_group_max_students: {
        Args: { g_type: Database["public"]["Enums"]["group_type"] }
        Returns: number
      }
      get_group_student_count: { Args: { g_id: string }; Returns: number }
      get_instructor_group_ids: {
        Args: { _instructor_id: string }
        Returns: string[]
      }
      get_landing_content: { Args: never; Returns: Json }
      get_leaderboard: {
        Args: {
          p_age_group_id?: string
          p_group_id?: string
          p_level_id?: string
          p_limit?: number
          p_offset?: number
          p_period?: string
          p_scope: string
          p_session_id?: string
        }
        Returns: {
          avatar_url: string
          group_name: string
          group_name_ar: string
          is_active_in_group: boolean
          level_name: string
          level_name_ar: string
          percentage: number
          rank: number
          sessions_count: number
          student_id: string
          student_name: string
          student_name_ar: string
          sum_max_total_score: number
          sum_total_score: number
          total_count: number
        }[]
      }
      get_or_create_customer_account: {
        Args: { p_student_id: string }
        Returns: string
      }
      get_or_create_employee_account: {
        Args: { p_employee_id: string }
        Returns: string
      }
      get_parent_auth_info: {
        Args: { parent_ids: string[] }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_student_attendance_stats: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_student_full_profile: { Args: { p_user_id: string }; Returns: Json }
      get_student_group_ids: {
        Args: { _student_id: string }
        Returns: string[]
      }
      get_student_level_xp: {
        Args: { p_student_id: string }
        Returns: {
          assignment_xp: number
          attendance_xp: number
          completion_xp: number
          evaluation_xp: number
          level_id: string
          level_name: string
          level_name_ar: string
          quiz_xp: number
          rank_name: string
          rank_progress: number
          total_xp: number
        }[]
      }
      get_student_subscription_status: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_student_summary: { Args: { p_user_id: string }; Returns: Json }
      get_students_list: {
        Args: {
          p_filters?: Json
          p_limit?: number
          p_offset?: number
          p_sort_by?: string
          p_sort_dir?: string
        }
        Returns: Json
      }
      get_submission_review_payload: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      get_trial_balance: {
        Args: { p_period_month?: string }
        Returns: {
          account_code: string
          account_name: string
          account_name_ar: string
          account_type: Database["public"]["Enums"]["account_type"]
          net_balance: number
          total_credit: number
          total_debit: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heal_orphan_users: {
        Args: never
        Returns: {
          action_taken: string
          healed_email: string
          healed_user_id: string
        }[]
      }
      init_salary_month: { Args: { p_month?: string }; Returns: Json }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_period_writable: { Args: { p_date: string }; Returns: boolean }
      is_student: { Args: { _user_id: string }; Returns: boolean }
      mark_student_repeat: {
        Args: { p_group_id: string; p_student_id: string }
        Returns: Json
      }
      mark_via_rpc: { Args: never; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pay_payroll_run: {
        Args: {
          p_payment_method?: Database["public"]["Enums"]["payment_method_type"]
          p_run_id: string
          p_transfer_type?: Database["public"]["Enums"]["transfer_method_type"]
        }
        Returns: Json
      }
      pg_advisory_xact_lock_wrapper: {
        Args: { lock_key: string }
        Returns: undefined
      }
      post_expense_journal: { Args: { p_expense_id: string }; Returns: string }
      post_payment_journal: { Args: { p_payment_id: string }; Returns: string }
      post_salary_journal: {
        Args: { p_salary_payment_id: string }
        Returns: string
      }
      private_get_cron_secret: { Args: never; Returns: string }
      private_get_service_role_key: { Args: never; Returns: string }
      publish_curriculum: {
        Args: { p_age_group_id: string; p_level_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rebuild_balance_from_alert: {
        Args: { p_alert_id: string }
        Returns: Json
      }
      rebuild_customer_balance: {
        Args: { p_customer_account_id: string }
        Returns: number
      }
      rebuild_employee_balance: {
        Args: { p_employee_account_id: string }
        Returns: number
      }
      rebuild_salary_snapshot: {
        Args: { p_employee_id: string; p_month: string }
        Returns: undefined
      }
      reconcile_payroll_to_ledger: {
        Args: { p_period_month: string }
        Returns: Json
      }
      record_expense_atomic: {
        Args: {
          p_amount: number
          p_category?: string
          p_description: string
          p_description_ar?: string
          p_expense_date?: string
          p_is_recurring?: boolean
          p_notes?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method_type"]
          p_transfer_type?: Database["public"]["Enums"]["transfer_method_type"]
        }
        Returns: string
      }
      record_payment_atomic:
        | {
            Args: {
              p_amount: number
              p_notes?: string
              p_payment_date: string
              p_payment_method?: Database["public"]["Enums"]["payment_method_type"]
              p_payment_type: string
              p_student_id: string
              p_subscription_id: string
              p_transfer_type?: Database["public"]["Enums"]["transfer_method_type"]
            }
            Returns: string
          }
        | {
            Args: {
              p_amount: number
              p_notes?: string
              p_payment_date: string
              p_payment_method: string
              p_payment_type?: string
              p_recorded_by?: string
              p_student_id: string
              p_subscription_id: string
            }
            Returns: Json
          }
      record_salary_payment_atomic: {
        Args: {
          p_base_amount: number
          p_bonus?: number
          p_bonus_reason?: string
          p_deduction_reason?: string
          p_deductions?: number
          p_employee_id: string
          p_month: string
          p_notes?: string
          p_paid_date?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method_type"]
          p_salary_id: string
          p_transfer_type?: Database["public"]["Enums"]["transfer_method_type"]
        }
        Returns: string
      }
      refresh_account_balances_mv: { Args: never; Returns: undefined }
      register_financial_rpc: {
        Args: { p_description?: string; p_rpc_name: string; p_version?: number }
        Returns: undefined
      }
      reject_payroll_adjustment: {
        Args: { p_adjustment_id: string }
        Returns: undefined
      }
      repair_orphaned_sessions: { Args: never; Returns: Json }
      reschedule_failed_final_exam: {
        Args: { p_date: string; p_duration: number; p_progress_id: string }
        Returns: Json
      }
      resolve_cash_account: {
        Args: {
          p_method: Database["public"]["Enums"]["payment_method_type"]
          p_transfer?: Database["public"]["Enums"]["transfer_method_type"]
        }
        Returns: string
      }
      reverse_journal_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: string
      }
      save_attendance: {
        Args: { p_group_id: string; p_records: Json; p_session_id: string }
        Returns: Json
      }
      schedule_final_exam_for_students: {
        Args: {
          p_date: string
          p_duration: number
          p_group_id: string
          p_student_ids: string[]
        }
        Returns: Json
      }
      schedule_makeup_session: {
        Args: {
          p_date: string
          p_instructor_id?: string
          p_makeup_id: string
          p_notes?: string
          p_time: string
        }
        Returns: Json
      }
      search_parents: {
        Args: { p_query: string }
        Returns: {
          children_count: number
          email: string
          full_name: string
          full_name_ar: string
          id: string
          phone: string
        }[]
      }
      student_choose_track_and_upgrade: {
        Args: { p_chosen_track_id?: string; p_group_id: string }
        Returns: Json
      }
      submit_payroll_run_for_review: {
        Args: { p_run_id: string }
        Returns: undefined
      }
      transfer_student_to_group: {
        Args: {
          p_force?: boolean
          p_from_group_id?: string
          p_student_id: string
          p_to_group_id: string
        }
        Returns: Json
      }
      unassign_curriculum_quiz: {
        Args: { p_expected_quiz_id: string; p_session_id: string }
        Returns: Json
      }
      update_curriculum_session: {
        Args: { p_data: Json; p_expected_updated_at: string; p_id: string }
        Returns: Json
      }
      update_question_stats: {
        Args: { p_is_correct: boolean; p_question_id: number }
        Returns: undefined
      }
      update_v2_question_stats: {
        Args: { p_is_correct: boolean; p_question_id: number }
        Returns: undefined
      }
      upgrade_student_level: {
        Args: {
          p_chosen_track_id?: string
          p_group_id: string
          p_student_id: string
        }
        Returns: Json
      }
      upsert_session_asset: {
        Args: {
          p_session_id: string
          p_student_pdf_filename: string
          p_student_pdf_path: string
          p_student_pdf_size: number
        }
        Returns: Json
      }
      verify_cron_token: { Args: { p_token: string }; Returns: boolean }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "admin" | "instructor" | "student" | "reception" | "parent"
      assessment_event_type:
        | "submitted"
        | "auto_graded"
        | "manual_override"
        | "re_graded"
        | "appeal_opened"
        | "appeal_resolved"
        | "version_frozen"
      balance_account_type: "customer" | "employee" | "gl"
      balance_alert_method: "trigger" | "page" | "cron"
      balance_alert_status:
        | "pending"
        | "acknowledged"
        | "rebuilt"
        | "false_positive"
      employment_status: "permanent" | "training" | "terminated"
      financial_period_status: "open" | "review" | "closed" | "reopened"
      group_type: "kojo_squad" | "kojo_core" | "kojo_x"
      journal_entry_status: "draft" | "posted" | "reversed"
      journal_source_type:
        | "payment"
        | "expense"
        | "salary"
        | "manual"
        | "adjustment"
        | "closing"
        | "reversal"
      manual_override_reason:
        | "student_appeal"
        | "teacher_correction"
        | "system_error_fix"
        | "rubric_adjustment"
        | "other"
      normal_side_type: "debit" | "credit"
      payment_method_type: "cash" | "transfer"
      payroll_adjustment_type:
        | "bonus"
        | "deduction"
        | "correction"
        | "reimbursement"
      payroll_employee_group: "instructor" | "reception" | "all"
      payroll_run_status: "draft" | "review" | "approved" | "paid" | "cancelled"
      receipt_status_type: "not_required" | "pending_receipt" | "completed"
      subscription_type: "kojo_squad" | "kojo_core" | "kojo_x"
      transfer_method_type: "bank" | "instapay" | "wallet"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: ["admin", "instructor", "student", "reception", "parent"],
      assessment_event_type: [
        "submitted",
        "auto_graded",
        "manual_override",
        "re_graded",
        "appeal_opened",
        "appeal_resolved",
        "version_frozen",
      ],
      balance_account_type: ["customer", "employee", "gl"],
      balance_alert_method: ["trigger", "page", "cron"],
      balance_alert_status: [
        "pending",
        "acknowledged",
        "rebuilt",
        "false_positive",
      ],
      employment_status: ["permanent", "training", "terminated"],
      financial_period_status: ["open", "review", "closed", "reopened"],
      group_type: ["kojo_squad", "kojo_core", "kojo_x"],
      journal_entry_status: ["draft", "posted", "reversed"],
      journal_source_type: [
        "payment",
        "expense",
        "salary",
        "manual",
        "adjustment",
        "closing",
        "reversal",
      ],
      manual_override_reason: [
        "student_appeal",
        "teacher_correction",
        "system_error_fix",
        "rubric_adjustment",
        "other",
      ],
      normal_side_type: ["debit", "credit"],
      payment_method_type: ["cash", "transfer"],
      payroll_adjustment_type: [
        "bonus",
        "deduction",
        "correction",
        "reimbursement",
      ],
      payroll_employee_group: ["instructor", "reception", "all"],
      payroll_run_status: ["draft", "review", "approved", "paid", "cancelled"],
      receipt_status_type: ["not_required", "pending_receipt", "completed"],
      subscription_type: ["kojo_squad", "kojo_core", "kojo_x"],
      transfer_method_type: ["bank", "instapay", "wallet"],
    },
  },
} as const
