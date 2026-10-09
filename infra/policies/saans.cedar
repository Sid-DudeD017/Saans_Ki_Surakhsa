// Saans Command's access rules (P4). Tests: services/command-api/authz.test.ts (20+ named cases).
// Default deny: anything not permitted below is refused, and the API answers 403.

// A district officer (SDM, District Agriculture Officer) sees and decides every case in their district.
@id("district-officer-own-district")
permit (
  principal,
  action in [
    Saans::Action::"ViewCase", Saans::Action::"ViewEvidence",
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
    Saans::Action::"ViewCase", Saans::Action::"ViewEvidence",
    Saans::Action::"MarkInField", Saans::Action::"RecordActionTaken"
  ],
  resource is Saans::Case
)
when { principal.role == "field_officer" && resource.district == principal.district };

// The state command centre sees every district, and decides only the reports no district covers.
@id("state-admin-views-all")
permit (
  principal,
  action in [Saans::Action::"ViewCase", Saans::Action::"ViewEvidence"],
  resource is Saans::Case
)
when { principal.role == "state_admin" };

@id("state-admin-decides-unassigned")
permit (
  principal,
  action in [
    Saans::Action::"Approve", Saans::Action::"Change", Saans::Action::"Reject",
    Saans::Action::"MarkInField", Saans::Action::"RecordActionTaken", Saans::Action::"Close"
  ],
  resource is Saans::Case
)
when { principal.role == "state_admin" && resource.district == "unassigned" };

// Queues: officers list their own district; the state command centre lists all of them.
@id("list-own-district")
permit (principal, action == Saans::Action::"ListCases", resource is Saans::District)
when {
  (principal.role == "district_officer" || principal.role == "field_officer") && resource.name == principal.district
};

@id("state-admin-lists-all")
permit (principal, action == Saans::Action::"ListCases", resource is Saans::District)
when { principal.role == "state_admin" };

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
