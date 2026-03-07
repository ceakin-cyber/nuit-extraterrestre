(function () {
  const DB = {
    coffee: {
      label: "COFFEE",
      analysis: "ritual stimulant. socially sanctioned dependency.",
      risk: "MODERATE",
      action: "Consume with a xanax to limit shakiness."
    },
    phone: {
      label: "PHONE",
      analysis: "portable attention altar. gives the impression you want to interact. houses memories and dread.",
      risk: "HIGH",
      action: "place face-down. pretend you are unreachable."
    },
    keys: {
      label: "KEYS",
      analysis: "analog entrance to locked areas.",
      risk: "LOW",
      action: "do not ever loose unless you are okay with spending money."
    },
    receipt: {
      label: "RECEIPT",
      analysis: "Proof of exchange. Humans keep it to defeat future accusations and return objects they regret.",
      risk: "Low. Contains sensitive price signals.",
      action: "Archive briefly, then destroy to reduce traceable patterns."
    },
    tote: {
      label: "TOTE BAG",
      analysis: "socially acceptable in all environments. excellent for transporting tech.",
      risk: "LOW",
      action: "keep all human objects outside of pockets."
    },
    water: {
      label: "WATER",
      analysis: "if not drunk humans will die. they will say it tasts bad. it tastes like nothing.",
      risk: "CRITICAL",
      action: "keep bottle in bag in case someone passes out from negligence."
    }
  };

  const grid = document.getElementById("scannerGrid");
  const readout = document.getElementById("readoutText");
  const signal = document.getElementById("signalStrength");
  const scanRandomBtn = document.getElementById("scanRandom");
  const clearBtn = document.getElementById("clearReadout");

  if (!grid || !readout || !signal || !scanRandomBtn || !clearBtn) return;

  const keys = Object.keys(DB);
  let typingTimer = null;

  function setSignal(level) {
    if (level === 0) signal.textContent = "SIGNAL: STABLE";
    if (level === 1) signal.textContent = "SIGNAL: ACTIVE";
    if (level === 2) signal.textContent = "SIGNAL: NOISY";
  }

  function glitchify(text) {
    const noise = ["░", "▒", "▓", "•", "·"];
    return (Math.random() < 0.22)
      ? text + " " + noise[Math.floor(Math.random() * noise.length)]
      : text;
  }

  function stopTyping() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
  }

  function renderScan(key) {
    const item = DB[key];
    if (!item) return;

    stopTyping();
    setSignal(1);

    const now = new Date();
    const stamp = now.toLocaleString(undefined, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });

    const output =
`TIME: ${stamp}
OBJECT: ${item.label}
--------------------------------
ANALYSIS: ${item.analysis}
RISK: ${item.risk}
RECOMMENDED ACTION: ${item.action}`;

    readout.textContent = "";
    const text = glitchify(output);
    let i = 0;

    typingTimer = setInterval(() => {
      readout.textContent += text[i] || "";
      i++;
      if (i >= text.length) {
        stopTyping();
        setSignal(0);
      }
    }, 6);
  }

  function scanRandom() {
    setSignal(2);
    const key = keys[Math.floor(Math.random() * keys.length)];
    renderScan(key);
  }

  function clearReadout() {
    stopTyping();
    setSignal(0);
    readout.textContent = "Hover or click an object to scan.";
  }

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".scan-item");
    if (!btn) return;
    renderScan(btn.dataset.key);
  });

  scanRandomBtn.addEventListener("click", scanRandom);
  clearBtn.addEventListener("click", clearReadout);
})();