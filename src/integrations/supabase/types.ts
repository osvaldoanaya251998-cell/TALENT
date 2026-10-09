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
  public: {
    Tables: {
      application_notes: {
        Row: {
          application_id: string
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          application_id: string
          body: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          application_id?: string
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          candidate_id: string | null
          created_at: string
          evaluation_id: string | null
          id: string
          notas: string | null
          respuestas: Json
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string | null
          vacancy_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          evaluation_id?: string | null
          id?: string
          notas?: string | null
          respuestas?: Json
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string | null
          vacancy_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          evaluation_id?: string | null
          id?: string
          notas?: string | null
          respuestas?: Json
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string | null
          vacancy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          accepted_privacy_policy: boolean
          ciudad: string
          created_at: string
          email: string
          experiencia: number
          id: string
          linkedin: string | null
          nombre: string
          privacy_policy_accepted_at: string | null
          privacy_policy_version: string | null
          telefono: string
        }
        Insert: {
          accepted_privacy_policy?: boolean
          ciudad: string
          created_at?: string
          email: string
          experiencia?: number
          id?: string
          linkedin?: string | null
          nombre: string
          privacy_policy_accepted_at?: string | null
          privacy_policy_version?: string | null
          telefono: string
        }
        Update: {
          accepted_privacy_policy?: boolean
          ciudad?: string
          created_at?: string
          email?: string
          experiencia?: number
          id?: string
          linkedin?: string | null
          nombre?: string
          privacy_policy_accepted_at?: string | null
          privacy_policy_version?: string | null
          telefono?: string
        }
        Relationships: []
      }
      dismissed_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          evaluation_id: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option: Database["public"]["Enums"]["question_option"] | null
          time_ms: number | null
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_option?:
            | Database["public"]["Enums"]["question_option"]
            | null
          time_ms?: number | null
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option?:
            | Database["public"]["Enums"]["question_option"]
            | null
          time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_answers_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_results: {
        Row: {
          category: string
          correct: number
          created_at: string
          evaluation_id: string
          id: string
          percentage: number
          total: number
        }
        Insert: {
          category: string
          correct: number
          created_at?: string
          evaluation_id: string
          id?: string
          percentage: number
          total: number
        }
        Update: {
          category?: string
          correct?: number
          created_at?: string
          evaluation_id?: string
          id?: string
          percentage?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          application_id: string | null
          avg_time_ms: number
          candidate_id: string | null
          compatibility: string | null
          created_at: string
          finished_at: string | null
          id: string
          percentage: number
          score: number
          started_at: string
          status: Database["public"]["Enums"]["evaluation_status"]
          tab_switches: number
          total_correct: number
          total_questions: number
          updated_at: string
          user_id: string | null
          vacancy_id: string | null
        }
        Insert: {
          application_id?: string | null
          avg_time_ms?: number
          candidate_id?: string | null
          compatibility?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          percentage?: number
          score?: number
          started_at?: string
          status?: Database["public"]["Enums"]["evaluation_status"]
          tab_switches?: number
          total_correct?: number
          total_questions?: number
          updated_at?: string
          user_id?: string | null
          vacancy_id?: string | null
        }
        Update: {
          application_id?: string | null
          avg_time_ms?: number
          candidate_id?: string | null
          compatibility?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          percentage?: number
          score?: number
          started_at?: string
          status?: Database["public"]["Enums"]["evaluation_status"]
          tab_switches?: number
          total_correct?: number
          total_questions?: number
          updated_at?: string
          user_id?: string | null
          vacancy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          application_id: string
          created_at: string
          done: boolean
          done_at: string | null
          due_date: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applied_at: string | null
          apply_url: string | null
          company: string | null
          created_at: string
          id: string
          job_id: string | null
          next_follow_up: string | null
          notes: string | null
          position: string
          recruiter_contact: string | null
          salary_text: string | null
          source: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["aj_application_status"]
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          apply_url?: string | null
          company?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          next_follow_up?: string | null
          notes?: string | null
          position: string
          recruiter_contact?: string | null
          salary_text?: string | null
          source?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["aj_application_status"]
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          apply_url?: string | null
          company?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          next_follow_up?: string | null
          notes?: string | null
          position?: string
          recruiter_contact?: string | null
          salary_text?: string | null
          source?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["aj_application_status"]
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_preferences: {
        Row: {
          busqueda_automatica: boolean
          created_at: string
          empresas: string[]
          fuentes: string[]
          industrias: string[]
          modalidad: Database["public"]["Enums"]["aj_modality"] | null
          palabras_clave: string[]
          puestos: string[]
          sueldo_minimo: number | null
          ubicaciones: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          busqueda_automatica?: boolean
          created_at?: string
          empresas?: string[]
          fuentes?: string[]
          industrias?: string[]
          modalidad?: Database["public"]["Enums"]["aj_modality"] | null
          palabras_clave?: string[]
          puestos?: string[]
          sueldo_minimo?: number | null
          ubicaciones?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          busqueda_automatica?: boolean
          created_at?: string
          empresas?: string[]
          fuentes?: string[]
          industrias?: string[]
          modalidad?: Database["public"]["Enums"]["aj_modality"] | null
          palabras_clave?: string[]
          puestos?: string[]
          sueldo_minimo?: number | null
          ubicaciones?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_providers: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          integration_status: string
          is_enabled: boolean
          jobs_found: number
          key: string
          last_error: string | null
          last_sync_at: string | null
          last_test_at: string | null
          last_test_ok: boolean | null
          name: string
          secret_names: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          integration_status?: string
          is_enabled?: boolean
          jobs_found?: number
          key: string
          last_error?: string | null
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_ok?: boolean | null
          name: string
          secret_names?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          integration_status?: string
          is_enabled?: boolean
          jobs_found?: number
          key?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_ok?: boolean | null
          name?: string
          secret_names?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      job_searches: {
        Row: {
          cache_key: string
          filters: Json
          id: string
          job_ids: string[]
          location: string | null
          providers: string[]
          query: string
          results_count: number
          searched_at: string
          user_id: string
        }
        Insert: {
          cache_key: string
          filters?: Json
          id?: string
          job_ids?: string[]
          location?: string | null
          providers?: string[]
          query: string
          results_count?: number
          searched_at?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          filters?: Json
          id?: string
          job_ids?: string[]
          location?: string | null
          providers?: string[]
          query?: string
          results_count?: number
          searched_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_seeker_profiles: {
        Row: {
          anios_experiencia: number
          apellido: string | null
          area_profesional: string | null
          ciudad: string | null
          created_at: string
          email: string | null
          estado: string | null
          habilidades: string[]
          industrias: string[]
          linkedin: string | null
          modalidad_preferida: Database["public"]["Enums"]["aj_modality"] | null
          nivel_ingles: string | null
          nombre: string | null
          puesto_objetivo: string | null
          sueldo_minimo: number | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anios_experiencia?: number
          apellido?: string | null
          area_profesional?: string | null
          ciudad?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          habilidades?: string[]
          industrias?: string[]
          linkedin?: string | null
          modalidad_preferida?:
            | Database["public"]["Enums"]["aj_modality"]
            | null
          nivel_ingles?: string | null
          nombre?: string | null
          puesto_objetivo?: string | null
          sueldo_minimo?: number | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anios_experiencia?: number
          apellido?: string | null
          area_profesional?: string | null
          ciudad?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          habilidades?: string[]
          industrias?: string[]
          linkedin?: string | null
          modalidad_preferida?:
            | Database["public"]["Enums"]["aj_modality"]
            | null
          nivel_ingles?: string | null
          nombre?: string | null
          puesto_objetivo?: string | null
          sueldo_minimo?: number | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_sources: {
        Row: {
          created_at: string
          credential_fields: Json
          display_order: number
          help: string | null
          integration_method: string
          is_connected: boolean
          key: string
          name: string
          notes: string | null
          requires_api: boolean
          requires_endpoint: boolean
        }
        Insert: {
          created_at?: string
          credential_fields?: Json
          display_order?: number
          help?: string | null
          integration_method?: string
          is_connected?: boolean
          key: string
          name: string
          notes?: string | null
          requires_api?: boolean
          requires_endpoint?: boolean
        }
        Update: {
          created_at?: string
          credential_fields?: Json
          display_order?: number
          help?: string | null
          integration_method?: string
          is_connected?: boolean
          key?: string
          name?: string
          notes?: string | null
          requires_api?: boolean
          requires_endpoint?: boolean
        }
        Relationships: []
      }
      job_views: {
        Row: {
          id: string
          job_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          apply_url: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          dedupe_key: string | null
          description: string | null
          employment_type: string | null
          external_id: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          location: string | null
          match_details: Json | null
          match_score: number | null
          modality: Database["public"]["Enums"]["aj_modality"] | null
          published_at: string | null
          raw: Json | null
          requirements: string[]
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_text: string | null
          skills: string[]
          source_key: string
          source_logo: string | null
          state: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          apply_url?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          employment_type?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          modality?: Database["public"]["Enums"]["aj_modality"] | null
          published_at?: string | null
          raw?: Json | null
          requirements?: string[]
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_text?: string | null
          skills?: string[]
          source_key: string
          source_logo?: string | null
          state?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          apply_url?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          employment_type?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          modality?: Database["public"]["Enums"]["aj_modality"] | null
          published_at?: string | null
          raw?: Json | null
          requirements?: string[]
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_text?: string | null
          skills?: string[]
          source_key?: string
          source_logo?: string | null
          state?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_privacy_policy: boolean
          candidate_id: string | null
          certificaciones: string[]
          ciudad: string | null
          created_at: string
          cv_url: string | null
          email: string | null
          evaluation_id: string | null
          experiencia: number
          linkedin: string | null
          nombre: string | null
          privacy_policy_accepted_at: string | null
          privacy_policy_version: string | null
          ramos: string[]
          resumen: string | null
          skills: string[]
          telefono: string | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          accepted_privacy_policy?: boolean
          candidate_id?: string | null
          certificaciones?: string[]
          ciudad?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          evaluation_id?: string | null
          experiencia?: number
          linkedin?: string | null
          nombre?: string | null
          privacy_policy_accepted_at?: string | null
          privacy_policy_version?: string | null
          ramos?: string[]
          resumen?: string | null
          skills?: string[]
          telefono?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          accepted_privacy_policy?: boolean
          candidate_id?: string | null
          certificaciones?: string[]
          ciudad?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          evaluation_id?: string | null
          experiencia?: number
          linkedin?: string | null
          nombre?: string | null
          privacy_policy_accepted_at?: string | null
          privacy_policy_version?: string | null
          ramos?: string[]
          resumen?: string | null
          skills?: string[]
          telefono?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_type: Database["public"]["Enums"]["answer_type"]
          category: string
          correct_option: Database["public"]["Enums"]["question_option"] | null
          created_at: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          id: string
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          option_e: string | null
          order_index: number
          question: string
          skill_tags: string[]
          vacancy_id: string | null
        }
        Insert: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          category: string
          correct_option?: Database["public"]["Enums"]["question_option"] | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          id?: string
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          order_index?: number
          question: string
          skill_tags?: string[]
          vacancy_id?: string | null
        }
        Update: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          category?: string
          correct_option?: Database["public"]["Enums"]["question_option"] | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          id?: string
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          order_index?: number
          question?: string
          skill_tags?: string[]
          vacancy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          is_current: boolean
          mime_type: string | null
          size_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          is_current?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          is_current?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sync_runs: {
        Row: {
          duplicated: number
          error_detail: string | null
          errors: number
          finished_at: string
          found: number
          id: string
          inserted: number
          source_key: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          duplicated?: number
          error_detail?: string | null
          errors?: number
          finished_at?: string
          found?: number
          id?: string
          inserted?: number
          source_key: string
          started_at?: string
          status: string
          user_id: string
        }
        Update: {
          duplicated?: number
          error_detail?: string | null
          errors?: number
          finished_at?: string
          found?: number
          id?: string
          inserted?: number
          source_key?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_sync_runs_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["key"]
          },
        ]
      }
      uploads: {
        Row: {
          candidate_id: string
          created_at: string
          cv_url: string | null
          id: string
          video_url: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          cv_url?: string | null
          id?: string
          video_url?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          cv_url?: string | null
          id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_job_sources: {
        Row: {
          config: Json
          connection_status: string
          created_at: string
          credential_secret_id: string | null
          id: string
          is_enabled: boolean
          jobs_found: number
          last_error: string | null
          last_sync_at: string | null
          source_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          connection_status?: string
          created_at?: string
          credential_secret_id?: string | null
          id?: string
          is_enabled?: boolean
          jobs_found?: number
          last_error?: string | null
          last_sync_at?: string | null
          source_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          connection_status?: string
          created_at?: string
          credential_secret_id?: string | null
          id?: string
          is_enabled?: boolean
          jobs_found?: number
          last_error?: string | null
          last_sync_at?: string | null
          source_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_job_sources_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["key"]
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
      vacancies: {
        Row: {
          benefits: string | null
          cedula: string
          company: string | null
          company_logo_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          modality: Database["public"]["Enums"]["aj_modality"] | null
          pay_scheme: string | null
          ramos: string[]
          requirements: string | null
          salary_text: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          cedula?: string
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          modality?: Database["public"]["Enums"]["aj_modality"] | null
          pay_scheme?: string | null
          ramos?: string[]
          requirements?: string | null
          salary_text?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          cedula?: string
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          modality?: Database["public"]["Enums"]["aj_modality"] | null
          pay_scheme?: string | null
          ramos?: string[]
          requirements?: string | null
          salary_text?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_to_vacancy: { Args: { _vacancy_id: string }; Returns: Json }
      delete_source_credentials: {
        Args: { _source_key: string }
        Returns: undefined
      }
      evaluation_exists: { Args: { _id: string }; Returns: boolean }
      finalize_evaluation: { Args: { _evaluation_id: string }; Returns: Json }
      get_evaluation_progress: {
        Args: { _evaluation_id: string }
        Returns: {
          answered_ids: string[]
          status: Database["public"]["Enums"]["evaluation_status"]
        }[]
      }
      get_evaluation_questions: {
        Args: { _limit?: number; _vacancy_id: string }
        Returns: {
          category: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e: string
          order_index: number
          question: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_tab_switch: {
        Args: { _evaluation_id: string }
        Returns: number
      }
      read_source_credentials: {
        Args: { _source_key: string; _user_id: string }
        Returns: Json
      }
      save_source_credentials: {
        Args: { _credentials: Json; _source_key: string }
        Returns: undefined
      }
      start_evaluation: {
        Args: {
          _application_id: string
          _candidate_id: string
          _vacancy_id: string
        }
        Returns: string
      }
      submit_evaluation_answer: {
        Args: {
          _evaluation_id: string
          _question_id: string
          _selected_option: string
          _time_ms?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      aj_application_status:
        | "vista"
        | "guardada"
        | "por_postular"
        | "postulacion_preparada"
        | "postulacion_iniciada"
        | "postulado"
        | "screening"
        | "entrevista"
        | "finalista"
        | "oferta"
        | "rechazado"
        | "cerrada"
      aj_modality: "remoto" | "hibrido" | "presencial"
      answer_type:
        | "short_text"
        | "long_text"
        | "scale_1_5"
        | "number"
        | "single_choice"
      app_role: "admin" | "recruiter"
      application_status:
        | "nuevo"
        | "revisando"
        | "entrevista"
        | "aprobado"
        | "rechazado"
        | "contratado"
      evaluation_status: "in_progress" | "completed" | "abandoned"
      question_difficulty: "basic" | "intermediate" | "advanced"
      question_option: "A" | "B" | "C" | "D" | "E"
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
      aj_application_status: [
        "vista",
        "guardada",
        "por_postular",
        "postulacion_preparada",
        "postulacion_iniciada",
        "postulado",
        "screening",
        "entrevista",
        "finalista",
        "oferta",
        "rechazado",
        "cerrada",
      ],
      aj_modality: ["remoto", "hibrido", "presencial"],
      answer_type: [
        "short_text",
        "long_text",
        "scale_1_5",
        "number",
        "single_choice",
      ],
      app_role: ["admin", "recruiter"],
      application_status: [
        "nuevo",
        "revisando",
        "entrevista",
        "aprobado",
        "rechazado",
        "contratado",
      ],
      evaluation_status: ["in_progress", "completed", "abandoned"],
      question_difficulty: ["basic", "intermediate", "advanced"],
      question_option: ["A", "B", "C", "D", "E"],
    },
  },
} as const
