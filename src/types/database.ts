export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      action_items: {
        Row: {
          created_at: string
          created_by: string | null
          debrief_id: string | null
          description: string
          due_date: string | null
          id: string
          owner_id: string | null
          task_id: string | null
          team_meeting_id: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          debrief_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          owner_id?: string | null
          task_id?: string | null
          team_meeting_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          debrief_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          owner_id?: string | null
          task_id?: string | null
          team_meeting_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_debrief_id_fkey"
            columns: ["debrief_id"]
            isOneToOne: false
            referencedRelation: "debriefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "action_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_team_meeting_id_fkey"
            columns: ["team_meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          after: Json | null
          before: Json | null
          changed_fields: string[] | null
          entity_id: string
          entity_type: string
          id: number
          occurred_at: string
          undo_of: number | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          entity_id: string
          entity_type: string
          id?: never
          occurred_at?: string
          undo_of?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          entity_id?: string
          entity_type?: string
          id?: never
          occurred_at?: string
          undo_of?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_undo_of_fkey"
            columns: ["undo_of"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_undo_of_fkey"
            columns: ["undo_of"]
            isOneToOne: false
            referencedRelation: "wins_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      actors: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["actor_kind"]
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["actor_kind"]
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["actor_kind"]
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          key: string
          updated_at?: string
          value: NonNullable<Json>
        }
        Update: {
          key?: string
          updated_at?: string
          value?: NonNullable<Json>
        }
        Relationships: []
      }
      availability_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          label: Database["public"]["Enums"]["availability_label"]
          note: string | null
          person_id: string
          start_time: string
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          label: Database["public"]["Enums"]["availability_label"]
          note?: string | null
          person_id: string
          start_time: string
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          label?: Database["public"]["Enums"]["availability_label"]
          note?: string | null
          person_id?: string
          start_time?: string
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "availability_blocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          joined_person_id: string | null
          name: string
          notes: string | null
          owner_id: string
          role_sought: string
          source: string | null
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          joined_person_id?: string | null
          name: string
          notes?: string | null
          owner_id: string
          role_sought: string
          source?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          joined_person_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          role_sought?: string
          source?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_joined_person_id_fkey"
            columns: ["joined_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_joined_person_id_fkey"
            columns: ["joined_person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "candidates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "candidates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          hint: string | null
          id: string
          position: number
          text: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          checklist_id: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          hint?: string | null
          id?: string
          position?: number
          text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          checklist_id?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          hint?: string | null
          id?: string
          position?: number
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          items: NonNullable<Json>
          name: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          items?: NonNullable<Json>
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          items?: NonNullable<Json>
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_meeting_id: string | null
          organization_id: string | null
          person_id: string | null
          synthe6_session_id: string | null
          task_id: string | null
          template_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_meeting_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          synthe6_session_id?: string | null
          task_id?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_meeting_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          synthe6_session_id?: string | null
          task_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["latest_meeting_id"]
          },
          {
            foreignKeyName: "checklists_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["next_meeting_id"]
          },
          {
            foreignKeyName: "checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "checklists_synthe6_session_id_fkey"
            columns: ["synthe6_session_id"]
            isOneToOne: false
            referencedRelation: "synthe6_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      crunch_periods: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          label: string
          person_id: string
          start_date: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          label: string
          person_id: string
          start_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          label?: string
          person_id?: string
          start_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crunch_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crunch_periods_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crunch_periods_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "crunch_periods_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      debriefs: {
        Row: {
          actual: string | null
          change: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string
          facilitator_id: string | null
          id: string
          kind: Database["public"]["Enums"]["debrief_kind"]
          org_meeting_id: string | null
          planned: string | null
          status: Database["public"]["Enums"]["debrief_status"]
          synthe6_session_id: string | null
          team_meeting_id: string | null
          updated_at: string
          updated_by: string | null
          worked: string | null
        }
        ComputedFields: never
        Insert: {
          actual?: string | null
          change?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          facilitator_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["debrief_kind"]
          org_meeting_id?: string | null
          planned?: string | null
          status?: Database["public"]["Enums"]["debrief_status"]
          synthe6_session_id?: string | null
          team_meeting_id?: string | null
          updated_at?: string
          updated_by?: string | null
          worked?: string | null
        }
        Update: {
          actual?: string | null
          change?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          facilitator_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["debrief_kind"]
          org_meeting_id?: string | null
          planned?: string | null
          status?: Database["public"]["Enums"]["debrief_status"]
          synthe6_session_id?: string | null
          team_meeting_id?: string | null
          updated_at?: string
          updated_by?: string | null
          worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debriefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debriefs_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debriefs_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "debriefs_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: true
            referencedRelation: "org_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debriefs_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: true
            referencedRelation: "org_overview"
            referencedColumns: ["latest_meeting_id"]
          },
          {
            foreignKeyName: "debriefs_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: true
            referencedRelation: "org_overview"
            referencedColumns: ["next_meeting_id"]
          },
          {
            foreignKeyName: "debriefs_synthe6_session_id_fkey"
            columns: ["synthe6_session_id"]
            isOneToOne: true
            referencedRelation: "synthe6_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debriefs_team_meeting_id_fkey"
            columns: ["team_meeting_id"]
            isOneToOne: true
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debriefs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          decision_date: string
          id: string
          meeting_update_id: string | null
          owner_id: string | null
          rationale: string | null
          search: unknown
          statement: string
          team_meeting_id: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_date: string
          id?: string
          meeting_update_id?: string | null
          owner_id?: string | null
          rationale?: string | null
          search?: never
          statement: string
          team_meeting_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string
          id?: string
          meeting_update_id?: string | null
          owner_id?: string | null
          rationale?: string | null
          search?: never
          statement?: string
          team_meeting_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_meeting_update_id_fkey"
            columns: ["meeting_update_id"]
            isOneToOne: false
            referencedRelation: "meeting_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "decisions_team_meeting_id_fkey"
            columns: ["team_meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_dedupe: {
        Row: {
          created_at: string
          dedupe_key: string
          entity_id: string
          event: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          dedupe_key?: string
          entity_id: string
          event: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          entity_id?: string
          event?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page_path: string
          person_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_path: string
          person_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_path?: string
          person_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
        ]
      }
      help_requests: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          requester_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          requester_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          requester_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "help_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "help_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      hypotheses: {
        Row: {
          archived_at: string | null
          audience: Database["public"]["Enums"]["org_kind"] | null
          created_at: string
          created_by: string | null
          decision: Database["public"]["Enums"]["hypothesis_decision"] | null
          id: string
          learning: string | null
          organization_id: string | null
          owner_id: string | null
          result: string | null
          statement: string
          status: Database["public"]["Enums"]["hypothesis_status"]
          success_criterion: string | null
          test_plan: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          audience?: Database["public"]["Enums"]["org_kind"] | null
          created_at?: string
          created_by?: string | null
          decision?: Database["public"]["Enums"]["hypothesis_decision"] | null
          id?: string
          learning?: string | null
          organization_id?: string | null
          owner_id?: string | null
          result?: string | null
          statement: string
          status?: Database["public"]["Enums"]["hypothesis_status"]
          success_criterion?: string | null
          test_plan?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          audience?: Database["public"]["Enums"]["org_kind"] | null
          created_at?: string
          created_by?: string | null
          decision?: Database["public"]["Enums"]["hypothesis_decision"] | null
          id?: string
          learning?: string | null
          organization_id?: string | null
          owner_id?: string | null
          result?: string | null
          statement?: string
          status?: Database["public"]["Enums"]["hypothesis_status"]
          success_criterion?: string | null
          test_plan?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hypotheses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "hypotheses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      hypothesis_tests: {
        Row: {
          created_at: string
          created_by: string | null
          evidence: string
          hypothesis_id: string
          id: string
          org_meeting_id: string | null
          outcome: Database["public"]["Enums"]["test_outcome"]
          test_date: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          evidence: string
          hypothesis_id: string
          id?: string
          org_meeting_id?: string | null
          outcome: Database["public"]["Enums"]["test_outcome"]
          test_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          evidence?: string
          hypothesis_id?: string
          id?: string
          org_meeting_id?: string | null
          outcome?: Database["public"]["Enums"]["test_outcome"]
          test_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hypothesis_tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypothesis_tests_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "hypotheses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypothesis_tests_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypothesis_tests_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["latest_meeting_id"]
          },
          {
            foreignKeyName: "hypothesis_tests_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["next_meeting_id"]
          },
          {
            foreignKeyName: "hypothesis_tests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          current_value: number
          id: string
          objective_id: string
          owner_id: string
          position: number
          start_value: number
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number
          id?: string
          objective_id: string
          owner_id: string
          position?: number
          start_value?: number
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number
          id?: string
          objective_id?: string
          owner_id?: string
          position?: number
          start_value?: number
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "key_results_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_updates: {
        Row: {
          blocked_on: string | null
          created_at: string
          created_by: string | null
          decision_needed: string | null
          doing_this_week: string | null
          done_last_week: string | null
          id: string
          person_id: string
          submitted_at: string | null
          team_meeting_id: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          blocked_on?: string | null
          created_at?: string
          created_by?: string | null
          decision_needed?: string | null
          doing_this_week?: string | null
          done_last_week?: string | null
          id?: string
          person_id: string
          submitted_at?: string | null
          team_meeting_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocked_on?: string | null
          created_at?: string
          created_by?: string | null
          decision_needed?: string | null
          doing_this_week?: string | null
          done_last_week?: string | null
          id?: string
          person_id?: string
          submitted_at?: string | null
          team_meeting_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_updates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_updates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "meeting_updates_team_meeting_id_fkey"
            columns: ["team_meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          owner_id: string
          position: number
          quarter_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          owner_id: string
          position?: number
          quarter_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          owner_id?: string
          position?: number
          quarter_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "objectives_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      org_meeting_attendees: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_meeting_id: string
          person_id: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_meeting_id: string
          person_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_meeting_id?: string
          person_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_meeting_attendees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meeting_attendees_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meeting_attendees_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["latest_meeting_id"]
          },
          {
            foreignKeyName: "org_meeting_attendees_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["next_meeting_id"]
          },
          {
            foreignKeyName: "org_meeting_attendees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meeting_attendees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "org_meeting_attendees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      org_meetings: {
        Row: {
          concerns_raised: string | null
          created_at: string
          created_by: string | null
          external_attendees: string | null
          follow_up_date: string | null
          follow_up_owner_id: string | null
          id: string
          materials_requested: string | null
          notes: string | null
          organization_id: string
          rating: number | null
          starts_at: string
          summary: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          concerns_raised?: string | null
          created_at?: string
          created_by?: string | null
          external_attendees?: string | null
          follow_up_date?: string | null
          follow_up_owner_id?: string | null
          id?: string
          materials_requested?: string | null
          notes?: string | null
          organization_id: string
          rating?: number | null
          starts_at: string
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          concerns_raised?: string | null
          created_at?: string
          created_by?: string | null
          external_attendees?: string | null
          follow_up_date?: string | null
          follow_up_owner_id?: string | null
          id?: string
          materials_requested?: string | null
          notes?: string | null
          organization_id?: string
          rating?: number | null
          starts_at?: string
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meetings_follow_up_owner_id_fkey"
            columns: ["follow_up_owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meetings_follow_up_owner_id_fkey"
            columns: ["follow_up_owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "org_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meetings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      org_stages: {
        Row: {
          kind: Database["public"]["Enums"]["org_kind"]
          label: string
          outcome: string
          position: number
          stage: string
        }
        ComputedFields: never
        Insert: {
          kind: Database["public"]["Enums"]["org_kind"]
          label: string
          outcome: string
          position: number
          stage: string
        }
        Update: {
          kind?: Database["public"]["Enums"]["org_kind"]
          label?: string
          outcome?: string
          position?: number
          stage?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          archived_at: string | null
          check_size_or_focus: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string
          created_by: string | null
          first_contact_date: string | null
          first_contact_method: Database["public"]["Enums"]["contact_method"] | null
          id: string
          introduced_by: string | null
          key_result_id: string | null
          kind: Database["public"]["Enums"]["org_kind"]
          last_contact_date: string | null
          link: string | null
          name: string
          next_step: string
          next_step_date: string
          notes: string | null
          owner_id: string
          region: Database["public"]["Enums"]["org_region"] | null
          related_organization_id: string | null
          stage: string
          state_or_country: string | null
          subtype: Database["public"]["Enums"]["org_subtype"] | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          check_size_or_focus?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          created_by?: string | null
          first_contact_date?: string | null
          first_contact_method?: Database["public"]["Enums"]["contact_method"] | null
          id?: string
          introduced_by?: string | null
          key_result_id?: string | null
          kind: Database["public"]["Enums"]["org_kind"]
          last_contact_date?: string | null
          link?: string | null
          name: string
          next_step: string
          next_step_date: string
          notes?: string | null
          owner_id: string
          region?: Database["public"]["Enums"]["org_region"] | null
          related_organization_id?: string | null
          stage?: string
          state_or_country?: string | null
          subtype?: Database["public"]["Enums"]["org_subtype"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          check_size_or_focus?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          created_by?: string | null
          first_contact_date?: string | null
          first_contact_method?: Database["public"]["Enums"]["contact_method"] | null
          id?: string
          introduced_by?: string | null
          key_result_id?: string | null
          kind?: Database["public"]["Enums"]["org_kind"]
          last_contact_date?: string | null
          link?: string | null
          name?: string
          next_step?: string
          next_step_date?: string
          notes?: string | null
          owner_id?: string
          region?: Database["public"]["Enums"]["org_region"] | null
          related_organization_id?: string | null
          stage?: string
          state_or_country?: string | null
          subtype?: Database["public"]["Enums"]["org_subtype"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_kind_stage_fkey"
            columns: ["kind", "stage"]
            isOneToOne: false
            referencedRelation: "org_stages"
            referencedColumns: ["kind", "stage"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "organizations_related_organization_id_fkey"
            columns: ["related_organization_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_related_organization_id_fkey"
            columns: ["related_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          contact_preference: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          role: string
          skills: string[]
          sort_order: number
          strengths: string[]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          contact_preference?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          name: string
          role: string
          skills?: string[]
          sort_order: number
          strengths?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          contact_preference?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          skills?: string[]
          sort_order?: number
          strengths?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      quarters: {
        Row: {
          end_date: string
          id: string
          label: string
          share_out_date: string
          share_out_session_id: string | null
          start_date: string
        }
        ComputedFields: never
        Insert: {
          end_date: string
          id?: string
          label: string
          share_out_date: string
          share_out_session_id?: string | null
          start_date: string
        }
        Update: {
          end_date?: string
          id?: string
          label?: string
          share_out_date?: string
          share_out_session_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarters_share_out_session_id_fkey"
            columns: ["share_out_session_id"]
            isOneToOne: false
            referencedRelation: "synthe6_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      synthe6_sessions: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string | null
          deliverables: string | null
          emphasis: Database["public"]["Enums"]["session_emphasis"] | null
          end_date: string
          end_time: string | null
          format: string
          id: string
          is_break: boolean
          notes: string | null
          owner_id: string | null
          start_date: string
          start_time: string | null
          topic: string | null
          updated_at: string
          updated_by: string | null
          week_label: string | null
          week_number: number | null
        }
        ComputedFields: never
        Insert: {
          activity_type: string
          created_at?: string
          created_by?: string | null
          deliverables?: string | null
          emphasis?: Database["public"]["Enums"]["session_emphasis"] | null
          end_date: string
          end_time?: string | null
          format: string
          id?: string
          is_break?: boolean
          notes?: string | null
          owner_id?: string | null
          start_date: string
          start_time?: string | null
          topic?: string | null
          updated_at?: string
          updated_by?: string | null
          week_label?: string | null
          week_number?: number | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          deliverables?: string | null
          emphasis?: Database["public"]["Enums"]["session_emphasis"] | null
          end_date?: string
          end_time?: string | null
          format?: string
          id?: string
          is_break?: boolean
          notes?: string | null
          owner_id?: string | null
          start_date?: string
          start_time?: string | null
          topic?: string | null
          updated_at?: string
          updated_by?: string | null
          week_label?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "synthe6_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synthe6_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synthe6_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "synthe6_sessions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          debrief_id: string | null
          due_date: string
          id: string
          key_result_id: string | null
          next_action: string
          notes: string | null
          org_meeting_id: string | null
          organization_id: string | null
          owner_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          synthe6_session_id: string | null
          team_meeting_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          debrief_id?: string | null
          due_date: string
          id?: string
          key_result_id?: string | null
          next_action: string
          notes?: string | null
          org_meeting_id?: string | null
          organization_id?: string | null
          owner_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          synthe6_session_id?: string | null
          team_meeting_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          debrief_id?: string | null
          due_date?: string
          id?: string
          key_result_id?: string | null
          next_action?: string
          notes?: string | null
          org_meeting_id?: string | null
          organization_id?: string | null
          owner_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          synthe6_session_id?: string | null
          team_meeting_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_debrief_id_fkey"
            columns: ["debrief_id"]
            isOneToOne: false
            referencedRelation: "debriefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["latest_meeting_id"]
          },
          {
            foreignKeyName: "tasks_org_meeting_id_fkey"
            columns: ["org_meeting_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["next_meeting_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "tasks_synthe6_session_id_fkey"
            columns: ["synthe6_session_id"]
            isOneToOne: false
            referencedRelation: "synthe6_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_meeting_id_fkey"
            columns: ["team_meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      team_meetings: {
        Row: {
          created_at: string
          created_by: string | null
          facilitator_id: string
          id: string
          meeting_date: string
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["team_meeting_status"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          facilitator_id: string
          id?: string
          meeting_date: string
          notes?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["team_meeting_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          facilitator_id?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["team_meeting_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_meetings_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_meetings_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "team_meetings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          feature: string | null
          id: number
          kind: string
          occurred_at: string
          path: string
          person_id: string
          section: string
        }
        ComputedFields: never
        Insert: {
          feature?: string | null
          id?: never
          kind: string
          occurred_at?: string
          path: string
          person_id: string
          section: string
        }
        Update: {
          feature?: string | null
          id?: never
          kind?: string
          occurred_at?: string
          path?: string
          person_id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
        ]
      }
    }
    Views: {
      org_overview: {
        Row: {
          archived_at: string | null
          check_size_or_focus: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string | null
          days_since_contact: number | null
          first_contact_date: string | null
          first_contact_method: Database["public"]["Enums"]["contact_method"] | null
          follow_up_overdue: boolean | null
          id: string | null
          introduced_by: string | null
          is_stale: boolean | null
          key_result_id: string | null
          kind: Database["public"]["Enums"]["org_kind"] | null
          last_contact_date: string | null
          latest_meeting_at: string | null
          latest_meeting_id: string | null
          latest_rating: number | null
          latest_summary: string | null
          link: string | null
          name: string | null
          next_meeting_at: string | null
          next_meeting_id: string | null
          next_step: string | null
          next_step_date: string | null
          owner_avatar_url: string | null
          owner_id: string | null
          owner_name: string | null
          region: Database["public"]["Enums"]["org_region"] | null
          related_organization_id: string | null
          stage: string | null
          stage_label: string | null
          stage_outcome: string | null
          stage_position: number | null
          state_or_country: string | null
          subtype: Database["public"]["Enums"]["org_subtype"] | null
          updated_at: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "organizations_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_kind_stage_fkey"
            columns: ["kind", "stage"]
            isOneToOne: false
            referencedRelation: "org_stages"
            referencedColumns: ["kind", "stage"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "person_workload"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "organizations_related_organization_id_fkey"
            columns: ["related_organization_id"]
            isOneToOne: false
            referencedRelation: "org_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_related_organization_id_fkey"
            columns: ["related_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      person_workload: {
        Row: {
          avatar_url: string | null
          debriefs_due: number | null
          is_overloaded: boolean | null
          meetings_next_7_days: number | null
          name: string | null
          open_tasks: number | null
          overdue_follow_ups: number | null
          overdue_tasks: number | null
          person_id: string | null
          role: string | null
          sort_order: number | null
          team_average: number | null
          total_load: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "people_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      wins_feed: {
        Row: {
          actor_id: string | null
          actor_kind: string | null
          after: Json | null
          entity_id: string | null
          entity_type: string | null
          id: number | null
          occurred_at: string | null
          win_kind: string | null
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          actor_kind?: string | null
          after?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number | null
          occurred_at?: string | null
          win_kind?: never
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string | null
          after?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number | null
          occurred_at?: string | null
          win_kind?: never
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      run_scheduled_checks: { Args: Record<PropertyKey, never>; Returns: Json }
      undo_activity: { Args: { p_force?: boolean; p_log_id: number }; Returns: undefined }
    }
    Enums: {
      actor_kind: "person" | "bot"
      availability_label: "class" | "work" | "other"
      candidate_stage: "sourced" | "intro_call" | "trial_project" | "offer" | "joined" | "passed"
      contact_method: "cold_email" | "warm_intro" | "synthe6_event" | "conference" | "other"
      debrief_kind: "synthe6" | "mentor" | "investor" | "customer" | "team_meeting"
      debrief_status: "due" | "done"
      hypothesis_decision: "persevere" | "pivot" | "drop"
      hypothesis_status: "untested" | "validated" | "invalidated"
      org_kind: "investor" | "customer"
      org_region: "ohio" | "midwest" | "rest_of_us" | "international"
      org_subtype:
        | "vc"
        | "angel"
        | "grant_program"
        | "construction_firm"
        | "hard_hat_manufacturer"
        | "safety_distributor"
        | "other"
      session_emphasis: "okr_share_out" | "mentor_coaching" | "demo_day_prep"
      task_priority: "low" | "medium" | "high"
      task_status: "to_do" | "in_progress" | "blocked" | "done"
      team_meeting_status: "upcoming" | "held" | "canceled"
      test_outcome: "supports" | "contradicts" | "inconclusive"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_kind: ["person", "bot"],
      availability_label: ["class", "work", "other"],
      candidate_stage: ["sourced", "intro_call", "trial_project", "offer", "joined", "passed"],
      contact_method: ["cold_email", "warm_intro", "synthe6_event", "conference", "other"],
      debrief_kind: ["synthe6", "mentor", "investor", "customer", "team_meeting"],
      debrief_status: ["due", "done"],
      hypothesis_decision: ["persevere", "pivot", "drop"],
      hypothesis_status: ["untested", "validated", "invalidated"],
      org_kind: ["investor", "customer"],
      org_region: ["ohio", "midwest", "rest_of_us", "international"],
      org_subtype: [
        "vc",
        "angel",
        "grant_program",
        "construction_firm",
        "hard_hat_manufacturer",
        "safety_distributor",
        "other",
      ],
      session_emphasis: ["okr_share_out", "mentor_coaching", "demo_day_prep"],
      task_priority: ["low", "medium", "high"],
      task_status: ["to_do", "in_progress", "blocked", "done"],
      team_meeting_status: ["upcoming", "held", "canceled"],
      test_outcome: ["supports", "contradicts", "inconclusive"],
    },
  },
} as const
