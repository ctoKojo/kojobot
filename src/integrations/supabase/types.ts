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
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          description_ar: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          notes: string | null
          recorded_by: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description: string
          description_ar?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          recorded_by: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          description_ar?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          recorded_by?: string
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
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_level_id: string
          current_track_id?: string | null
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
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_level_id?: string
          current_track_id?: string | null
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
          level_id: string | null
          level_status: string | null
          name: string
          name_ar: string
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
          level_id?: string | null
          level_status?: string | null
          name: string
          name_ar: string
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
          level_id?: string | null
          level_status?: string | null
          name?: string
          name_ar?: string
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
          session_id: string | null
          severity: string
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
          session_id?: string | null
          severity?: string
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
          session_id?: string | null
          severity?: string
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
          created_at: string
          expected_sessions_count: number
          final_exam_quiz_id: string | null
          id: string
          is_active: boolean | null
          level_order: number
          name: string
          name_ar: string
          parent_level_id: string | null
          pass_threshold: number | null
          track: string | null
          track_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_sessions_count?: number
          final_exam_quiz_id?: string | null
          id?: string
          is_active?: boolean | null
          level_order: number
          name: string
          name_ar: string
          parent_level_id?: string | null
          pass_threshold?: number | null
          track?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_sessions_count?: number
          final_exam_quiz_id?: string | null
          id?: string
          is_active?: boolean | null
          level_order?: number
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
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_type: string
          recorded_by: string
          student_id: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_type?: string
          recorded_by: string
          student_id: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_type?: string
          recorded_by?: string
          student_id?: string
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
          is_paid_trainee: boolean | null
          level_id: string | null
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
          is_paid_trainee?: boolean | null
          level_id?: string | null
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
          is_paid_trainee?: boolean | null
          level_id?: string | null
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
      quiz_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          curriculum_snapshot: Json | null
          due_date: string | null
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
      quiz_questions: {
        Row: {
          code_snippet: string | null
          correct_answer: string
          created_at: string
          id: string
          image_url: string | null
          options: Json | null
          order_index: number
          points: number
          question_text: string
          question_text_ar: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          code_snippet?: string | null
          correct_answer: string
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json | null
          order_index?: number
          points?: number
          question_text: string
          question_text_ar: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          code_snippet?: string | null
          correct_answer?: string
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json | null
          order_index?: number
          points?: number
          question_text?: string
          question_text_ar?: string
          question_type?: string
          quiz_id?: string
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
      quiz_submissions: {
        Row: {
          answers: Json
          graded_at: string | null
          graded_by: string | null
          id: string
          is_auto_generated: boolean
          max_score: number | null
          percentage: number | null
          quiz_assignment_id: string
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
          id?: string
          is_auto_generated?: boolean
          max_score?: number | null
          percentage?: number | null
          quiz_assignment_id: string
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
          id?: string
          is_auto_generated?: boolean
          max_score?: number | null
          percentage?: number | null
          quiz_assignment_id?: string
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
          id: string
          month: string
          net_amount: number | null
          notes: string | null
          paid_by: string | null
          paid_date: string | null
          payment_method: string | null
          salary_id: string | null
          status: string
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
          id?: string
          month: string
          net_amount?: number | null
          notes?: string | null
          paid_by?: string | null
          paid_date?: string | null
          payment_method?: string | null
          salary_id?: string | null
          status?: string
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
          id?: string
          month?: string
          net_amount?: number | null
          notes?: string | null
          paid_by?: string | null
          paid_date?: string | null
          payment_method?: string | null
          salary_id?: string | null
          status?: string
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
          created_at: string
          duration_minutes: number
          group_id: string
          id: string
          is_makeup: boolean
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
          created_at?: string
          duration_minutes?: number
          group_id: string
          id?: string
          is_makeup?: boolean
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
          created_at?: string
          duration_minutes?: number
          group_id?: string
          id?: string
          is_makeup?: boolean
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
          reference_id: string | null
          student_id: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          reference_id?: string | null
          student_id: string
          xp_amount: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          reference_id?: string | null
          student_id?: string
          xp_amount?: number
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          attendance_mode: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string
          plan_id: string | null
          status: string
        }
        Insert: {
          attendance_mode?: string
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          plan_id?: string | null
          status?: string
        }
        Update: {
          attendance_mode?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
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
            foreignKeyName: "subscriptions_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Functions: {
      assign_subscription_dates: {
        Args: { p_group_id: string; p_student_id: string }
        Returns: Json
      }
      assign_subscription_dates_bulk: {
        Args: { p_group_id: string }
        Returns: Json
      }
      check_and_increment_chatbot_rate: {
        Args: { p_student_id: string }
        Returns: Json
      }
      check_attendance_achievements: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      check_quiz_achievements: {
        Args: { p_percentage: number; p_student_id: string }
        Returns: undefined
      }
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
      compute_level_grades_batch: {
        Args: { p_group_id: string }
        Returns: Json
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
      get_student_group_ids: {
        Args: { _student_id: string }
        Returns: string[]
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
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_student: { Args: { _user_id: string }; Returns: boolean }
      mark_student_repeat: {
        Args: { p_group_id: string; p_student_id: string }
        Returns: Json
      }
      publish_curriculum: {
        Args: { p_age_group_id: string; p_level_id: string }
        Returns: Json
      }
      rebuild_salary_snapshot: {
        Args: { p_employee_id: string; p_month: string }
        Returns: undefined
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
      student_choose_track_and_upgrade: {
        Args: { p_chosen_track_id?: string; p_group_id: string }
        Returns: Json
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
    }
    Enums: {
      app_role: "admin" | "instructor" | "student" | "reception"
      employment_status: "permanent" | "training" | "terminated"
      group_type: "kojo_squad" | "kojo_core" | "kojo_x"
      subscription_type: "kojo_squad" | "kojo_core" | "kojo_x"
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
      app_role: ["admin", "instructor", "student", "reception"],
      employment_status: ["permanent", "training", "terminated"],
      group_type: ["kojo_squad", "kojo_core", "kojo_x"],
      subscription_type: ["kojo_squad", "kojo_core", "kojo_x"],
    },
  },
} as const
