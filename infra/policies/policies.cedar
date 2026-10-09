permit (
    principal,
    action == Saans::Action::"whoami",
    resource
)
when {
    principal in Saans::UserGroup::"officer"
};

permit (
    principal,
    action in [
        Saans::Action::"list",
        Saans::Action::"counts",
        Saans::Action::"map",
        Saans::Action::"detail",
        Saans::Action::"evidence",
        Saans::Action::"assign",
        Saans::Action::"mark_in_field",
        Saans::Action::"record_action",
        Saans::Action::"close"
    ],
    resource
)
when {
    principal in Saans::UserGroup::"officer" &&
    ((principal in Saans::UserGroup::"district-sangrur" && resource.district == "sangrur") ||
     (principal in Saans::UserGroup::"district-patiala" && resource.district == "patiala"))
};
