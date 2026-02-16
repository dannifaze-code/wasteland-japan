// Dialogue System for Wasteland Japan — Vault 811
// Manages dialogue trees with branching choices, skill checks, quest hooks, and vendor hooks.
// Expanded for Act 1 quests: Q1-Q4 with branching, reputation, and quest state actions.

// ---- Inventory Helpers ----
function removeItem(player, itemId, qty) {
  const item = player.inv.find(x => x.id === itemId);
  if (!item) return;
  item.qty = (item.qty || 1) - qty;
  if (item.qty <= 0) player.inv.splice(player.inv.indexOf(item), 1);
}

function addItem(player, itemId, qty) {
  const existing = player.inv.find(x => x.id === itemId);
  if (existing) existing.qty = (existing.qty || 1) + qty;
  else player.inv.push({ id: itemId, qty });
}

function hasItem(player, itemId, qty) {
  const item = player.inv.find(x => x.id === itemId);
  return item && (item.qty || 1) >= (qty || 1);
}

// ---- Quest/Rep helper shortcuts (game.questSys is the Quest instance) ----
function Q(game) { return game.questSys; }

// ---- Dynamic start node resolution ----
// Each tree can have a "startFn" that returns a node id based on quest state.
// If not present, falls back to "start" string.

// ---- Dialogue Tree Data ----
export const DialogueTrees = {

  // ===================== OVERSEER TANAKA =====================
  // Q1: "The Permission Lie"
  overseer_tanaka: {
    start: "greeting",
    startFn: (player, game) => {
      const q = Q(game);
      if (q.getFlag("vaultLieRevealed")) return "greeting_suspicious";
      if (q.getStage("q1_permission_lie") >= 30) return "greeting_done";
      if (q.getStage("q1_permission_lie") >= 10) return "greeting_active";
      return "greeting";
    },
    nodes: {
      greeting: {
        id: "greeting",
        speaker: "Overseer Tanaka",
        text: "You're awake. Good. Vault 811 isn't a shelter anymore — it's a staging ground. The surface is worse than the briefings said. Much worse.",
        choices: [
          { text: "What happened out there?", next: "whathappened" },
          { text: "What do you need me to do?", next: "quest_offer" },
          { text: "I'll figure it out myself.", next: "goodbye" }
        ]
      },
      whathappened: {
        id: "whathappened",
        speaker: "Overseer Tanaka",
        text: "Mutations, radiation storms, hostile scavenger gangs. Our recon teams haven't come back. The last one reported a shrine outpost to the north — could be a settlement, could be a trap.",
        choices: [
          { text: "I'll check it out.", next: "quest_accept" },
          { text: "Sounds dangerous. What's in it for me?", next: "reward_info" },
          { text: "Not my problem.", next: "goodbye" }
        ]
      },
      reward_info: {
        id: "reward_info",
        speaker: "Overseer Tanaka",
        text: "Supplies. Weapons. Information. Yuki in medical has stims — talk to her. And Kenji at the door can brief you on the hostiles. Follow the Surface Clearance Protocol and you'll have full access.",
        choices: [
          { text: "Fine. I'll investigate the shrine.", next: "quest_accept" },
          { text: "What exactly is the 'Surface Clearance Protocol'?", next: "protocol_question" },
          { text: "I need to prepare first.", next: "goodbye" }
        ]
      },
      protocol_question: {
        id: "protocol_question",
        speaker: "Overseer Tanaka",
        text: "Standard procedure. Complete assigned recon tasks, report findings, receive clearance upgrades. It's how we ensure the surface is safe for expansion. Nothing unusual.",
        choices: [
          { text: "Sounds reasonable. I'll do it.", next: "quest_accept" },
          {
            text: "[Toughness 2] That sounds rehearsed. What aren't you telling me?",
            next: "protocol_pushback",
            conditionLabel: "[Toughness 2]",
            condition: (player) => (player.skills.toughness || 0) >= 2
          },
          { text: "I'll think about it.", next: "goodbye" }
        ]
      },
      protocol_pushback: {
        id: "protocol_pushback",
        speaker: "Overseer Tanaka",
        text: "...You're perceptive. But perception without discipline gets people killed. Do the job. Prove yourself. Then we'll talk about what's behind the curtain.",
        choices: [
          { text: "Fair enough. I'll play along — for now.", next: "quest_accept" },
          { text: "I don't trust you, Tanaka.", next: "quest_accept_distrust" }
        ],
        effect: (player, game) => {
          Q(game).setFlag("tanakaPushback", true);
        }
      },
      quest_offer: {
        id: "quest_offer",
        speaker: "Overseer Tanaka",
        text: "A recon team went dark near a shrine outpost north of here. Find them — or find out what happened. Complete this as part of the Surface Clearance Protocol and report back.",
        choices: [
          { text: "Consider it done.", next: "quest_accept" },
          {
            text: "[Toughness 2] I've survived worse. Give me the hard briefing.",
            next: "quest_accept_tough",
            conditionLabel: "[Toughness 2]",
            condition: (player) => (player.skills.toughness || 0) >= 2
          },
          { text: "Not yet. I need to gear up.", next: "goodbye" }
        ]
      },
      quest_accept: {
        id: "quest_accept",
        speaker: "Overseer Tanaka",
        text: "Good. Head through the vault door when ready. Stay sharp out there — the wasteland doesn't give second chances.",
        choices: [
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          if (q.getStage("q1_permission_lie") < 10) {
            q.setStage("q1_permission_lie", 10);
            q.addObjective("Investigate the shrine outpost");
            q.addObjective("Talk to Medic Yuki for supplies");
            q.addLog("Overseer Tanaka assigned surface recon via 'Surface Clearance Protocol'.");
            q.changeRep("vault", 5);
            game.ui.showToast("Quest started: The Permission Lie");
          }
        }
      },
      quest_accept_tough: {
        id: "quest_accept_tough",
        speaker: "Overseer Tanaka",
        text: "Ha. You've got steel in you. The recon team reported crawler nests along the route. Hit hard, move fast. There may be stalkers too — bigger, meaner. Don't let them spit on you.",
        choices: [
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          if (q.getStage("q1_permission_lie") < 10) {
            q.setStage("q1_permission_lie", 10);
            q.addObjective("Investigate the shrine outpost");
            q.addObjective("Talk to Medic Yuki for supplies");
            q.addLog("Tanaka gave a tough briefing — crawler nests, stalkers. He respects strength.");
            q.changeRep("vault", 10);
            game.ui.showToast("Quest started: The Permission Lie");
          }
        }
      },
      quest_accept_distrust: {
        id: "quest_accept_distrust",
        speaker: "Overseer Tanaka",
        text: "Trust is earned, not owed. Do the job. We'll see where we stand after.",
        choices: [
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          if (q.getStage("q1_permission_lie") < 10) {
            q.setStage("q1_permission_lie", 10);
            q.addObjective("Investigate the shrine outpost");
            q.addObjective("Talk to Medic Yuki for supplies");
            q.addLog("Accepted Tanaka's mission but openly distrusted him.");
            q.changeRep("vault", -5);
            game.ui.showToast("Quest started: The Permission Lie");
          }
        }
      },
      // --- Active quest return dialogue ---
      greeting_active: {
        id: "greeting_active",
        speaker: "Overseer Tanaka",
        text: "You're still here? The shrine outpost won't investigate itself. Head through the door when you're ready.",
        choices: [
          { text: "I'm gearing up. What about the Clearance Protocol?", next: "protocol_remind" },
          { text: "About that protocol — Rin told me something interesting.", next: "confront_lie",
            condition: (player, game) => Q(game).getFlag("rinLogFragment"),
            conditionLabel: "[Rin's Log Fragment]"
          },
          { text: "On my way.", next: "goodbye" }
        ]
      },
      protocol_remind: {
        id: "protocol_remind",
        speaker: "Overseer Tanaka",
        text: "Complete the recon. Report back. That's your clearance path. Simple.",
        choices: [
          { text: "Got it.", next: "goodbye" }
        ]
      },
      confront_lie: {
        id: "confront_lie",
        speaker: "Overseer Tanaka",
        text: "...Where did you get that? Those vault logs are classified for a reason. You're playing a dangerous game.",
        choices: [
          {
            text: "[Toughness 3] I'm not playing. The Protocol is a lie, isn't it?",
            next: "confront_reveal",
            conditionLabel: "[Toughness 3]",
            condition: (player) => (player.skills.toughness || 0) >= 3
          },
          { text: "Rin found it in the archives. I just read it.", next: "confront_deflect" },
          { text: "Forget I said anything.", next: "goodbye" }
        ]
      },
      confront_reveal: {
        id: "confront_reveal",
        speaker: "Overseer Tanaka",
        text: "...Fine. The 'Surface Clearance Protocol' was never real. We made it up to give people purpose. To keep them from panicking. Japan didn't recover. There's no 'clearance' — just survival.",
        choices: [
          { text: "You've been lying to everyone.", next: "confront_outcome" },
          { text: "I understand why you did it. But I need to know the truth going forward.", next: "confront_outcome_understanding" }
        ],
        effect: (player, game) => {
          Q(game).setFlag("vaultLieRevealed", true);
          Q(game).addLog("BIG REVEAL: The Surface Clearance Protocol is a fabrication. Japan never recovered.");
        }
      },
      confront_deflect: {
        id: "confront_deflect",
        speaker: "Overseer Tanaka",
        text: "Rin should mind her own business. And so should you. Focus on the mission. The Protocol exists for a reason, even if you don't understand it yet.",
        choices: [
          { text: "Fine. For now.", next: "goodbye" }
        ],
        effect: (player, game) => {
          Q(game).changeRep("vault", -5);
        }
      },
      confront_outcome: {
        id: "confront_outcome",
        speaker: "Overseer Tanaka",
        text: "I did what I had to. These people needed hope. You can hate me for it, but the vault is still standing because of that lie. Take this keycard — you've earned access to the restricted wing. Use it wisely.",
        choices: [
          { text: "Take the keycard and leave.", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setStage("q1_permission_lie", 31);
          q.completeObjective("Investigate the shrine outpost");
          q.addObjective("Explore with the Vault Keycard");
          q.changeRep("vault", -15);
          addItem(player, "vaultKeycard", 1);
          game.ui.showToast("Received: Vault Keycard — Quest completed (rebel path)");
        }
      },
      confront_outcome_understanding: {
        id: "confront_outcome_understanding",
        speaker: "Overseer Tanaka",
        text: "...Thank you. Not many would react that way. Take this keycard — I trust you to handle what's beyond. Just... don't tell the others. Not yet.",
        choices: [
          { text: "Your secret is safe. For now.", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setStage("q1_permission_lie", 31);
          q.completeObjective("Investigate the shrine outpost");
          q.addObjective("Explore with the Vault Keycard");
          q.changeRep("vault", 5);
          addItem(player, "vaultKeycard", 1);
          game.ui.showToast("Received: Vault Keycard — Quest completed (understanding path)");
        }
      },
      // --- Completed quest / loyal path ---
      greeting_done: {
        id: "greeting_done",
        speaker: "Overseer Tanaka",
        text: "You've done good work. The vault is safer because of you. Keep following the Protocol.",
        choices: [
          { text: "Will do.", next: "goodbye" },
          { text: "Anything else you need?", next: "goodbye" }
        ]
      },
      // --- After lie is revealed ---
      greeting_suspicious: {
        id: "greeting_suspicious",
        speaker: "Overseer Tanaka",
        text: "...You know the truth now. I won't pretend otherwise. Just remember — the vault still needs order. Don't burn it all down.",
        choices: [
          { text: "I'm not your enemy, Tanaka.", next: "suspicious_ally" },
          { text: "Maybe this vault needs a different kind of order.", next: "goodbye" }
        ]
      },
      suspicious_ally: {
        id: "suspicious_ally",
        speaker: "Overseer Tanaka",
        text: "Then prove it. Out there. In here. Actions matter more than words.",
        choices: [
          { text: "[End]", next: null }
        ]
      },
      // --- Loyal path completion (return from shrine without rebel branch) ---
      quest_report_loyal: {
        id: "quest_report_loyal",
        speaker: "Overseer Tanaka",
        text: "Good report. The Protocol continues. Take this keycard — you've earned elevated access within the vault.",
        choices: [
          { text: "Thank you, Overseer.", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setStage("q1_permission_lie", 30);
          q.completeObjective("Investigate the shrine outpost");
          q.changeRep("vault", 15);
          addItem(player, "vaultKeycard", 1);
          player.skillPoints = (player.skillPoints || 0) + 1;
          game.ui.showToast("Received: Vault Keycard + 1 Skill Point — Quest completed (loyal)");
        }
      },
      goodbye: {
        id: "goodbye",
        speaker: "Overseer Tanaka",
        text: "Don't take too long. The surface won't wait.",
        choices: [
          { text: "[End]", next: null }
        ]
      }
    }
  },

  // ===================== MEDIC YUKI =====================
  // Q2: "Medicine for the Outside"
  medic_yuki: {
    start: "greeting",
    startFn: (player, game) => {
      const q = Q(game);
      if (q.getStage("q2_medicine_outside") >= 30) return "greeting_q2done";
      if (q.getStage("q2_medicine_outside") >= 10) return "greeting_q2active";
      if (q.getStage("q1_permission_lie") >= 10) return "greeting_q1active";
      return "greeting";
    },
    nodes: {
      greeting: {
        id: "greeting",
        speaker: "Medic Yuki",
        text: "Welcome to medical. I'm Yuki — I keep people breathing in this vault. Need something?",
        choices: [
          { text: "What do you have for sale?", next: "vendor" },
          { text: "Any advice for the surface?", next: "advice" },
          { text: "Never mind.", next: "goodbye" }
        ]
      },
      greeting_q1active: {
        id: "greeting_q1active",
        speaker: "Medic Yuki",
        text: "Tanaka sent you, didn't he? Good. You'll need supplies out there. I can trade... but I also have a favor to ask.",
        choices: [
          { text: "What do you need?", next: "q2_offer" },
          { text: "Just trade for now.", next: "vendor" },
          { text: "Maybe later.", next: "goodbye" }
        ],
        effect: (player, game) => {
          Q(game).completeObjective("Talk to Medic Yuki for supplies");
        }
      },
      // --- Q2 Quest Offer ---
      q2_offer: {
        id: "q2_offer",
        speaker: "Medic Yuki",
        text: "People outside the vault — scavengers, drifters — they're dying of radiation sickness. I can craft Rad-Away in bulk, but I need materials. 3 Scrap Metal and 2 Cloth. Bring me those and I'll make enough for everyone.",
        choices: [
          { text: "I'll get your supplies.", next: "q2_accept" },
          { text: "What's in it for me?", next: "q2_reward_info" },
          { text: "Those supplies are valuable. I might need them.", next: "q2_refuse" }
        ]
      },
      q2_reward_info: {
        id: "q2_reward_info",
        speaker: "Medic Yuki",
        text: "Besides saving lives? I'll give you a full medical kit — stims, Rad-Away, the works. And I'll discount future trades. Fair?",
        choices: [
          { text: "Fair. I'll find the supplies.", next: "q2_accept" },
          { text: "I'll think about it.", next: "goodbye" }
        ]
      },
      q2_accept: {
        id: "q2_accept",
        speaker: "Medic Yuki",
        text: "Thank you. 3 Scrap and 2 Cloth — bring them when you can. People are counting on this.",
        choices: [
          { text: "I'll be back.", next: "goodbye" }
        ],
        effect: (player, game) => {
          const q = Q(game);
          if (q.getStage("q2_medicine_outside") < 10) {
            q.setStage("q2_medicine_outside", 10);
            q.addObjective("Bring Yuki 3 Scrap and 2 Cloth");
            q.addLog("Medic Yuki asked for 3 Scrap + 2 Cloth to craft Rad-Away for wasteland survivors.");
            game.ui.showToast("Quest started: Medicine for the Outside");
          }
        }
      },
      q2_refuse: {
        id: "q2_refuse",
        speaker: "Medic Yuki",
        text: "...I understand. Survival comes first out here. But if you change your mind, you know where to find me.",
        choices: [
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          Q(game).changeRep("vault", -5);
        }
      },
      // --- Q2 Active return ---
      greeting_q2active: {
        id: "greeting_q2active",
        speaker: "Medic Yuki",
        text: "You're back. Do you have the supplies? I need 3 Scrap and 2 Cloth.",
        choices: [
          { text: "Here — 3 Scrap and 2 Cloth.", next: "q2_deliver",
            condition: (player) => hasItem(player, "scrap", 3) && hasItem(player, "cloth", 2),
            conditionLabel: "[3 Scrap + 2 Cloth]"
          },
          { text: "Not yet. I'm still looking.", next: "vendor_active" },
          { text: "I'm keeping the supplies for myself.", next: "q2_keep" }
        ]
      },
      q2_deliver: {
        id: "q2_deliver",
        speaker: "Medic Yuki",
        text: "You did it. This is enough for a full batch of Rad-Away. Those people outside... they might actually make it now. Here — you earned this.",
        choices: [
          { text: "Glad to help.", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          removeItem(player, "scrap", 3);
          removeItem(player, "cloth", 2);
          addItem(player, "stim", 3);
          addItem(player, "radaway", 2);
          q.setStage("q2_medicine_outside", 30);
          q.completeObjective("Bring Yuki 3 Scrap and 2 Cloth");
          q.changeRep("vault", 10);
          q.changeRep("wardens", 5);
          q.addLog("Delivered supplies to Yuki. Received medical supplies as reward.");
          game.ui.showToast("Quest complete: Medicine for the Outside (+3 Stim, +2 Rad-Away)");
        }
      },
      q2_keep: {
        id: "q2_keep",
        speaker: "Medic Yuki",
        text: "...I won't pretend that doesn't hurt. People will suffer because of that choice. But I can't force your hand.",
        choices: [
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setStage("q2_medicine_outside", 31);
          q.failObjective("Bring Yuki 3 Scrap and 2 Cloth");
          q.changeRep("vault", -10);
          q.addLog("Refused to help Yuki. Kept the supplies.");
          game.ui.showToast("Quest failed: Medicine for the Outside");
        }
      },
      // --- Q2 Done ---
      greeting_q2done: {
        id: "greeting_q2done",
        speaker: "Medic Yuki",
        text: "The Rad-Away batch is brewing. You saved lives today. Need anything else?",
        choices: [
          { text: "What do you have for trade?", next: "vendor" },
          { text: "Just checking in.", next: "goodbye" }
        ]
      },
      // --- Vendor (existing trades preserved) ---
      vendor: {
        id: "vendor",
        speaker: "Medic Yuki",
        text: "I can trade stims and Rad-Away for scrap. It's not charity, but it'll keep you alive out there.",
        choices: [
          { text: "Trade: 2 Scrap → 1 Field Stim", next: "trade_stim",
            condition: (player) => hasItem(player, "scrap", 2),
            conditionLabel: "[2 Scrap]"
          },
          { text: "Trade: 1 Scrap + 1 Circuit → 1 Rad-Away", next: "trade_radaway",
            condition: (player) => hasItem(player, "scrap", 1) && hasItem(player, "circuits", 1),
            conditionLabel: "[1 Scrap + 1 Circuit]"
          },
          { text: "Maybe later.", next: "goodbye" }
        ]
      },
      vendor_active: {
        id: "vendor_active",
        speaker: "Medic Yuki",
        text: "I can still trade in the meantime. What do you need?",
        choices: [
          { text: "Trade: 2 Scrap → 1 Field Stim", next: "trade_stim",
            condition: (player) => hasItem(player, "scrap", 2),
            conditionLabel: "[2 Scrap]"
          },
          { text: "Trade: 1 Scrap + 1 Circuit → 1 Rad-Away", next: "trade_radaway",
            condition: (player) => hasItem(player, "scrap", 1) && hasItem(player, "circuits", 1),
            conditionLabel: "[1 Scrap + 1 Circuit]"
          },
          { text: "I'll come back later.", next: "goodbye" }
        ]
      },
      trade_stim: {
        id: "trade_stim",
        speaker: "Medic Yuki",
        text: "Here you go. One Field Stim. Use it wisely — I don't have unlimited supply.",
        choices: [
          { text: "Thanks. Anything else?", next: "vendor" },
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          removeItem(player, "scrap", 2);
          addItem(player, "stim", 1);
          game.ui.showToast("Received: Field Stim");
        }
      },
      trade_radaway: {
        id: "trade_radaway",
        speaker: "Medic Yuki",
        text: "Rad-Away, fresh batch. Well... as fresh as irradiated chemistry gets.",
        choices: [
          { text: "Thanks. Anything else?", next: "vendor" },
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          removeItem(player, "scrap", 1);
          removeItem(player, "circuits", 1);
          addItem(player, "radaway", 1);
          game.ui.showToast("Received: Rad-Away");
        }
      },
      advice: {
        id: "advice",
        speaker: "Medic Yuki",
        text: "Radiation accumulates fast out there. Keep Rad-Away on you. If your RAD hits 60, you start taking health damage. And watch for crawler nests — the bites inject toxins.",
        choices: [
          {
            text: "[Scavenger 1] Any tips on finding supplies?",
            next: "advice_scavenger",
            conditionLabel: "[Scavenger 1]",
            condition: (player) => (player.skills.scavenger || 0) >= 1
          },
          { text: "Got it. Thanks.", next: "goodbye" }
        ]
      },
      advice_scavenger: {
        id: "advice_scavenger",
        speaker: "Medic Yuki",
        text: "You've got good instincts. Check industrial zones — the old factories have circuit boards and scrap. Forest shrines sometimes have cloth near the offerings. And enemy corpses? Always loot them.",
        choices: [
          { text: "Useful. Thanks.", next: "goodbye" }
        ]
      },
      goodbye: {
        id: "goodbye",
        speaker: "Medic Yuki",
        text: "Stay safe. Come back if you need patching up.",
        choices: [
          { text: "[End]", next: null }
        ]
      }
    }
  },

  // ===================== GUARD KENJI =====================
  // Q3: "Rail Whisper"
  guard_kenji: {
    start: "greeting",
    startFn: (player, game) => {
      const q = Q(game);
      if (q.getStage("q3_rail_whisper") >= 30) return "greeting_q3done";
      if (q.getStage("q3_rail_whisper") >= 10) return "greeting_q3active";
      if (q.getStage("q1_permission_lie") >= 10) return "greeting_q1aware";
      return "greeting";
    },
    nodes: {
      greeting: {
        id: "greeting",
        speaker: "Guard Kenji",
        text: "Hey, vault-dweller. I'm Kenji — I guard this door. Not that anything's tried to get in... yet.",
        choices: [
          { text: "What's out there?", next: "intel" },
          { text: "Can you teach me anything?", next: "training" },
          { text: "Stay sharp.", next: "goodbye" }
        ]
      },
      greeting_q1aware: {
        id: "greeting_q1aware",
        speaker: "Guard Kenji",
        text: "Heard you're doing recon for Tanaka. Good. But listen... I've been picking up something weird on the guard radio. Faint pings. Repeating patterns. Coming from the collapsed rail station area.",
        choices: [
          { text: "Radio pings? Like a signal?", next: "q3_offer" },
          { text: "I have enough to worry about. What about combat tips?", next: "training" },
          { text: "Stay sharp.", next: "goodbye" }
        ]
      },
      // --- Q3 Quest Offer ---
      q3_offer: {
        id: "q3_offer",
        speaker: "Guard Kenji",
        text: "Exactly like a signal. Coded. Not vault frequency. Could be scavengers, could be something else. I can't leave my post to check. If you're heading out there anyway...",
        choices: [
          { text: "I'll investigate the radio signals.", next: "q3_accept" },
          {
            text: "[Iron Sights 1] Could be a trap. Any tactical advice?",
            next: "q3_tactical",
            conditionLabel: "[Iron Sights 1]",
            condition: (player) => (player.skills.ironSights || 0) >= 1
          },
          { text: "I'll think about it.", next: "goodbye" }
        ]
      },
      q3_tactical: {
        id: "q3_tactical",
        speaker: "Guard Kenji",
        text: "Smart thinking. The rail stations have tight corridors — shotgun territory. And if someone is sending coded signals, they're organized. Don't assume friendly. Here, take these extra rounds.",
        choices: [
          { text: "I'll check it out.", next: "q3_accept" },
          { text: "Not right now.", next: "goodbye" }
        ],
        effect: (player, game) => {
          player.reserve.shotgun = (player.reserve.shotgun || 0) + 12;
          game.ui.showToast("Received: +12 Shotgun Shells");
        }
      },
      q3_accept: {
        id: "q3_accept",
        speaker: "Guard Kenji",
        text: "Good. The signals come from the west — industrial coast, near the collapsed rail stations. Find the source and report back to me. Don't tell Tanaka yet — I want to know what we're dealing with first.",
        choices: [
          { text: "Understood. I'll report back.", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          if (q.getStage("q3_rail_whisper") < 10) {
            q.setStage("q3_rail_whisper", 10);
            q.addObjective("Investigate radio signals near the rail stations");
            q.addLog("Guard Kenji detected coded radio pings from the collapsed rail area. Investigating secretly.");
            game.ui.showToast("Quest started: Rail Whisper");
          }
        }
      },
      // --- Q3 Active return ---
      greeting_q3active: {
        id: "greeting_q3active",
        speaker: "Guard Kenji",
        text: "Find anything about those radio signals yet?",
        choices: [
          { text: "I reached a rail station. The signals are from a group called the Rail Ghost Union.", next: "q3_report_truth",
            condition: (player, game) => Q(game).getFlag("reachedRailStation"),
            conditionLabel: "[Reached Rail Station]"
          },
          { text: "Nothing yet. Still searching.", next: "q3_wait" },
          { text: "I found the source, but I'm not sure you need to know.", next: "q3_withhold",
            condition: (player, game) => Q(game).getFlag("reachedRailStation"),
            conditionLabel: "[Reached Rail Station]"
          }
        ]
      },
      q3_report_truth: {
        id: "q3_report_truth",
        speaker: "Guard Kenji",
        text: "Rail Ghost Union... I've heard whispers. Salvagers living in the tunnels. They're not hostile — at least not by default. This is valuable intel. I'll include it in my security report. Thank you.",
        choices: [
          { text: "Glad I could help.", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setStage("q3_rail_whisper", 30);
          q.completeObjective("Investigate radio signals near the rail stations");
          q.changeRep("vault", 10);
          q.changeRep("rail", -5);
          player.skillPoints = (player.skillPoints || 0) + 1;
          q.addLog("Reported Rail Ghost Union signals to Kenji. Vault security strengthened.");
          game.ui.showToast("Quest complete: Rail Whisper (+1 Skill Point, +Vault rep)");
        }
      },
      q3_withhold: {
        id: "q3_withhold",
        speaker: "Guard Kenji",
        text: "...What do you mean? You found something and you're not telling me? That's not how this works.",
        choices: [
          { text: "Some things are better left between me and the wasteland.", next: "q3_secret" },
          { text: "Fine. It's the Rail Ghost Union — salvagers in the tunnels.", next: "q3_report_truth" }
        ]
      },
      q3_secret: {
        id: "q3_secret",
        speaker: "Guard Kenji",
        text: "...I trusted you with this. Whatever game you're playing, it better be worth it. Don't expect me to cover for you.",
        choices: [
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setStage("q3_rail_whisper", 31);
          q.completeObjective("Investigate radio signals near the rail stations");
          q.changeRep("vault", -10);
          q.changeRep("rail", 15);
          addItem(player, "scrap", 5);
          q.addLog("Kept Rail Ghost Union secret from Kenji. Earned Rail Ghost trust.");
          game.ui.showToast("Quest complete: Rail Whisper (secret path, +Rail rep, +5 Scrap)");
        }
      },
      q3_wait: {
        id: "q3_wait",
        speaker: "Guard Kenji",
        text: "Keep at it. Those signals aren't random — someone out there is organized. I need to know if they're a threat.",
        choices: [
          { text: "I'll find them.", next: "goodbye" }
        ]
      },
      // --- Q3 Done ---
      greeting_q3done: {
        id: "greeting_q3done",
        speaker: "Guard Kenji",
        text: "Signal mystery sorted. Thanks for the intel. What else do you need?",
        choices: [
          { text: "Any combat tips?", next: "training" },
          { text: "Just passing by.", next: "goodbye" }
        ]
      },
      // --- Original dialogue preserved ---
      intel: {
        id: "intel",
        speaker: "Guard Kenji",
        text: "Crawlers are the most common threat — fast, low to the ground, they swarm. Stalkers are nastier — they spit acid from range. Keep your distance or put them down fast.",
        choices: [
          {
            text: "[Iron Sights 1] Any weak spots?",
            next: "intel_weak",
            conditionLabel: "[Iron Sights 1]",
            condition: (player) => (player.skills.ironSights || 0) >= 1
          },
          { text: "Thanks for the heads up.", next: "goodbye" }
        ]
      },
      intel_weak: {
        id: "intel_weak",
        speaker: "Guard Kenji",
        text: "The glowing parts — that's where their mutation is concentrated. Aim there. Shotgun works best up close, but a rifle at range keeps you safe. Your call, marksman.",
        choices: [
          { text: "Good to know.", next: "goodbye" }
        ]
      },
      training: {
        id: "training",
        speaker: "Guard Kenji",
        text: "I'm no sensei, but I've been running drills. Best advice: sprint for positioning, crouch for accuracy, and always keep a round in the chamber. Reload before fights, not during.",
        choices: [
          {
            text: "[Quick Hands 2] Show me the fast reload trick.",
            next: "training_fast",
            conditionLabel: "[Quick Hands 2]",
            condition: (player) => (player.skills.quickHands || 0) >= 2
          },
          { text: "I'll keep that in mind.", next: "goodbye" }
        ]
      },
      training_fast: {
        id: "training_fast",
        speaker: "Guard Kenji",
        text: "You already know it, don't you? Strip the mag, slam the fresh one home, rack it. Your hands are faster than most. Just don't get cocky — speed means nothing if you're dead.",
        choices: [
          { text: "[End]", next: null }
        ]
      },
      goodbye: {
        id: "goodbye",
        speaker: "Guard Kenji",
        text: "Watch your six out there.",
        choices: [
          { text: "[End]", next: null }
        ]
      }
    }
  },

  // ===================== SCAVENGER RIN =====================
  // Lore + hints; enables rebel branch for Q1 via "log fragment"
  scavenger_rin: {
    start: "greeting",
    startFn: (player, game) => {
      const q = Q(game);
      if (q.getFlag("rinLogFragment")) return "greeting_fragment_given";
      if (q.getStage("q1_permission_lie") >= 10) return "greeting_q1aware";
      return "greeting";
    },
    nodes: {
      greeting: {
        id: "greeting",
        speaker: "Scavenger Rin",
        text: "...You're not vault security, are you? Good. Name's Rin. I came in from the wasteland — your overseer let me shelter here. Temporarily.",
        choices: [
          { text: "What's it like out there?", next: "wasteland" },
          { text: "Got anything useful?", next: "trade" },
          { text: "Just passing through.", next: "goodbye" }
        ]
      },
      greeting_q1aware: {
        id: "greeting_q1aware",
        speaker: "Scavenger Rin",
        text: "So Tanaka's got you running his 'Surface Clearance Protocol.' Interesting. You know... I found something in the vault archives while I was sheltering here. Something that doesn't add up.",
        choices: [
          { text: "What did you find?", next: "rin_hint" },
          { text: "I don't have time for rumors.", next: "trade" },
          { text: "What's it like out there?", next: "wasteland" }
        ]
      },
      rin_hint: {
        id: "rin_hint",
        speaker: "Scavenger Rin",
        text: "A maintenance log from Year 3 of the vault. It references 'Protocol SCP-null' — as in, the Surface Clearance Protocol was shelved before it ever existed. Someone brought it back... or invented it from scratch.",
        choices: [
          {
            text: "[Scavenger 2] Let me see that log fragment.",
            next: "rin_give_fragment",
            conditionLabel: "[Scavenger 2]",
            condition: (player) => (player.skills.scavenger || 0) >= 2
          },
          { text: "Could be a filing error.", next: "rin_dismiss" },
          { text: "That's interesting. I'll keep it in mind.", next: "rin_note" }
        ]
      },
      rin_give_fragment: {
        id: "rin_give_fragment",
        speaker: "Scavenger Rin",
        text: "Here. Take it. You have the eyes to see what it means. Confront Tanaka if you want — or don't. Either way, the truth is out there.",
        choices: [
          { text: "Thank you, Rin. This could change everything.", next: "goodbye" }
        ],
        effect: (player, game) => {
          const q = Q(game);
          q.setFlag("rinLogFragment", true);
          q.setStage("q1_permission_lie", 20);
          q.addObjective("Confront Tanaka about the vault logs");
          q.addLog("Rin gave me a vault log fragment proving the Surface Clearance Protocol is fabricated.");
          q.changeRep("vault", -5);
          game.ui.showToast("Received: Vault Log Fragment — Q1 branch unlocked");
        }
      },
      rin_dismiss: {
        id: "rin_dismiss",
        speaker: "Scavenger Rin",
        text: "Sure. A filing error. In a vault that tracks every gram of food and every breath of recycled air. Keep telling yourself that.",
        choices: [
          { text: "Fair point.", next: "goodbye" }
        ]
      },
      rin_note: {
        id: "rin_note",
        speaker: "Scavenger Rin",
        text: "Smart. Don't rush it. But don't ignore it either. The vault has secrets, and secrets have a way of getting people killed.",
        choices: [
          { text: "Got it.", next: "goodbye" }
        ],
        effect: (player, game) => {
          Q(game).setFlag("rinHintHeard", true);
        }
      },
      // --- After fragment given ---
      greeting_fragment_given: {
        id: "greeting_fragment_given",
        speaker: "Scavenger Rin",
        text: "You have the log. What you do with it is your call. Need anything else?",
        choices: [
          { text: "Got anything for trade?", next: "trade" },
          { text: "What's it like out there?", next: "wasteland" },
          { text: "Just checking in.", next: "goodbye" }
        ]
      },
      // --- Original dialogue preserved ---
      wasteland: {
        id: "wasteland",
        speaker: "Scavenger Rin",
        text: "Bad. Three biomes around here: ruined city to the east, dense forest with old shrines up north, industrial coast to the west. Each has its own problems. And its own loot.",
        choices: [
          { text: "Which is safest?", next: "safest" },
          {
            text: "[Scavenger 2] Best loot spots?",
            next: "loot_spots",
            conditionLabel: "[Scavenger 2]",
            condition: (player) => (player.skills.scavenger || 0) >= 2
          },
          { text: "Tell me about the people outside the vault.", next: "factions_hint" },
          { text: "I'll explore.", next: "goodbye" }
        ]
      },
      factions_hint: {
        id: "factions_hint",
        speaker: "Scavenger Rin",
        text: "There are groups out there. The Shrine Wardens guard the old torii gates and temples — they don't like technology or vault people. And in the rail tunnels, the Rail Ghost Union trades salvage and information. Neither is friendly by default, but neither wants you dead. Probably.",
        choices: [
          { text: "How do I earn their trust?", next: "factions_trust" },
          { text: "Good to know.", next: "goodbye" }
        ]
      },
      factions_trust: {
        id: "factions_trust",
        speaker: "Scavenger Rin",
        text: "The Wardens? Respect their shrines. Don't shoot near sacred ground. The Rail Ghosts? Bring trade goods. Information. Be useful without being threatening. Same rules as anywhere, really.",
        choices: [
          { text: "Thanks for the tip.", next: "goodbye" }
        ],
        effect: (player, game) => {
          Q(game).addLog("Rin explained the Shrine Wardens and Rail Ghost Union factions.");
        }
      },
      safest: {
        id: "safest",
        speaker: "Scavenger Rin",
        text: "None of them are safe. But the forest has fewer enemies if you stick to the paths. City has more cover. The coast... the coast is a death trap at night.",
        choices: [
          { text: "Noted. Thanks.", next: "goodbye" }
        ]
      },
      loot_spots: {
        id: "loot_spots",
        speaker: "Scavenger Rin",
        text: "Smart. City buildings have scrap and circuits. Forest shrines sometimes have cloth and medical supplies near the torii gates. Industrial zone — train carts. Nobody checks the derailed ones.",
        choices: [
          { text: "Valuable intel. Thanks.", next: "goodbye" }
        ]
      },
      trade: {
        id: "trade",
        speaker: "Scavenger Rin",
        text: "I travel light but I picked up some things. I can spare cloth for scrap — it's fair.",
        choices: [
          { text: "Trade: 1 Scrap → 2 Cloth", next: "trade_cloth",
            condition: (player) => hasItem(player, "scrap", 1),
            conditionLabel: "[1 Scrap]"
          },
          { text: "Not now.", next: "goodbye" }
        ]
      },
      trade_cloth: {
        id: "trade_cloth",
        speaker: "Scavenger Rin",
        text: "Done. Cloth's useful for crafting vests. Trust me, you'll want the armor.",
        choices: [
          { text: "Thanks. Anything else?", next: "trade" },
          { text: "[End]", next: null }
        ],
        effect: (player, game) => {
          removeItem(player, "scrap", 1);
          addItem(player, "cloth", 2);
          game.ui.showToast("Received: Tattered Cloth x2");
        }
      },
      goodbye: {
        id: "goodbye",
        speaker: "Scavenger Rin",
        text: "Good luck out there. If you find anything interesting, come tell me about it.",
        choices: [
          { text: "[End]", next: null }
        ]
      }
    }
  }
};

// ---- Dialogue Controller ----
export class DialogueController {
  constructor() {
    this.active = false;
    this.currentNpcId = null;
    this.currentNode = null;
    this.tree = null;
  }

  /** Start dialogue with an NPC. Returns the first node, or null if no tree exists. */
  start(npcId, player, game) {
    const tree = DialogueTrees[npcId];
    if (!tree) return null;
    this.active = true;
    this.currentNpcId = npcId;
    this.tree = tree;
    // Use dynamic start node if available
    const startId = (tree.startFn && player && game) ? tree.startFn(player, game) : tree.start;
    this.currentNode = tree.nodes[startId] || tree.nodes[tree.start];
    return this.currentNode;
  }

  /** Pick a choice by index. Returns the next node, or null if dialogue ends. */
  pick(choiceIndex, player, game) {
    if (!this.active || !this.currentNode) return null;
    const choices = this.currentNode.choices;
    if (choiceIndex < 0 || choiceIndex >= choices.length) return null;

    const choice = choices[choiceIndex];

    // Apply current node's effect (if any) when leaving it via a choice
    if (this.currentNode.effect) {
      this.currentNode.effect(player, game);
    }

    // Apply the chosen choice's effect (if any)
    if (choice.effect) {
      choice.effect(player, game);
    }

    if (choice.next === null) {
      this.end();
      return null;
    }

    const nextNode = this.tree.nodes[choice.next];
    if (!nextNode) {
      this.end();
      return null;
    }

    this.currentNode = nextNode;
    return this.currentNode;
  }

  end() {
    this.active = false;
    this.currentNpcId = null;
    this.currentNode = null;
    this.tree = null;
  }
}
