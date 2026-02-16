// Lock & Lockpick System for Wasteland Japan — Vault 811
// Skill-gated locks on containers, doors, and terminals.
// Lock levels 1–4 checked against Quick Hands (primary) or Scavenger (secondary).
// Persistence via quest flags: "unlocked:<objectId>"

const LOCK_LABELS = ["", "Easy", "Average", "Hard", "Master"];

/**
 * Attempt to pick a lock.
 * @param {object} player   - player object with .skills
 * @param {object} questSys - Quest instance for flag persistence
 * @param {object} lockData - { lockId, lockLevel } from userData
 * @returns {{ success:boolean, message:string, alreadyUnlocked:boolean }}
 */
export function attemptLockpick(player, questSys, lockData) {
  const { lockId, lockLevel } = lockData;
  const flagKey = `unlocked:${lockId}`;

  // Already unlocked?
  if (questSys.getFlag(flagKey)) {
    return { success: true, message: "", alreadyUnlocked: true };
  }

  const qh = player.skills.quickHands || 0;
  const scav = player.skills.scavenger || 0;
  const tough = player.skills.toughness || 0;
  const bestSkill = Math.max(qh, scav);
  const label = LOCK_LABELS[lockLevel] || `Lv${lockLevel}`;

  // Primary / secondary skill check
  if (bestSkill >= lockLevel) {
    questSys.setFlag(flagKey, true);
    const usedSkill = qh >= lockLevel ? "Quick Hands" : "Scavenger";
    return {
      success: true,
      message: `[${usedSkill}] Lock picked (${label}).`,
      alreadyUnlocked: false
    };
  }

  // Fallback: Toughness "force" route (needs toughness >= lockLevel + 1)
  if (tough >= lockLevel + 1) {
    questSys.setFlag(flagKey, true);
    return {
      success: true,
      message: `[Toughness] Forced open (${label}). Noisy…`,
      alreadyUnlocked: false,
      forced: true
    };
  }

  // Failure
  return {
    success: false,
    message: `Lock too difficult (${label}). Need Quick Hands or Scavenger ${lockLevel}+.`,
    alreadyUnlocked: false
  };
}

/**
 * Check if a locked object is already unlocked via flags.
 */
export function isUnlocked(questSys, lockId) {
  return !!questSys.getFlag(`unlocked:${lockId}`);
}

/**
 * Build a lock-level label for the interaction hint.
 */
export function lockHintLabel(lockLevel) {
  return LOCK_LABELS[lockLevel] || `Lv${lockLevel}`;
}
