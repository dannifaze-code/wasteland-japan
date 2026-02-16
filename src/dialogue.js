// Dialogue System for Wasteland Japan — Vault 811
// Manages dialogue trees with branching choices, skill checks, quest hooks, and vendor hooks.

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

// ---- Dialogue Tree Data ----
// Each dialogue tree is keyed by NPC dialogueId.
// Nodes: { id, speaker, text, choices: [{ text, next, condition?, effect? }] }
//   - condition: optional function(player) => bool for skill checks etc.
//   - conditionLabel: string shown if condition exists (e.g. "[Toughness 2]")
//   - effect: optional function(player, game) called when choice is picked
//   - next: id of the next node, or null to end dialogue

export const DialogueTrees = {
  overseer_tanaka: {
    start: "greeting",
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
        text: "Supplies. Weapons. Information. Yuki in medical has stims — talk to her. And Kenji at the door can brief you on the hostiles.",
        choices: [
          { text: "Fine. I'll investigate the shrine.", next: "quest_accept" },
          { text: "I need to prepare first.", next: "goodbye" }
        ]
      },
      quest_offer: {
        id: "quest_offer",
        speaker: "Overseer Tanaka",
        text: "A recon team went dark near a shrine outpost north of here. Find them — or find out what happened. Report back.",
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
          if (game.quest.step === 0) {
            game.quest.log = ["Investigate the shrine outpost", "Talk to Medic Yuki for supplies"];
            game.ui.showToast("Objective updated: Investigate the shrine outpost");
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
          if (game.quest.step === 0) {
            game.quest.log = ["Investigate the shrine outpost", "Talk to Medic Yuki for supplies"];
            game.ui.showToast("Objective updated: Investigate the shrine outpost");
          }
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

  medic_yuki: {
    start: "greeting",
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
      vendor: {
        id: "vendor",
        speaker: "Medic Yuki",
        text: "I can trade stims and Rad-Away for scrap. It's not charity, but it'll keep you alive out there.",
        choices: [
          { text: "Trade: 2 Scrap → 1 Field Stim", next: "trade_stim",
            condition: (player) => {
              const scrap = player.inv.find(x => x.id === "scrap");
              return scrap && (scrap.qty || 1) >= 2;
            },
            conditionLabel: "[2 Scrap]"
          },
          { text: "Trade: 1 Scrap + 1 Circuit → 1 Rad-Away", next: "trade_radaway",
            condition: (player) => {
              const scrap = player.inv.find(x => x.id === "scrap");
              const circuits = player.inv.find(x => x.id === "circuits");
              return scrap && (scrap.qty || 1) >= 1 && circuits && (circuits.qty || 1) >= 1;
            },
            conditionLabel: "[1 Scrap + 1 Circuit]"
          },
          { text: "Maybe later.", next: "goodbye" }
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

  guard_kenji: {
    start: "greeting",
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

  scavenger_rin: {
    start: "greeting",
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
          { text: "I'll explore.", next: "goodbye" }
        ]
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
            condition: (player) => {
              const scrap = player.inv.find(x => x.id === "scrap");
              return scrap && (scrap.qty || 1) >= 1;
            },
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
  start(npcId) {
    const tree = DialogueTrees[npcId];
    if (!tree) return null;
    this.active = true;
    this.currentNpcId = npcId;
    this.tree = tree;
    this.currentNode = tree.nodes[tree.start];
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
