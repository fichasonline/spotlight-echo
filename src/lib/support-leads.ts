const CHAT_LEAD_SOURCES = new Set(["chat_widget"]);

export function isChatLeadSource(source?: string | null): boolean {
  return CHAT_LEAD_SOURCES.has((source ?? "").trim().toLowerCase());
}

export function isChatLead(lead: { source?: string | null }): boolean {
  return isChatLeadSource(lead.source);
}

export function isLandingLead(lead: { source?: string | null }): boolean {
  return !isChatLeadSource(lead.source);
}
