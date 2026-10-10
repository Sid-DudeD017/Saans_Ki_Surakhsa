// Saans Command's access rules (P4). Tests: services/command-api/authz.test.ts (20+ named cases).
// Default deny: anything not permitted below is refused, and the API answers 403.

// A district officer (SDM, District Agriculture Officer) sees and decides every case in their district.
@id("district-officer-own-district")
permit (
  principal,
  action in [
    Saans::Action::"ViewCase", Saans::Action::"ViewEvidence", Saans::Action::"ViewInternalNotes",
    Saans::Action::"Approve", Saans::Action::"Change", Saans::Action::"Reject",
    Saans::Action::"MarkInField", Saans::Action::"RecordActionTaken", Saans::Action::"Close"
  ],
  resource is Saans::Case
)
when { principal.role == "district_officer" && resource.district == principal.district };

// A field officer visits and reports back, but doesn't decide: no machines, rejections or closing.
@id("field-officer-own-district")
permit (
  principal,
  action in [
    Saans::Action::"ViewCase", Saans::Action::"ViewEvidence", Saans::Action::"ViewInternalNotes",
    Saans::Action::"MarkInField", Saans::Action::"RecordActionTaken"
  ],
  resource is Saans::Case
)
when { principal.role == "field_officer" && resource.district == principal.district };

// A citizen can only view their own cases (no internal notes).
@id("citizen-own-tickets")
permit (
  principal,
  action in [
    Saans::Action::"ViewCase", Saans::Action::"ViewEvidence"
  ],
  resource is Saans::Case
)
when { principal.role == "citizen" && resource.reporterId == principal.id };

// Supervisors see station-wide (list all, view all, decide on supervisor_queue).
@id("supervisor-views-all")
permit (
  principal,
  action in [
    Saans::Action::"ViewCase", Saans::Action::"ViewEvidence", Saans::Action::"ViewInternalNotes"
  ],
  resource is Saans::Case
)
when { principal.role == "supervisor" };

@id("supervisor-decides-supervisor-queue")
permit (
  principal,
  action in [
    Saans::Action::"Approve", Saans::Action::"Change", Saans::Action::"Reject",
    Saans::Action::"MarkInField", Saans::Action::"RecordActionTaken", Saans::Action::"Close"
  ],
  resource is Saans::Case
)
when { principal.role == "supervisor" && resource.district == "supervisor_queue" };

// Queues: officers list their own district.
@id("list-own-district")
permit (principal, action == Saans::Action::"ListCases", resource is Saans::District)
when {
  (principal.role == "district_officer" || principal.role == "field_officer") && resource.name == principal.district
};

// Supervisors list all districts.
@id("supervisor-lists-all")
permit (principal, action == Saans::Action::"ListCases", resource is Saans::District)
when { principal.role == "supervisor" };

// Who reported is shown only to the district officer, and only if the reporter agreed. Protects reporters
// and stops reports being used to harass farmers.
@id("reporter-identity-with-consent")
permit (principal, action == Saans::Action::"ViewReporter", resource is Saans::Case)
when { principal.role == "district_officer" && resource.district == principal.district && resource.reporterConsent };

// A closed case is a record: it can be read, not changed.
@id("closed-cases-are-read-only")
forbid (
  principal,
  action in [
    Saans::Action::"Approve", Saans::Action::"Change", Saans::Action::"Reject",
    Saans::Action::"MarkInField", Saans::Action::"RecordActionTaken", Saans::Action::"Close"
  ],
  resource is Saans::Case
)
when { resource.status == "CLOSED" };

// A machine can be sent, changed or turned down only where a farmer asked for one.
@id("machines-need-a-help-request")
forbid (
  principal,
  action in [Saans::Action::"Approve", Saans::Action::"Change", Saans::Action::"Reject"],
  resource is Saans::Case
)
unless { resource.hasHelpRequest };
