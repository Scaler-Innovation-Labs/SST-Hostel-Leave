// =====================================================
// AUDIT ACTOR DESCRIPTOR
// src/constants/audit/actor.ts
// =====================================================
//
// Not every audited change has a logged-in user behind it. Scheduled passes
// (cron jobs) and off-platform actors (a parent approving over SMS) both
// produce real audit rows — but `audit_logs.actor_user_id` is a uuid FK to
// `users`, so a label like "SYSTEM" can never live there. Those records are
// written with a NULL actor id plus an `actorType` descriptor in metadata,
// so the trail still says who — or what — caused the transition.

/** Who — or what — caused an audited change when no user is logged in. */
export const ACTOR_TYPE = {
  /** Automated work: cron jobs and scheduled lifecycle passes. */
  SYSTEM: "SYSTEM",
  /** A parent acting through an approval link or SMS reply. */
  PARENT: "PARENT",
} as const;

export type ActorType = (typeof ACTOR_TYPE)[keyof typeof ACTOR_TYPE];

/** What invoked an actor that is not a user session. */
export const AUDIT_TRIGGER = {
  CRON: "CRON",
  SMS: "SMS",
} as const;

export type AuditTrigger = (typeof AUDIT_TRIGGER)[keyof typeof AUDIT_TRIGGER];

/**
 * The acting identity passed around the services.
 *
 * `id` is the `users.id` value used by the uuid FK columns, so a null id
 * means "there is no user account behind this" — a scheduled pass, or an
 * off-platform actor. `job` names the scheduled pass that ran, so a single
 * audit trail can tell repeated nightly passes apart.
 */
export type ActingRef = {
  id: string | null;
  job?: string;
  trigger?: AuditTrigger;
};

/** Metadata keys describing a non-user actor. */
export const ACTOR_METADATA_KEY = {
  ACTOR_TYPE: "actorType",
  TRIGGER: "trigger",
  JOB: "job",
} as const;

/**
 * Acting identity for a scheduled/system pass, labelled with its job name.
 * Jobs must use this rather than a bare string: the id has to be null
 * (uuid column) and the job name has to travel with it into the audit row.
 */
export function systemActor(
  job: string,
  trigger: AuditTrigger = AUDIT_TRIGGER.CRON
): ActingRef {
  return { id: null, job, trigger };
}

/**
 * Metadata fragment describing a non-user actor. User actors produce nothing:
 * their identity is already in `actor_user_id`.
 */
export function actorDescriptor(actor: ActingRef): Record<string, unknown> {
  if (actor.id !== null) {
    return {};
  }

  return {
    [ACTOR_METADATA_KEY.ACTOR_TYPE]: ACTOR_TYPE.SYSTEM,
    [ACTOR_METADATA_KEY.TRIGGER]: actor.trigger ?? AUDIT_TRIGGER.CRON,
    ...(actor.job ? { [ACTOR_METADATA_KEY.JOB]: actor.job } : {}),
  };
}
