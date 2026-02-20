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
          compensation_status: string | null
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
          compensation_status?: string | null
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
          compensation_status?: string | null
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
      levels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          level_order: number
          name: string
          name_ar: string
          parent_level_id: string | null
          track: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          level_order: number
          name: string
          name_ar: string
          parent_level_id?: string | null
          track?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          level_order?: number
          name?: string
          name_ar?: string
          parent_level_id?: string | null
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_parent_level_id_fkey"
            columns: ["parent_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
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
          created_at: string
          duration_minutes: number
          group_id: string
          id: string
          notes: string | null
          session_date: string
          session_number: number | null
          session_time: string
          status: string
          topic: string | null
          topic_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          group_id: string
          id?: string
          notes?: string | null
          session_date: string
          session_number?: number | null
          session_time: string
          status?: string
          topic?: string | null
          topic_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          group_id?: string
          id?: string
          notes?: string | null
          session_date?: string
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
      quiz_questions_student_view: {
        Row: {
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
          summary_video_url: string
          title: string
          title_ar: string
          version: number
        }[]
      }
      get_group_max_students: {
        Args: { g_type: Database["public"]["Enums"]["group_type"] }
        Returns: number
      }
      get_group_student_count: { Args: { g_id: string }; Returns: number }
      get_instructor_group_ids: {
        Args: { _instructor_id: string }
        Returns: string[]
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
      rebuild_salary_snapshot: {
        Args: { p_employee_id: string; p_month: string }
        Returns: undefined
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
