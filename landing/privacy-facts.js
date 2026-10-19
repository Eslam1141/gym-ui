// The facts only the owner can supply. This is the ONE place to fill in
// (privacy-page.js renders them into the policy text, in both languages).
//
//   - A value left as "" is unfilled: the policy shows its [PLACEHOLDER]
//     token and the "Draft - not yet in effect" banner stays up. The banner
//     goes away by itself once every value below is filled.
//   - DPO and BACKUP_DAYS can be set to false instead: "no Data Protection
//     Officer appointed" / "we keep no backups". That removes the DPO line
//     and the Backups row from the policy.
//   - EFFECTIVE_DATE is written per language, e.g.
//     { en: "19 October 2026", ar: "19 أكتوبر 2026" }.
//   - FEEDBACK_TTL_LIVE: true now that gym-be deletes feedback automatically
//     (precondition C1), so the policy shows the 90 days / 12 months / 6
//     months schedule. false would show the fallback sentence (deleted once
//     handled, or with the account).
window.PRIVACY_FACTS = {
  LEGAL_ENTITY_NAME: "",
  STATE: "",
  REGISTERED_ADDRESS: "",
  PRIVACY_EMAIL: "",
  DPO: "",
  HOSTING_COUNTRY: "",
  BACKUP_DAYS: "",
  LOG_DAYS: "",
  EFFECTIVE_DATE: { en: "", ar: "" },
  FEEDBACK_TTL_LIVE: true
};
