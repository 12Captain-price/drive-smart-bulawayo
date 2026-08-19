/**
 * Hand-written to match supabase/schema.sql.
 *
 * If you ever install the Supabase CLI and link this project, you can replace
 * this file with a generated one for perfect accuracy:
 *   npx supabase gen types typescript --project-id jqrmszbrxrzmnomzwdsk > src/lib/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface Table<Row, Insert, Update = Partial<Insert>> {
  Row: Row;
  Insert: Insert;
  Update: Update;
}

export interface Database {
  public: {
    Tables: {
      packages: Table<
        {
          id: string;
          slug: string;
          name: string;
          price: number;
          lessons: number;
          description: string;
          includes: string[];
          lesson_type: string | null;
        },
        {
          id?: string;
          slug: string;
          name: string;
          price?: number;
          lessons?: number;
          description?: string;
          includes?: string[];
          lesson_type?: string | null;
        }
      >;
      instructors: Table<
        {
          id: string;
          slug: string;
          name: string;
          years: number;
          languages: string;
          bio: string;
          photo: string | null;
          phone: string | null;
        },
        {
          id?: string;
          slug: string;
          name: string;
          years?: number;
          languages?: string;
          bio?: string;
          photo?: string | null;
          phone?: string | null;
        }
      >;
      testimonials: Table<
        { id: string; name: string; rating: number; comment: string; status: "pending" | "published"; created_at: string },
        { id?: string; name: string; rating?: number; comment?: string; status?: "pending" | "published"; created_at?: string }
      >;
      photos: Table<
        {
          id: string;
          src: string;
          caption: string;
          category: "hero" | "gallery" | "about" | "contact";
          status: "pending" | "published";
          created_at: string;
        },
        {
          id?: string;
          src: string;
          caption?: string;
          category: "hero" | "gallery" | "about" | "contact";
          status?: "pending" | "published";
          created_at?: string;
        }
      >;
      promotions: Table<
        {
          id: string;
          title: string;
          description: string;
          flyer: string | null;
          flyer_name: string | null;
          start_date: string | null;
          end_date: string | null;
          status: "active" | "expired";
          package_id: string | null;
          promo_price: number | null;
        },
        {
          id?: string;
          title: string;
          description?: string;
          flyer?: string | null;
          flyer_name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: "active" | "expired";
          package_id?: string | null;
          promo_price?: number | null;
        }
      >;
      tips: Table<
        { id: string; title: string; body: string; attachment: string | null; attachment_name: string | null; attachment_type: string | null },
        { id?: string; title: string; body?: string; attachment?: string | null; attachment_name?: string | null; attachment_type?: string | null }
      >;
      team: Table<
        { id: string; name: string; role: string; bio: string; photo: string | null },
        { id?: string; name: string; role?: string; bio?: string; photo?: string | null }
      >;
      about_sections: Table<
        {
          id: string;
          type: "text" | "text-photo" | "photo";
          heading: string;
          body: string;
          image: string | null;
          image_position: "left" | "right";
          position: number;
        },
        {
          id?: string;
          type: "text" | "text-photo" | "photo";
          heading?: string;
          body?: string;
          image?: string | null;
          image_position?: "left" | "right";
          position?: number;
        }
      >;
      settings: Table<{ id: number; data: Json }, { id?: number; data: Json }>;
      about_content: Table<{ id: number; data: Json }, { id?: number; data: Json }>;
      enquiries: Table<
        {
          id: string;
          ref: string | null;
          name: string;
          phone: string;
          package_id: string | null;
          days: string[];
          times: string[];
          slots: string[];
          status: "new" | "contacted" | "scheduled" | "enrolled" | "completed" | "cancelled";
          created_at: string;
        },
        {
          id?: string;
          ref?: string | null;
          name: string;
          phone: string;
          package_id?: string | null;
          days?: string[];
          times?: string[];
          slots?: string[];
          status?: "new" | "contacted" | "scheduled" | "enrolled" | "completed" | "cancelled";
          created_at?: string;
        }
      >;
      students: Table<
        {
          id: string;
          name: string;
          phone: string;
          package_id: string | null;
          enrolled_at: string;
          status: "active" | "completed";
          enquiry_id: string | null;
        },
        {
          id?: string;
          name: string;
          phone: string;
          package_id?: string | null;
          enrolled_at?: string;
          status?: "active" | "completed";
          enquiry_id?: string | null;
        }
      >;
      payments: Table<
        {
          id: string;
          student_id: string | null;
          name: string;
          phone: string;
          package_id: string | null;
          amount: number;
          reference: string;
          status: "pending" | "confirmed" | "not-found";
          note: string;
          created_at: string;
        },
        {
          id?: string;
          student_id?: string | null;
          name: string;
          phone: string;
          package_id?: string | null;
          amount?: number;
          reference?: string;
          status?: "pending" | "confirmed" | "not-found";
          note?: string;
          created_at?: string;
        }
      >;
      tests: Table<
        {
          id: string;
          title: string;
          type: "mcq" | "pdf";
          minutes: number;
          questions: Json;
          paper: string | null;
          paper_name: string | null;
          answer_key: string | null;
          answer_key_name: string | null;
          answer_key_text: string | null;
          created_at: string;
        },
        {
          id?: string;
          title: string;
          type: "mcq" | "pdf";
          minutes?: number;
          questions?: Json;
          paper?: string | null;
          paper_name?: string | null;
          answer_key?: string | null;
          answer_key_name?: string | null;
          answer_key_text?: string | null;
          created_at?: string;
        }
      >;
      assignments: Table<
        {
          id: string;
          test_id: string;
          student_id: string;
          token: string;
          access_code: string;
          access_code_used: boolean;
          status: "not-started" | "in-progress" | "submitted" | "expired";
          started_at: string | null;
          submitted_at: string | null;
          extension_minutes: number;
          notes: string;
          log: Json;
          results_token: string | null;
          created_at: string;
        },
        {
          id?: string;
          test_id: string;
          student_id: string;
          token: string;
          access_code: string;
          access_code_used?: boolean;
          status?: "not-started" | "in-progress" | "submitted" | "expired";
          started_at?: string | null;
          submitted_at?: string | null;
          extension_minutes?: number;
          notes?: string;
          log?: Json;
          results_token?: string | null;
          created_at?: string;
        }
      >;
      submissions: Table<
        {
          id: string;
          assignment_id: string;
          test_id: string;
          student_id: string;
          answers: Json;
          typed: string | null;
          photo: string | null;
          photo_name: string | null;
          flags: Json;
          auto_score: number | null;
          auto_total: number | null;
          mark: string | null;
          feedback: string | null;
          submitted_at: string;
        },
        {
          id?: string;
          assignment_id: string;
          test_id: string;
          student_id: string;
          answers?: Json;
          typed?: string | null;
          photo?: string | null;
          photo_name?: string | null;
          flags?: Json;
          auto_score?: number | null;
          auto_total?: number | null;
          mark?: string | null;
          feedback?: string | null;
          submitted_at?: string;
        }
      >;
      lessons: Table<
        {
          id: string;
          student_id: string;
          instructor_id: string;
          lesson_type: string;
          starts_at: string;
          minutes: number;
          notes: string;
          status: string;
          created_at: string;
        },
        {
          id?: string;
          student_id: string;
          instructor_id: string;
          lesson_type?: string;
          starts_at: string;
          minutes?: number;
          notes?: string;
          status?: string;
          created_at?: string;
        }
      >;
      instructor_pins: Table<
        { instructor_id: string; pin: string; updated_at: string },
        { instructor_id: string; pin: string; updated_at?: string }
      >;
    };
    Functions: {
      get_test_assignment: { Args: { p_token: string }; Returns: Json };
      get_my_lessons_student: {
        Args: { p_name: string; p_phone_last4: string };
        Returns: Json;
      };
      get_my_lessons_instructor: {
        Args: { p_name: string; p_pin: string };
        Returns: Json;
      };
      instructor_has_pin: { Args: { p_instructor_id: string }; Returns: boolean };
      start_assignment: {
        Args: { p_token: string; p_name: string; p_pin: string; p_code: string };
        Returns: Json;
      };
      submit_assignment: {
        Args: {
          p_token: string;
          p_answers: Json;
          p_typed: string | null;
          p_photo: string | null;
          p_photo_name: string | null;
          p_flags: Json;
          p_auto: boolean;
        };
        Returns: Json;
      };
      get_results: { Args: { p_results_token: string }; Returns: Json };
    };
  };
}