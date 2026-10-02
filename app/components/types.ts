// Presentation-layer type mirrors.
//
// page.tsx (lines 1-303) is frozen and keeps its own local copies of these
// interfaces. These are structurally identical so values flow freely, and
// keeping them here means no frozen line has to be edited to enable extraction.

export interface EligibilitySignal {
  criterion: string;
  status: "match" | "mismatch" | "unknown";
  detail: string;
}

export interface Eligibility {
  match_score: number | null;
  eligibility: string;
  matching_factors: string[];
  potential_gaps: string[];
  unknown_requirements: string[];
  signals: EligibilitySignal[];
  confidence: number;
}

export type DeadlineStatus =
  | "no_deadline"
  | "expired"
  | "today"
  | "critical"
  | "urgent"
  | "upcoming"
  | "normal";

export interface DeadlineIntelligence {
  days_remaining: number | null;
  deadline_status: DeadlineStatus;
  urgency: string;
  is_expired: boolean;
}

export interface Opportunity {
  index: number;
  name: string | null;
  organization: string | null;
  type: string | null;
  deadline: string | null;
  url: string | null;
  summary: string | null;
  confidence: number;
  source_email_id: string | null;
  requirements?: unknown | null;
  eligibility?: Eligibility | null;
  deadline_intelligence?: DeadlineIntelligence | null;
}

export type ReviewStatus = "approved" | "rejected";
export type CardAction = "approve" | "reject";
