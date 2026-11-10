(function() {
  const MOTIONS = {
    yawn: {
      duration: 2600,
      keys: [
        { t: 0,    values: { pEyeL: 1,   pEyeR: 1,   pAngleY: 0     } },
        { t: 0.25, values: { pEyeL: 0.6, pEyeR: 0.6, pAngleY: -0.15 } },
        { t: 0.45, values: { pEyeL: 0.15,pEyeR: 0.15,pAngleY: -0.35 } },
        { t: 0.65, values: { pEyeL: 0.2, pEyeR: 0.2, pAngleY: -0.3  } },
        { t: 0.85, values: { pEyeL: 0.6, pEyeR: 0.6, pAngleY: -0.1  } },
        { t: 1,    values: { pEyeL: 1,   pEyeR: 1,   pAngleY: 0     } }
      ]
    },
    sleep: {
      duration: 1500,
      keys: [
        { t: 0, values: { pEyeL: 1, pEyeR: 1, pAngleY: 0    } },
        { t: 1, values: { pEyeL: 0, pEyeR: 0, pAngleY: 0.15 } }
      ]
    },
    wake: {
      duration: 1200,
      keys: [
        { t: 0, values: { pEyeL: 0, pEyeR: 0, pAngleY: 0.15 } },
        { t: 1, values: { pEyeL: 1, pEyeR: 1, pAngleY: 0    } }
      ]
    },
    nod: {
      duration: 1200,
      keys: [
        { t: 0,   values: { pAngleY: 0    } },
        { t: 0.5, values: { pAngleY: -0.5 } },
        { t: 1,   values: { pAngleY: 0    } }
      ]
    },
    shakeHead: {
      duration: 1400,
      keys: [
        { t: 0,    values: { pAngleX: 0    } },
        { t: 0.25, values: { pAngleX: -0.4 } },
        { t: 0.5,  values: { pAngleX: 0    } },
        { t: 0.75, values: { pAngleX: 0.4  } },
        { t: 1,    values: { pAngleX: 0    } }
      ]
    },
    tilt: {
      duration: 1200,
      keys: [
        { t: 0,   values: { pAngleZ: 0    } },
        { t: 0.5, values: { pAngleZ: -0.4 } },
        { t: 1,   values: { pAngleZ: 0    } }
      ]
    },
    surprise: {
      duration: 1600,
      keys: [
        { t: 0,    values: { pIrisScale: 1   } },
        { t: 0.25, values: { pIrisScale: 0.7 } },
        { t: 0.75, values: { pIrisScale: 0.7 } },
        { t: 1,    values: { pIrisScale: 1   } }
      ]
    },
    happy: {
      duration: 1800,
      keys: [
        { t: 0,   values: { pAngleZ: 0,     pBody: 0    } },
        { t: 0.2, values: { pAngleZ: 0.15,  pBody: 0.3  } },
        { t: 0.4, values: { pAngleZ: -0.15, pBody: -0.2 } },
        { t: 0.6, values: { pAngleZ: 0.15,  pBody: 0.3  } },
        { t: 0.8, values: { pAngleZ: -0.15, pBody: -0.2 } },
        { t: 1,   values: { pAngleZ: 0,     pBody: 0    } }
      ]
    },
    stretch: {
      duration: 2200,
      keys: [
        { t: 0,   values: { pBody: 0,   pArmY: 0   } },
        { t: 0.4, values: { pBody: 0.4, pArmY: 0.8 } },
        { t: 0.7, values: { pBody: 0.4, pArmY: 0.8 } },
        { t: 1,   values: { pBody: 0,   pArmY: 0   } }
      ]
    },
    idle: {
      duration: 6000,
      keys: [
        { t: 0,   values: { pAngleX: 0,     pAngleZ: 0     } },
        { t: 0.3, values: { pAngleX: 0.2,   pAngleZ: 0.1   } },
        { t: 0.6, values: { pAngleX: -0.15, pAngleZ: -0.08 } },
        { t: 1,   values: { pAngleX: 0,     pAngleZ: 0     } }
      ]
    }
  };

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function sampleMotion(motion, progress) {
    const keys = motion.keys;
    if (progress <= keys[0].t) return { ...keys[0].values };
    if (progress >= keys[keys.length - 1].t) return { ...keys[keys.length - 1].values };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (progress >= a.t && progress <= b.t) {
        const span = (b.t - a.t) || 1;
        const local = smoothstep((progress - a.t) / span);
        const out = {};
        const all = new Set([...Object.keys(a.values), ...Object.keys(b.values)]);
        for (const k of all) {
          const av = a.values[k] ?? 0;
          const bv = b.values[k] ?? 0;
          out[k] = av + (bv - av) * local;
        }
        return out;
      }
    }
    return { ...keys[keys.length - 1].values };
  }

  function setSlider(id, value) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  let currentRAF = null;

  function playMotion(name, holdEnd) {
    const motion = MOTIONS[name];
    if (!motion) { console.warn('未知动作:', name); return false; }
    if (currentRAF) cancelAnimationFrame(currentRAF);

    const start = performance.now();
    const duration = motion.duration;

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const values = sampleMotion(motion, progress);
      for (const [k, v] of Object.entries(values)) setSlider(k, v);
      if (progress < 1) {
        currentRAF = requestAnimationFrame(step);
      } else {
        currentRAF = null;
        if (!holdEnd) console.log('✓ 动作完成:', name);
      }
    }
    currentRAF = requestAnimationFrame(step);
    return true;
  }

  // 手动设置眼睛（不通过动画）
  function setEyes(value) {
    setSlider('pEyeL', value);
    setSlider('pEyeR', value);
  }

  window.__petMotion = {
    play: playMotion,
    setEyes,
    list: () => Object.keys(MOTIONS)
  };

  console.log('pet-motion.js 已加载（眼部动作版）');
})();
